const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');
const { z } = require('zod');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { seal, open } = require('../lib/vault');
const { notify, logAct, getSetting, setSetting, priceNum } = require('../lib/util');

try { db.exec('ALTER TABLE live_sessions ADD COLUMN recording TEXT'); } catch (e) {}

if (db.prepare('SELECT COUNT(*) AS n FROM faq').get().n === 0) {
  const ins = db.prepare('INSERT INTO faq (q, a, keywords) VALUES (?, ?, ?)');
  ins.run('إزاي أشترك في كورس؟', 'سجّل حساب، استنى الإدارة تفعّله، اختار الكورس، ادفع بإنستا باي أو محفظة إلكترونية وابعت الطلب. بعد المراجعة الكورس بيفتح لك.', 'اشترك اشتراك سجل تسجيل ازاي كورس');
  ins.run('طرق الدفع إيه؟', 'الدفع يدوي: إنستا باي أو محفظة إلكترونية (فودافون كاش وغيرها)، من غير بوابة دفع. بعد التحويل بتبعت الطلب ونراجعه.', 'دفع ادفع فلوس انستا باي محفظة فودافون كاش تحويل');
  ins.run('نسيت كلمة المرور أعمل إيه؟', 'كلم فريق المبيعات على واتساب وهيساعدوك في استعادة حسابك.', 'نسيت كلمه المرور باسورد password حساب');
  ins.run('حسابي مش متفعّل', 'الإدارة بتفعّل الحسابات يدوياً. لو اتأخر كلمنا على واتساب.', 'تفعيل متفعل حسابي مفعل مقفول');
  ins.run('ينفع أحمّل الفيديو؟', 'لأ، الفيديوهات للمشاهدة على الموقع فقط ومحمية من التحميل المباشر.', 'تحميل حمل تنزيل فيديو download');
  ins.run('امتحاني اتقفل ليه؟', 'الامتحان بيتقفل بعد 3 مخالفات (الخروج من الصفحة أو تبديل التبويب). كلم الإدارة لفتحه.', 'امتحان اتقفل مقفول مخالفات غش');
  ins.run('ينفع أستخدم حسابي على كذا جهاز؟', 'الحساب بيشتغل على جهازين بحد أقصى. لو غيرت جهازك كلم الإدارة لإعادة ضبط الأجهزة.', 'جهاز اجهزه موبايل لاب توب جهازين');
}
const router = express.Router();
const isStaff = (u) => u.role === 'admin' || u.role === 'mod';
const isAdmin = (u) => u.role === 'admin';
const adminOnly = (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'للإدارة فقط' }));
const staffOnly = (req, res, next) => (isStaff(req.user) ? next() : res.status(403).json({ error: 'غير مسموح' }));
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

const uploadsDir = path.join(__dirname, '..', 'uploads');
const filesDir = path.join(uploadsDir, 'files');
fs.mkdirSync(filesDir, { recursive: true });

function canAccessCourse(user, cid) {
  return isStaff(user) || !!db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(user.id, cid);
}
function lessonAccess(req, res) {
  const l = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!l) { res.status(404).json({ error: 'الدرس غير موجود' }); return null; }
  if (!canAccessCourse(req.user, l.course_id)) { res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' }); return null; }
  return l;
}

/* ================= public ================= */

router.get('/public/stats', (req, res) => {
  const students = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'student'").get().c;
  const courses = db.prepare('SELECT COUNT(*) AS c FROM courses WHERE published = 1').get().c;
  const lessons = db.prepare('SELECT COUNT(*) AS c FROM lessons').get().c;
  const enrolls = db.prepare('SELECT COUNT(*) AS c FROM enrollments').get().c;
  res.json({ students, courses, lessons, enrollments: enrolls });
});

router.get('/public/theme', (req, res) => {
  res.json({
    primary: getSetting('theme_primary', ''), accent: getSetting('theme_accent', ''),
    logoUrl: getSetting('logo_file', '') ? `/api/public/logo?v=${encodeURIComponent(getSetting('logo_file'))}` : null,
    maintenance: getSetting('maintenance_on', '0') === '1', maintenanceMsg: getSetting('maintenance_msg', ''),
    leaderboardOn: getSetting('leaderboard_on', '1') === '1',
  });
});
router.get('/public/logo', (req, res) => {
  const f = path.join(uploadsDir, 'covers', path.basename(getSetting('logo_file', 'none')));
  if (!fs.existsSync(f)) return res.status(404).end();
  const ext = path.extname(f).toLowerCase();
  res.set('Content-Type', ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(f).pipe(res);
});

// Auto FAQ bot: simple keyword matching (not real AI)
const AR_STOP = new Set(['في', 'من', 'على', 'الى', 'إلى', 'عن', 'ان', 'أن', 'هل', 'ما', 'هو', 'هي', 'و', 'يا', 'ده', 'دي', 'انا', 'أنا', 'لو', 'مع', 'كل', 'the', 'a', 'is', 'to', 'of', 'and', 'how', 'do', 'i', 'can']);
const norm = (s) => String(s).toLowerCase().replace(/[ًٌٍَُِّْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}\s]/gu, ' ');
const words = (s) => norm(s).split(/\s+/).filter((w) => w.length > 1 && !AR_STOP.has(w));
router.get('/public/faq', (req, res) => res.json({ items: db.prepare('SELECT id, q, a FROM faq ORDER BY id').all() }));
router.post('/public/faq-ask', validate(z.object({ text: z.string().trim().min(2).max(200) })), (req, res) => {
  const qw = new Set(words(req.body.text));
  let best = null, bs = 0;
  for (const f of db.prepare('SELECT * FROM faq').all()) {
    const fw = new Set(words(f.q + ' ' + f.keywords));
    let s = 0; for (const w of qw) { if (fw.has(w)) s += 2; else for (const x of fw) if (x.length > 3 && w.length > 3 && (x.includes(w) || w.includes(x))) { s += 1; break; } }
    if (s > bs) { bs = s; best = f; }
  }
  if (!best || bs < 2) return res.json({ found: false, answer: 'مش لاقي إجابة جاهزة للسؤال ده. كلم فريق المبيعات على واتساب وهيساعدوك.' });
  res.json({ found: true, q: best.q, answer: best.a });
});

// Certificate verification (public, what the QR code opens)
router.get('/verify/:code', (req, res) => {
  const c = db.prepare(`SELECT ce.*, u.name AS student, co.title_ar AS course FROM certificates ce JOIN users u ON u.id = ce.user_id JOIN courses co ON co.id = ce.course_id WHERE ce.code = ?`).get(String(req.params.code).slice(0, 40));
  if (!c) return res.status(404).json({ valid: false });
  res.json({ valid: true, student: c.student, course: c.course, kind: c.kind, pct: c.pct, date: c.created_at.slice(0, 10), code: c.code });
});

// Learning paths with progress
router.get('/paths', (req, res) => {
  const paths = db.prepare('SELECT * FROM paths ORDER BY id').all();
  let uid = null;
  try { const jwt = require('jsonwebtoken'); uid = jwt.verify(req.cookies.token, require('../config').jwtSecret).sub; } catch (e) {}
  res.json({
    paths: paths.map((p) => {
      const cs = db.prepare('SELECT c.id, c.title_ar, c.title_en, c.icon, c.theme FROM path_courses pc JOIN courses c ON c.id = pc.course_id WHERE pc.path_id = ? ORDER BY pc.pos').all(p.id);
      let done = 0, total = 0;
      const courses = cs.map((c) => {
        const t = db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?').get(c.id).n;
        const d = uid ? db.prepare('SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ?').get(uid, c.id).n : 0;
        done += d; total += t; return { ...c, watched: d, total: t };
      });
      return { id: p.id, title: p.title, descr: p.descr, courses, pct: total ? Math.round((done / total) * 100) : 0 };
    }),
  });
});

// Leaderboard ("Lantern honor board"): light = 10 per watched lesson + exam percentage / 10
router.get('/leaderboard', authRequired, (req, res) => {
  if (getSetting('leaderboard_on', '1') !== '1') return res.json({ on: false, items: [] });
  const by = ['governorate', 'school'].includes(req.query.by) ? req.query.by : null;
  const me = db.prepare('SELECT governorate, school FROM users WHERE id = ?').get(req.user.id);
  const rows = db.prepare(`SELECT u.id, u.name, u.governorate, u.school,
      (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id) * 10 +
      COALESCE((SELECT SUM(b.p) FROM (SELECT MAX(CAST(score AS REAL) / MAX(total, 0.0001)) * 10 AS p FROM exam_attempts a WHERE a.user_id = u.id AND a.pending = 0 GROUP BY a.lesson_id) b), 0) AS light
    FROM users u WHERE u.role = 'student' AND u.banned = 0 ${by ? `AND u.${by} = ? AND u.${by} != ''` : ''} ORDER BY light DESC, u.id LIMIT 30`).all(...(by ? [me[by]] : []));
  res.json({ on: true, by: by || 'all', scope: by ? me[by] : '', me: req.user.id, items: rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, governorate: r.governorate, school: r.school, light: Math.round(r.light * 10) / 10 })) });
});

/* ================= notifications + reminders ================= */

function generateReminders(user) {
  if (user.role !== 'student') return;
  const now = Date.now();
  // exam reminders (24h before) and live session reminders (1h before)
  const exams = db.prepare(`SELECT l.id, l.title_ar, l.exam_open_at FROM lessons l JOIN enrollments e ON e.course_id = l.course_id AND e.user_id = ?
    WHERE l.exam_open_at IS NOT NULL`).all(user.id);
  for (const l of exams) {
    const t = Date.parse(l.exam_open_at);
    if (t > now && t - now < 86400e3) notify(user.id, 'تذكير بموعد امتحان', `امتحان "${l.title_ar}" هيفتح ${new Date(t).toLocaleString('ar-EG')}`, `#/exam/${l.id}`, 'exrem-' + l.id);
  }
  const lives = db.prepare(`SELECT s.* FROM live_sessions s JOIN enrollments e ON e.course_id = s.course_id AND e.user_id = ?`).all(user.id);
  for (const s of lives) {
    const t = Date.parse(s.starts_at);
    if (t > now && t - now <= 3600e3) notify(user.id, 'حصة لايف بعد أقل من ساعة', `"${s.title}" هتبدأ ${new Date(t).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`, '#/live', 'livrem-' + s.id);
  }
  // registered but never bought
  const u = db.prepare('SELECT created_at FROM users WHERE id = ?').get(user.id);
  const has = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ?').get(user.id) || db.prepare("SELECT 1 FROM course_requests WHERE user_id = ? AND status = 'pending'").get(user.id);
  if (!has && now - Date.parse(u.created_at + 'Z') > 3600e3) notify(user.id, 'لسه ما اشتركتش في كورس', 'اختار كورس وكمّل الاشتراك عشان تبدأ المذاكرة.', '#/courses', 'unpaid-1');
}

router.get('/notifications', authRequired, (req, res) => {
  generateReminders(req.user);
  const items = db.prepare('SELECT id, title, body, link, read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40').all(req.user.id);
  res.json({ items: items.map((i) => ({ ...i, read: !!i.read })), unread: items.filter((i) => !i.read).length });
});
router.post('/notifications/read', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

/* ================= lesson tools (notes, files, Q&A, stats, text helpers) ================= */

router.get('/lessons/:id/notes', authRequired, (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  res.json({ notes: db.prepare('SELECT id, sec, text FROM video_notes WHERE user_id = ? AND lesson_id = ? ORDER BY sec').all(req.user.id, l.id) });
});
router.post('/lessons/:id/notes', authRequired, validate(z.object({ sec: z.number().min(0).max(86400), text: z.string().trim().min(1).max(500) })), (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  const info = db.prepare('INSERT INTO video_notes (user_id, lesson_id, sec, text) VALUES (?, ?, ?, ?)').run(req.user.id, l.id, Math.floor(req.body.sec), req.body.text);
  res.status(201).json({ id: info.lastInsertRowid });
});
router.delete('/notes/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM video_notes WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

router.get('/lessons/:id/files', authRequired, (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  res.json({ files: db.prepare('SELECT id, orig_name, size FROM lesson_files WHERE lesson_id = ? ORDER BY id').all(l.id) });
});
router.get('/files/:id/download', authRequired, (req, res) => {
  const f = db.prepare('SELECT f.*, l.course_id FROM lesson_files f JOIN lessons l ON l.id = f.lesson_id WHERE f.id = ?').get(Number(req.params.id));
  if (!f || !canAccessCourse(req.user, f.course_id)) return res.status(404).json({ error: 'الملف غير موجود' });
  const p = path.join(filesDir, path.basename(f.stored));
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'الملف غير موجود' });
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.orig_name)}`);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Type', 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
router.post('/lessons/:id/files', authRequired, adminOnly, (req, res) => {
  fileUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'الملف أكبر من 25 ميجا' });
    const l = db.prepare('SELECT id FROM lessons WHERE id = ?').get(Number(req.params.id));
    if (!l || !req.file) return res.status(400).json({ error: 'الملف مطلوب' });
    const ext = (path.extname(req.file.originalname || '').toLowerCase() || '').replace(/[^.a-z0-9]/g, '');
    if (!['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.jpg', '.png', '.zip', '.xlsx'].includes(ext)) return res.status(400).json({ error: 'نوع الملف غير مسموح (PDF أو Word أو صور وما شابه)' });
    const stored = crypto.randomBytes(12).toString('hex') + ext;
    fs.writeFileSync(path.join(filesDir, stored), req.file.buffer);
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    db.prepare('INSERT INTO lesson_files (lesson_id, stored, orig_name, size) VALUES (?, ?, ?, ?)').run(l.id, stored, name.slice(0, 120), req.file.size);
    const les = db.prepare('SELECT title_ar, course_id FROM lessons WHERE id = ?').get(l.id);
    for (const e of db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(les.course_id)) notify(e.user_id, 'ملف جديد في درس', les.title_ar, `#/watch/${l.id}`, 'file-' + stored);
    logAct(req.user, 'رفع ملف لدرس', les.title_ar);
    res.status(201).json({ ok: true });
  });
});
router.delete('/files/:id', authRequired, adminOnly, (req, res) => {
  const f = db.prepare('SELECT * FROM lesson_files WHERE id = ?').get(Number(req.params.id));
  if (f) { try { fs.unlinkSync(path.join(filesDir, path.basename(f.stored))); } catch (e) {} db.prepare('DELETE FROM lesson_files WHERE id = ?').run(f.id); }
  res.json({ ok: true });
});

// lesson Q&A (moderators can answer without seeing revenue)
router.get('/lessons/:id/questions', authRequired, (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  const rows = db.prepare(`SELECT q.id, q.text, q.answer, q.answered_by, q.created_at, u.name FROM lesson_questions q JOIN users u ON u.id = q.user_id WHERE q.lesson_id = ? ${isStaff(req.user) ? '' : 'AND (q.user_id = ? OR q.answer IS NOT NULL)'} ORDER BY q.id DESC LIMIT 50`).all(...(isStaff(req.user) ? [l.id] : [l.id, req.user.id]));
  res.json({ questions: rows });
});
router.post('/lessons/:id/questions', authRequired, validate(z.object({ text: z.string().trim().min(3).max(600) })), (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  db.prepare('INSERT INTO lesson_questions (lesson_id, user_id, text) VALUES (?, ?, ?)').run(l.id, req.user.id, req.body.text);
  res.status(201).json({ ok: true });
});
router.get('/mod/questions', authRequired, staffOnly, (req, res) => {
  res.json({ questions: db.prepare(`SELECT q.id, q.text, q.answer, q.created_at, u.name, l.title_ar AS lesson FROM lesson_questions q JOIN users u ON u.id = q.user_id JOIN lessons l ON l.id = q.lesson_id ORDER BY (q.answer IS NOT NULL), q.id DESC LIMIT 60`).all() });
});
router.post('/mod/questions/:id/answer', authRequired, staffOnly, validate(z.object({ answer: z.string().trim().min(1).max(1500) })), (req, res) => {
  const q = db.prepare('SELECT * FROM lesson_questions WHERE id = ?').get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });
  db.prepare("UPDATE lesson_questions SET answer = ?, answered_by = ?, answered_at = datetime('now') WHERE id = ?").run(req.body.answer, req.user.name, q.id);
  notify(q.user_id, 'تم الرد على سؤالك', req.body.answer.slice(0, 80), `#/watch/${q.lesson_id}`);
  logAct(req.user, 'رد على سؤال طالب', '');
  res.json({ ok: true });
});

// watch statistics (average watch time, where students stop)
router.post('/lessons/:id/watch', authRequired, validate(z.object({ pos: z.number().min(0), dur: z.number().min(0), delta: z.number().min(0).max(120) })), (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  if (isStaff(req.user)) return res.json({ ok: true });
  db.prepare(`INSERT INTO watch_stats (user_id, lesson_id, watch_sec, max_sec, last_sec, dur) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET watch_sec = watch_sec + excluded.watch_sec, max_sec = MAX(max_sec, excluded.max_sec), last_sec = excluded.last_sec, dur = excluded.dur, updated_at = datetime('now')`)
    .run(req.user.id, l.id, req.body.delta, req.body.pos, req.body.pos, req.body.dur);
  res.json({ ok: true });
});
router.get('/lessons/:id/resume', authRequired, (req, res) => {
  const w = db.prepare('SELECT last_sec FROM watch_stats WHERE user_id = ? AND lesson_id = ?').get(req.user.id, Number(req.params.id));
  res.json({ sec: w ? w.last_sec : 0 });
});

// ---- rule-based text helpers (NOT real AI): extractive summary, keyword assistant, cloze practice questions ----
const sentences = (t) => String(t).split(/(?<=[.!؟?\n])\s+/).map((s) => s.trim()).filter((s) => s.length > 15);
function summarize(text, n = 3) {
  const ss = sentences(text); if (ss.length <= n) return ss;
  const freq = {}; for (const w of words(text)) freq[w] = (freq[w] || 0) + 1;
  return ss.map((s, i) => ({ s, i, sc: words(s).reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(words(s).length || 1) }))
    .sort((a, b) => b.sc - a.sc).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}
router.get('/lessons/:id/summary', authRequired, (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  if (!l.notes.trim()) return res.json({ has: false });
  res.json({ has: true, summary: summarize(l.notes, 3), method: 'extractive' });
});
router.post('/lessons/:id/ask', authRequired, validate(z.object({ text: z.string().trim().min(2).max(300) })), (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  const qw = new Set(words(req.body.text));
  const hits = sentences(l.notes).map((s) => ({ s, sc: words(s).filter((w) => qw.has(w)).length })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 2);
  res.json({ found: hits.length > 0, answer: hits.map((h) => h.s), note: 'مساعد بسيط بيدور في ملخص الدرس بالكلمات المفتاحية، مش ذكاء اصطناعي حقيقي.' });
});
router.get('/lessons/:id/practice', authRequired, (req, res) => {
  const l = lessonAccess(req, res); if (!l) return;
  const ss = sentences(l.notes); const all = [...new Set(words(l.notes).filter((w) => w.length > 3))];
  const out = [];
  for (const s of ss) {
    const cand = s.split(/\s+/).filter((w) => w.length > 3 && all.includes(norm(w).trim().split(/\s+/)[0] || ''));
    if (!cand.length || all.length < 4) continue;
    const key = cand.sort((a, b) => b.length - a.length)[0];
    const wrong = all.filter((w) => w !== norm(key).trim()).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [key.replace(/[^\p{L}\p{N}]/gu, ''), ...wrong].sort(() => Math.random() - 0.5);
    out.push({ q: s.replace(key, '_____'), options: opts, answer: key.replace(/[^\p{L}\p{N}]/gu, '') });
    if (out.length >= 5) break;
  }
  res.json({ questions: out, method: 'template' });
});

/* ================= coupons / refunds / invoices ================= */

function couponFor(code, courseId) {
  const c = db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').get(String(code || '').trim());
  if (!c || !c.active) return { error: 'كود الخصم غير صحيح' };
  const now = Date.now();
  if (c.starts_at && now < Date.parse(c.starts_at)) return { error: 'كود الخصم لم يبدأ بعد' };
  if (c.ends_at && now > Date.parse(c.ends_at)) return { error: 'كود الخصم منتهي' };
  if (c.course_id && c.course_id !== courseId) return { error: 'الكود ده لكورس تاني' };
  if (c.max_uses && c.used >= c.max_uses) return { error: 'كود الخصم استُخدم بالكامل' };
  return { c };
}
router.post('/coupons/check', authRequired, validate(z.object({ code: z.string().max(40), courseId: z.number().int() })), (req, res) => {
  const course = db.prepare('SELECT price FROM courses WHERE id = ?').get(req.body.courseId);
  if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });
  const r = couponFor(req.body.code, req.body.courseId);
  if (r.error) return res.status(400).json({ error: r.error });
  const base = priceNum(course.price);
  res.json({ percent: r.c.percent, base, final: Math.round(base * (100 - r.c.percent)) / 100 });
});

router.post('/refunds', authRequired, validate(z.object({ courseId: z.number().int(), reason: z.string().trim().min(3).max(500) })), (req, res) => {
  if (!db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, req.body.courseId)) return res.status(400).json({ error: 'الكورس مش مفتوح لحسابك' });
  if (db.prepare("SELECT 1 FROM refunds WHERE user_id = ? AND course_id = ? AND status = 'pending'").get(req.user.id, req.body.courseId)) return res.status(409).json({ error: 'عندك طلب استرداد قيد المراجعة' });
  db.prepare('INSERT INTO refunds (user_id, course_id, reason) VALUES (?, ?, ?)').run(req.user.id, req.body.courseId, req.body.reason);
  res.status(201).json({ ok: true });
});
router.get('/refunds/mine', authRequired, (req, res) => {
  res.json({ refunds: db.prepare('SELECT r.id, r.status, r.reason, r.created_at, c.title_ar FROM refunds r JOIN courses c ON c.id = r.course_id WHERE r.user_id = ? ORDER BY r.id DESC').all(req.user.id) });
});

router.get('/invoices/mine', authRequired, (req, res) => {
  res.json({ invoices: db.prepare(`SELECT r.id, r.decided_at, r.amount, r.method, c.title_ar, c.price FROM course_requests r JOIN courses c ON c.id = r.course_id WHERE r.user_id = ? AND r.status = 'approved' ORDER BY r.id DESC`).all(req.user.id).map((r) => ({ ...r, no: 'NUR-' + String(r.id).padStart(5, '0'), amount: r.amount || priceNum(r.price) })) });
});
router.get('/invoices/:id', authRequired, (req, res) => {
  const r = db.prepare(`SELECT r.*, c.title_ar, c.price, u.name, u.email FROM course_requests r JOIN courses c ON c.id = r.course_id JOIN users u ON u.id = r.user_id WHERE r.id = ? AND r.status = 'approved'`).get(Number(req.params.id));
  if (!r || (r.user_id !== req.user.id && !isAdmin(req.user))) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  const base = priceNum(r.price);
  res.json({ no: 'NUR-' + String(r.id).padStart(5, '0'), date: (r.decided_at || r.created_at).slice(0, 10), student: r.name, email: r.email, course: r.title_ar, method: r.method === 'wallet' ? 'محفظة إلكترونية' : 'إنستا باي', base, coupon: r.coupon_code, amount: r.amount || base, discount: Math.round((base - (r.amount || base)) * 100) / 100 });
});

/* ================= certificates / grade sheet ================= */

function courseCompletion(uid, cid) {
  const lessons = db.prepare('SELECT id FROM lessons WHERE course_id = ?').all(cid);
  if (!lessons.length) return { done: false, pct: 0 };
  const watched = db.prepare('SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ?').get(uid, cid).n;
  let allPassed = true, sum = 0, n = 0;
  for (const l of lessons) {
    if (!db.prepare('SELECT 1 FROM exam_questions WHERE lesson_id = ? LIMIT 1').get(l.id)) continue;
    const b = db.prepare('SELECT MAX(CAST(score AS REAL) / MAX(total, 0.0001)) AS p FROM exam_attempts WHERE user_id = ? AND lesson_id = ? AND pending = 0').get(uid, l.id);
    const p = b && b.p != null ? b.p * 100 : null;
    if (p === null || p < 50) allPassed = false; else { sum += p; n += 1; }
  }
  return { done: watched >= lessons.length && allPassed, watched, total: lessons.length, pct: n ? Math.round(sum / n) : 0 };
}
router.get('/certificates/mine', authRequired, (req, res) => {
  const rows = db.prepare('SELECT ce.code, ce.kind, ce.pct, ce.created_at, c.title_ar, c.id AS course_id FROM certificates ce JOIN courses c ON c.id = ce.course_id WHERE ce.user_id = ? ORDER BY ce.id DESC').all(req.user.id);
  const eligible = db.prepare('SELECT c.id, c.title_ar FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ?').all(req.user.id)
    .map((c) => ({ ...c, ...courseCompletion(req.user.id, c.id) })).filter((c) => c.done && !rows.some((r) => r.course_id === c.id && r.kind === 'completion'));
  res.json({ certificates: rows, eligible });
});
router.post('/courses/:id/certificate', authRequired, async (req, res) => {
  const cid = Number(req.params.id);
  if (!canAccessCourse(req.user, cid)) return res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' });
  const st = courseCompletion(req.user.id, cid);
  if (!st.done) return res.status(400).json({ error: 'لازم تخلص كل دروس الكورس وتنجح في كل الامتحانات الأول' });
  const out = [];
  const mk = (kind) => {
    let c = db.prepare('SELECT code FROM certificates WHERE user_id = ? AND course_id = ? AND kind = ?').get(req.user.id, cid, kind);
    if (!c) {
      const code = crypto.randomBytes(5).toString('hex').toUpperCase();
      db.prepare('INSERT INTO certificates (code, user_id, course_id, kind, pct) VALUES (?, ?, ?, ?, ?)').run(code, req.user.id, cid, kind, st.pct);
      notify(req.user.id, kind === 'excellence' ? 'شهادة تفوق جديدة' : 'شهادة إتمام جديدة', '', '#/student', 'cert-' + code);
      c = { code };
    }
    out.push({ code: c.code, kind });
  };
  mk('completion');
  if (st.pct >= 90) mk('excellence'); // certificate of excellence for top performers (90%+ average)
  res.json({ certificates: out });
});
router.get('/certificates/:code/data', authRequired, async (req, res) => {
  const c = db.prepare(`SELECT ce.*, u.name AS student, co.title_ar AS course FROM certificates ce JOIN users u ON u.id = ce.user_id JOIN courses co ON co.id = ce.course_id WHERE ce.code = ?`).get(String(req.params.code).slice(0, 40));
  if (!c || (c.user_id !== req.user.id && !isAdmin(req.user))) return res.status(404).json({ error: 'الشهادة غير موجودة' });
  const base = req.protocol + '://' + req.get('host');
  const qr = await QRCode.toDataURL(`${base}/#/verify/${c.code}`, { margin: 1, width: 220, color: { dark: '#1a2a4a', light: '#ffffff' } });
  res.json({ code: c.code, kind: c.kind, student: c.student, course: c.course, pct: c.pct, date: c.created_at.slice(0, 10), qr, verifyUrl: `${base}/#/verify/${c.code}` });
});

function gradeSheet(uid) {
  const u = db.prepare('SELECT id, name, email, governorate, school FROM users WHERE id = ?').get(uid);
  const courses = db.prepare('SELECT c.id, c.title_ar FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY c.id').all(uid);
  return {
    student: u, date: new Date().toISOString().slice(0, 10),
    courses: courses.map((c) => ({
      title: c.title_ar, ...(() => { const s = courseCompletion(uid, c.id); return { watched: s.watched, total: s.total }; })(),
      exams: db.prepare(`SELECT l.title_ar AS lesson, MAX(CAST(a.score AS REAL) / MAX(a.total, 0.0001)) AS p, COUNT(*) AS tries, MAX(a.pending) AS pending FROM exam_attempts a JOIN lessons l ON l.id = a.lesson_id WHERE a.user_id = ? AND l.course_id = ? GROUP BY l.id ORDER BY l.position`).all(uid, c.id).map((e) => ({ lesson: e.lesson, pct: Math.round(e.p * 100), tries: e.tries, pending: !!e.pending })),
    })),
  };
}
router.get('/my/gradesheet', authRequired, (req, res) => res.json(gradeSheet(req.user.id)));

/* ================= parent mode ================= */

router.post('/parent/link', authRequired, validate(z.object({ phone: z.string().trim().max(20).optional() })), (req, res) => {
  const u = db.prepare('SELECT parent_token FROM users WHERE id = ?').get(req.user.id);
  const tok = u.parent_token || crypto.randomBytes(12).toString('hex');
  db.prepare('UPDATE users SET parent_token = ?, parent_phone = COALESCE(?, parent_phone) WHERE id = ?').run(tok, seal(req.body.phone ?? null), req.user.id);
  res.json({ token: tok });
});
router.post('/parent/revoke', authRequired, (req, res) => { db.prepare('UPDATE users SET parent_token = NULL WHERE id = ?').run(req.user.id); res.json({ ok: true }); });
router.get('/parent/:token', (req, res) => {
  const u = db.prepare("SELECT id, name FROM users WHERE parent_token = ? AND role = 'student'").get(String(req.params.token).slice(0, 60));
  if (!u) return res.status(404).json({ error: 'رابط ولي الأمر غير صالح' });
  const gs = gradeSheet(u.id);
  const week = db.prepare("SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id = ? AND watched_at >= datetime('now', '-7 days')").get(u.id);
  const missed = db.prepare(`SELECT l.title_ar FROM lessons l JOIN enrollments e ON e.course_id = l.course_id AND e.user_id = ? WHERE l.exam_close_at IS NOT NULL AND l.exam_close_at < datetime('now') AND NOT EXISTS (SELECT 1 FROM exam_attempts a WHERE a.user_id = ? AND a.lesson_id = l.id)`).all(u.id, u.id).map((r) => r.title_ar);
  res.json({ name: u.name, courses: gs.courses, lessonsThisWeek: week ? week.n : 0, missedExams: missed });
});

router.post('/profile', authRequired, validate(z.object({ governorate: z.string().trim().max(40).optional(), school: z.string().trim().max(80).optional(), parentPhone: z.string().trim().max(20).optional() })), (req, res) => {
  const b = req.body;
  db.prepare('UPDATE users SET governorate = COALESCE(?, governorate), school = COALESCE(?, school), parent_phone = COALESCE(?, parent_phone) WHERE id = ?').run(b.governorate ?? null, b.school ?? null, seal(b.parentPhone ?? null), req.user.id);
  res.json({ ok: true });
});
router.get('/profile', authRequired, (req, res) => {
  const u = db.prepare('SELECT governorate, school, parent_phone, parent_token FROM users WHERE id = ?').get(req.user.id);
  res.json({ governorate: u.governorate, school: u.school, parentPhone: open(u.parent_phone), parentToken: u.parent_token });
});
/* ================= devices ================= */
router.get('/devices', authRequired, (req, res) => {
  res.json({ devices: db.prepare('SELECT id, ua, first_seen, last_seen FROM devices WHERE user_id = ? ORDER BY id').all(req.user.id), max: 2 });
});

/* ================= live sessions (students) ================= */
router.get('/live', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT s.*, c.title_ar AS course FROM live_sessions s JOIN courses c ON c.id = s.course_id ${isStaff(req.user) ? '' : 'JOIN enrollments e ON e.course_id = s.course_id AND e.user_id = ?'} ORDER BY s.starts_at`).all(...(isStaff(req.user) ? [] : [req.user.id]));
  const now = Date.now();
  res.json({ sessions: rows.map((s) => {
    const t = Date.parse(s.starts_at); const open = now >= t - 5 * 60e3 && now <= t + (s.duration_min + 30) * 60e3;
    return { id: s.id, title: s.title, course: s.course, startsAt: s.starts_at, durationMin: s.duration_min, open, ended: now > t + s.duration_min * 60e3, link: open || isAdmin(req.user) ? s.link : null, recording: s.recording || null };
  }) });
});

module.exports = router;
module.exports.courseCompletion = courseCompletion;
module.exports.gradeSheet = gradeSheet;
module.exports.couponFor = couponFor;
