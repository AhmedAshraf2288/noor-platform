const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { notify } = require('../lib/util');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `v${Date.now()}-${crypto.randomBytes(8).toString('hex')}.mp4`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    const okType = ['video/mp4', 'video/webm', 'video/quicktime', 'application/octet-stream'].includes(file.mimetype);
    const okExt = /\.(mp4|webm|mov)$/i.test(file.originalname || '');
    const ok = okType && okExt;
    cb(ok ? null : new Error('صيغة الفيديو غير مدعومة (MP4 فقط)'), ok);
  },
});

const coversDir = path.join(uploadsDir, 'covers');
fs.mkdirSync(coversDir, { recursive: true });
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
function removeCoverFile(name) {
  if (!name) return;
  const p = path.join(coversDir, path.basename(name));
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/* ---------- students ---------- */

router.get('/students', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.active, u.created_at, u.governorate, u.school,
      (SELECT GROUP_CONCAT(c.title_ar, '، ') FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = u.id) AS courses
    FROM users u WHERE u.role = 'student' ORDER BY u.id DESC
  `).all();
  res.json({ students: rows.map((s) => ({ ...s, active: !!s.active })) });
});

router.post('/students/:id/active', validate(z.object({ active: z.boolean() })), (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'الطالب غير موجود' });
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, u.id);
  res.json({ ok: true });
});

// Open or close a course for a specific student
router.post('/students/:id/courses',
  validate(z.object({ courseId: z.number().int().positive(), grant: z.boolean() })),
  (req, res) => {
    const u = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(Number(req.params.id));
    if (!u) return res.status(404).json({ error: 'الطالب غير موجود' });
    const c = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.body.courseId);
    if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
    if (req.body.grant) {
      db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)').run(u.id, c.id);
      db.prepare(
        "UPDATE course_requests SET status = 'approved', decided_at = datetime('now') WHERE user_id = ? AND course_id = ? AND status = 'pending'"
      ).run(u.id, c.id);
    } else {
      db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(u.id, c.id);
    }
    res.json({ ok: true });
  });

/* ---------- subscription requests queue ---------- */

router.get('/requests', (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.status, r.method, r.created_at, r.decided_at,
           u.id AS user_id, u.name AS student_name, u.email AS student_email,
           c.id AS course_id, c.title_ar, c.title_en, c.price
    FROM course_requests r
    JOIN users u ON u.id = r.user_id
    JOIN courses c ON c.id = r.course_id
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC
  `).all();
  res.json({ requests: rows });
});

router.post('/requests/:id/decide',
  validate(z.object({ approve: z.boolean() })),
  (req, res) => {
    const r = db.prepare('SELECT * FROM course_requests WHERE id = ?').get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (r.status !== 'pending') return res.status(409).json({ error: 'تم البت في هذا الطلب بالفعل' });
    const status = req.body.approve ? 'approved' : 'rejected';
    db.prepare("UPDATE course_requests SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, r.id);
    if (req.body.approve) {
      // approval is what opens the course for the student
      db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)').run(r.user_id, r.course_id);
      db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(r.user_id);
      notify(r.user_id, 'تم فتح الكورس لك', 'طلبك اتقبل، تقدر تبدأ المشاهدة دلوقتي.', '#/student');
    } else notify(r.user_id, 'تم رفض طلب الاشتراك', 'كلم المبيعات على واتساب لو محتاج مساعدة.', '#/student');
    res.json({ ok: true, status });
  });

/* ---------- courses & videos ---------- */

router.get('/courses', (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY id').all();
  const lessons = db.prepare(
    `SELECT l.id, l.course_id, l.title_ar, l.title_en, l.duration, l.position,
            (l.video_file IS NOT NULL) AS has_video,
            (SELECT COUNT(*) FROM exam_questions q WHERE q.lesson_id = l.id) AS exam_count
     FROM lessons l ORDER BY l.position, l.id`
  ).all();
  res.json({
    courses: courses.map((c) => ({
      id: c.id, titleAr: c.title_ar, titleEn: c.title_en, descAr: c.desc_ar, price: c.price, icon: c.icon, theme: c.theme,
      coverUrl: c.cover_file ? `/api/courses/${c.id}/cover?v=${encodeURIComponent(c.cover_file)}` : null,
      lessons: lessons.filter((l) => l.course_id === c.id).map((l) => ({
        id: l.id, titleAr: l.title_ar, titleEn: l.title_en, duration: l.duration,
        hasVideo: !!l.has_video, examCount: l.exam_count,
      })),
    })),
  });
});

// Create a full course (lessons get added one by one below)
router.post('/courses',
  validate(z.object({
    titleAr: z.string().trim().min(2).max(160),
    titleEn: z.string().trim().max(160).optional().default(''),
    descAr: z.string().trim().max(2000).optional().default(''),
    descEn: z.string().trim().max(2000).optional().default(''),
    price: z.string().trim().max(20).optional().default('0'),
    icon: z.string().trim().max(8).optional().default('📚'),
    theme: z.enum(['cv1', 'cv2', 'cv3']).optional().default('cv1'),
  })),
  (req, res) => {
    const b = req.body;
    const info = db.prepare(
      'INSERT INTO courses (title_ar, title_en, desc_ar, desc_en, price, icon, theme, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(b.titleAr, b.titleEn, b.descAr, b.descEn, b.price, b.icon, b.theme);
    for (const u of db.prepare("SELECT id FROM users WHERE role = 'student'").all()) notify(u.id, 'كورس جديد على المنصة', b.titleAr, `#/courses/${info.lastInsertRowid}`, 'crs-' + info.lastInsertRowid);
    res.status(201).json({ id: info.lastInsertRowid });
  });

// Edit an existing course's details
router.put('/courses/:id',
  validate(z.object({
    titleAr: z.string().trim().min(2).max(160),
    titleEn: z.string().trim().max(160).optional().default(''),
    descAr: z.string().trim().max(2000).optional().default(''),
    descEn: z.string().trim().max(2000).optional().default(''),
    price: z.string().trim().max(20).optional().default('0'),
    icon: z.string().trim().max(8).optional().default('📚'),
    theme: z.enum(['cv1', 'cv2', 'cv3']).optional().default('cv1'),
  })),
  (req, res) => {
    const c = db.prepare('SELECT id FROM courses WHERE id = ?').get(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
    const b = req.body;
    db.prepare('UPDATE courses SET title_ar = ?, title_en = ?, desc_ar = ?, desc_en = ?, price = ?, icon = ?, theme = ? WHERE id = ?')
      .run(b.titleAr, b.titleEn, b.descAr, b.descEn, b.price, b.icon, b.theme, c.id);
    res.json({ ok: true });
  });

// Upload / replace the optional course cover image (JPG, PNG or WebP, up to 5MB)
router.post('/courses/:id/cover', (req, res) => {
  coverUpload.single('cover')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'الصورة أكبر من 5 ميجا' : 'فشل رفع الصورة' });
    const c = db.prepare('SELECT id, cover_file FROM courses WHERE id = ?').get(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
    if (!req.file) return res.status(400).json({ error: 'اختار صورة' });
    const ext = sniffImage(req.file.buffer);
    if (!ext) return res.status(400).json({ error: 'الصورة لازم تكون JPG أو PNG أو WebP' });
    const name = `c${c.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(coversDir, name), req.file.buffer);
    db.prepare('UPDATE courses SET cover_file = ? WHERE id = ?').run(name, c.id);
    removeCoverFile(c.cover_file);
    res.json({ ok: true });
  });
});

router.delete('/courses/:id/cover', (req, res) => {
  const c = db.prepare('SELECT id, cover_file FROM courses WHERE id = ?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
  db.prepare('UPDATE courses SET cover_file = NULL WHERE id = ?').run(c.id);
  removeCoverFile(c.cover_file);
  res.json({ ok: true });
});

// Delete a whole course (its lessons, exams and video files go with it)
router.delete('/courses/:id', (req, res) => {
  const c = db.prepare('SELECT id FROM courses WHERE id = ?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
  const files = db.prepare('SELECT video_file FROM lessons WHERE course_id = ? AND video_file IS NOT NULL').all(c.id);
  const cv = db.prepare('SELECT cover_file FROM courses WHERE id = ?').get(c.id);
  if (cv) removeCoverFile(cv.cover_file);
  db.prepare('DELETE FROM courses WHERE id = ?').run(c.id);
  for (const f of files) {
    const p = path.join(uploadsDir, path.basename(f.video_file));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.json({ ok: true });
});

/* ---------- lesson exams ---------- */

const questionSchema = z.object({
  type: z.enum(['mcq', 'tf', 'essay', 'order', 'match']).default('mcq'),
  q: z.string().trim().min(2).max(800),
  options: z.array(z.string().trim().max(300)).max(6).optional().default([]),
  correct: z.number().int().min(0).optional().default(0),
  items: z.array(z.string().trim().min(1).max(200)).max(8).optional().default([]),
  pairs: z.array(z.tuple([z.string().trim().min(1).max(200), z.string().trim().min(1).max(200)])).max(6).optional().default([]),
  model: z.string().trim().max(1500).optional().default(''),
  points: z.number().int().min(1).max(10).optional().default(1),
  image: z.string().regex(/^[a-zA-Z0-9._-]+$/).nullable().optional(),
}).superRefine((qq, ctx) => {
  const bad = (m) => ctx.addIssue({ code: 'custom', message: m });
  if (qq.type === 'mcq') {
    if (qq.options.length < 2 || qq.options.some((o) => !o)) bad('اختيارات السؤال ناقصة');
    else if (qq.correct >= qq.options.length) bad('الإجابة الصحيحة خارج الاختيارات');
  } else if (qq.type === 'tf') { if (qq.correct > 1) bad('صح أو غلط فقط'); }
  else if (qq.type === 'order') { if (qq.items.length < 2) bad('الترتيب يحتاج عنصرين على الأقل'); }
  else if (qq.type === 'match') { if (qq.pairs.length < 2) bad('التوصيل يحتاج زوجين على الأقل'); }
});

const EXAM_SHOWN = 5; // questions a student sees per attempt, drawn from the bank

// Read one lesson's exam bank (with correct answers - admin only)
router.get('/lessons/:id/exam', (req, res) => {
  const l = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'الدرس غير موجود' });
  const rows = db.prepare('SELECT * FROM exam_questions WHERE lesson_id = ? ORDER BY position, id').all(l.id);
  res.json({
    questions: rows.map((r) => {
      const d = r.data ? JSON.parse(r.data) : {};
      return { type: r.qtype || 'mcq', q: r.question, options: JSON.parse(r.options || '[]'), correct: r.correct,
        items: d.items || [], pairs: d.pairs || [], model: d.model || '', points: r.points || 1, image: r.image_file || null };
    }),
    openAt: l.exam_open_at || null,
    closeAt: l.exam_close_at || null,
    durationMin: l.exam_duration_min || null,
    maxAttempts: l.exam_max_attempts || null,
    shown: EXAM_SHOWN,
  });
});

// Upload a picture for a question (JPG/PNG/WebP up to 5MB); returns the stored name
router.post('/question-image', (req, res) => {
  coverUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'فشل رفع الصورة' });
    if (!req.file) return res.status(400).json({ error: 'اختار صورة' });
    const ext = sniffImage(req.file.buffer);
    if (!ext) return res.status(400).json({ error: 'الصورة لازم تكون JPG أو PNG أو WebP' });
    const name = `q-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(coversDir, name), req.file.buffer);
    res.json({ name });
  });
});

// Replace a lesson's exam bank in one shot (at least 5 questions; each student gets 5 random ones)
router.put('/lessons/:id/exam',
  validate(z.object({
    questions: z.array(questionSchema).min(EXAM_SHOWN).max(60),
    // Open/close time and duration are mandatory (client request)
    openAt: z.string().min(8),
    closeAt: z.string().min(8),
    durationMin: z.number().int().min(1).max(300),
    maxAttempts: z.number().int().min(1).max(20).nullable().optional(),
  })),
  (req, res) => {
    const l = db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(req.params.id));
    if (!l) return res.status(404).json({ error: 'الدرس غير موجود' });
    const o = Date.parse(req.body.openAt), c = Date.parse(req.body.closeAt);
    if (isNaN(o) || isNaN(c)) return res.status(400).json({ error: 'تاريخ غير صالح' });
    if (c <= o) return res.status(400).json({ error: 'موعد القفل لازم يكون بعد موعد الفتح' });
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM exam_questions WHERE lesson_id = ?').run(l.id);
      const ins = db.prepare('INSERT INTO exam_questions (lesson_id, question, options, correct, position, qtype, image_file, data, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      req.body.questions.forEach((qq, i) => {
        const options = qq.type === 'tf' ? ['صح', 'غلط'] : qq.type === 'mcq' ? qq.options : [];
        const data = qq.type === 'order' ? { items: qq.items } : qq.type === 'match' ? { pairs: qq.pairs } : qq.type === 'essay' ? { model: qq.model } : {};
        ins.run(l.id, qq.q, JSON.stringify(options), qq.type === 'mcq' || qq.type === 'tf' ? qq.correct : 0, i + 1, qq.type, qq.image || null, JSON.stringify(data), qq.points);
      });
      db.prepare('UPDATE lessons SET exam_open_at = ?, exam_close_at = ?, exam_duration_min = ?, exam_max_attempts = ? WHERE id = ?')
        .run(req.body.openAt, req.body.closeAt, req.body.durationMin, req.body.maxAttempts || null, l.id);
    });
    tx();
    res.json({ ok: true, count: req.body.questions.length });
  });

// Students locked out of this exam (3 violations) + admin reopen
router.get('/lessons/:id/exam/locks', (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.name, u.email, s.strikes FROM exam_states s JOIN users u ON u.id = s.user_id
    WHERE s.lesson_id = ? AND s.locked = 1 ORDER BY u.name`).all(Number(req.params.id));
  res.json({ locked: rows });
});

router.post('/lessons/:id/exam/unlock',
  validate(z.object({ userId: z.number().int() })),
  (req, res) => {
    const r = db.prepare('UPDATE exam_states SET locked = 0, strikes = 0, started_at = NULL WHERE lesson_id = ? AND user_id = ?')
      .run(Number(req.params.id), req.body.userId);
    if (!r.changes) return res.status(404).json({ error: 'الطالب غير موجود في هذا الامتحان' });
    res.json({ ok: true });
  });

router.delete('/lessons/:id/exam', (req, res) => {
  const l = db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'الدرس غير موجود' });
  db.prepare('DELETE FROM exam_questions WHERE lesson_id = ?').run(l.id);
  db.prepare('DELETE FROM exam_attempts WHERE lesson_id = ?').run(l.id);
  db.prepare('DELETE FROM exam_states WHERE lesson_id = ?').run(l.id);
  db.prepare('UPDATE lessons SET exam_open_at = NULL, exam_close_at = NULL, exam_duration_min = NULL WHERE id = ?').run(l.id);
  res.json({ ok: true });
});

// Upload a video lesson to a course
router.post('/courses/:id/lessons', (req, res, next) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل رفع الفيديو' });
    next();
  });
}, (req, res) => {
  const c = db.prepare('SELECT id FROM courses WHERE id = ?').get(Number(req.params.id));
  if (!c) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'الكورس غير موجود' });
  }
  const titleAr = String(req.body.titleAr || '').trim();
  if (!titleAr) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'عنوان الدرس مطلوب' });
  }
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM lessons WHERE course_id = ?').get(c.id).p;
  const info = db.prepare(
    'INSERT INTO lessons (course_id, title_ar, title_en, duration, video_file, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(c.id, titleAr, String(req.body.titleEn || '').trim(), String(req.body.duration || '').trim(),
    req.file ? path.basename(req.file.path) : null, pos);
  for (const e of db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(c.id)) notify(e.user_id, 'درس جديد في كورسك', titleAr, `#/watch/${info.lastInsertRowid}`, 'les-' + info.lastInsertRowid);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Upload or replace the video of an existing lesson
router.post('/lessons/:id/video', (req, res, next) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل رفع الفيديو' });
    next();
  });
}, (req, res) => {
  const l = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!l) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'الدرس غير موجود' });
  }
  if (!req.file) return res.status(400).json({ error: 'ملف الفيديو مطلوب' });
  if (l.video_file) {
    const old = path.join(uploadsDir, path.basename(l.video_file));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare('UPDATE lessons SET video_file = ? WHERE id = ?').run(path.basename(req.file.path), l.id);
  res.json({ ok: true });
});

router.delete('/lessons/:id', (req, res) => {
  const l = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: 'الدرس غير موجود' });
  db.prepare('DELETE FROM lessons WHERE id = ?').run(l.id);
  if (l.video_file) {
    const f = path.join(uploadsDir, path.basename(l.video_file));
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  res.json({ ok: true });
});

/* ---------- settings (payment info / whatsapp) ---------- */

router.post('/settings',
  validate(z.object({
    whatsapp: z.string().max(40).optional(),
    instapay: z.string().max(120).optional(),
    wallet: z.string().max(40).optional(),
    wallet_name: z.string().max(80).optional(),
  })),
  (req, res) => {
    const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(req.body)) up.run(k, v);
    res.json({ ok: true });
  });

module.exports = router;
