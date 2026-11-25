const express = require('express');
const { open } = require('../lib/vault');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { notify, logAct, getSetting, setSetting, priceNum } = require('../lib/util');
const { courseCompletion, gradeSheet } = require('./features');
const { correctText } = require('./exams');

const router = express.Router();
router.use(authRequired, requireRole('admin'));
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// Activity log: every successful change made by an admin is recorded automatically
const LABELS = [
  [/^POST \/students\/\d+\/active/, 'تفعيل/تعطيل حساب طالب'], [/^POST \/students\/\d+\/courses/, 'فتح/قفل كورس لطالب'],
  [/^POST \/requests\/\d+\/decide/, 'قرار في طلب اشتراك'], [/^POST \/courses\/\d+\/lessons/, 'رفع درس جديد'],
  [/^POST \/courses$/, 'إنشاء كورس'], [/^PUT \/courses/, 'تعديل كورس'], [/^DELETE \/courses/, 'حذف كورس'],
  [/^PUT \/lessons\/\d+\/exam/, 'تعديل امتحان'], [/^POST \/settings/, 'تعديل إعدادات الدفع'], [/^DELETE \/lessons/, 'حذف درس'],
  [/^POST \/lessons\/\d+\/video/, 'استبدال فيديو درس'],
];
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const key = `${req.method} ${req.path}`; const hit = LABELS.find(([re]) => re.test(key));
    if (hit) logAct(req.user, hit[1], key);
  });
  next();
});

/* ---- dashboard ---- */
router.get('/stats', (req, res) => {
  const appr = db.prepare(`SELECT r.id, r.amount, r.decided_at, r.course_id, c.title_ar, c.price FROM course_requests r JOIN courses c ON c.id = r.course_id WHERE r.status = 'approved'`).all();
  const amt = (r) => r.amount || priceNum(r.price);
  const refunded = db.prepare("SELECT COUNT(*) AS n FROM refunds WHERE status = 'approved'").get().n;
  const byCourse = {};
  for (const r of appr) { const b = byCourse[r.course_id] || (byCourse[r.course_id] = { title: r.title_ar, sales: 0, revenue: 0 }); b.sales += 1; b.revenue += amt(r); }
  const list = Object.values(byCourse).sort((a, b) => b.revenue - a.revenue);
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ day: d, revenue: appr.filter((r) => (r.decided_at || '').slice(0, 10) === d).reduce((a, r) => a + amt(r), 0), signups: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='student' AND substr(created_at,1,10) = ?").get(d).n }); }
  res.json({
    revenue: appr.reduce((a, r) => a + amt(r), 0), sales: appr.length, refunds: refunded,
    bestCourse: list[0] || null, byCourse: list,
    students: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='student'").get().n,
    activeStudents: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='student' AND last_seen >= datetime('now','-7 days')").get().n,
    pending: db.prepare("SELECT COUNT(*) AS n FROM course_requests WHERE status='pending'").get().n,
    days,
  });
});

/* ---- coupons ---- */
router.get('/coupons', (req, res) => res.json({ coupons: db.prepare('SELECT co.*, c.title_ar AS course FROM coupons co LEFT JOIN courses c ON c.id = co.course_id ORDER BY co.id DESC').all() }));
router.post('/coupons', validate(z.object({ code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/), percent: z.number().int().min(1).max(100), courseId: z.number().int().nullable().optional(), startsAt: z.string().nullable().optional(), endsAt: z.string().nullable().optional(), maxUses: z.number().int().min(1).nullable().optional() })), (req, res) => {
  const b = req.body;
  try { db.prepare('INSERT INTO coupons (code, percent, course_id, starts_at, ends_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)').run(b.code.toUpperCase(), b.percent, b.courseId || null, b.startsAt || null, b.endsAt || null, b.maxUses || null); }
  catch (e) { return res.status(409).json({ error: 'الكود موجود بالفعل' }); }
  logAct(req.user, 'إنشاء كود خصم', b.code); res.status(201).json({ ok: true });
});
router.delete('/coupons/:id', (req, res) => { db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id)); logAct(req.user, 'حذف كود خصم', ''); res.json({ ok: true }); });

/* ---- live sessions ---- */
router.get('/live', (req, res) => res.json({ sessions: db.prepare('SELECT s.*, c.title_ar AS course FROM live_sessions s JOIN courses c ON c.id = s.course_id ORDER BY s.starts_at DESC').all() }));
router.post('/live', validate(z.object({ courseId: z.number().int(), title: z.string().trim().min(2).max(120), startsAt: z.string().min(8), durationMin: z.number().int().min(5).max(600).default(60), link: z.string().url().max(300) })), (req, res) => {
  const b = req.body; if (!/^https?:\/\//.test(b.link)) return res.status(400).json({ error: 'الرابط لازم يبدأ بـ http' });
  db.prepare('INSERT INTO live_sessions (course_id, title, starts_at, duration_min, link) VALUES (?, ?, ?, ?, ?)').run(b.courseId, b.title, b.startsAt, b.durationMin, b.link);
  for (const e of db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(b.courseId)) notify(e.user_id, 'حصة لايف جديدة', b.title, '#/live');
  logAct(req.user, 'جدولة حصة لايف', b.title); res.status(201).json({ ok: true });
});
router.post('/live/:id/recording', validate(z.object({ link: z.string().url().max(300) })), (req, res) => {
  db.prepare('UPDATE live_sessions SET recording = ? WHERE id = ?').run(req.body.link, Number(req.params.id));
  const s = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(Number(req.params.id));
  if (s) for (const e of db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(s.course_id)) notify(e.user_id, 'تسجيل الحصة متاح', s.title, '#/live', 'rec-' + s.id);
  res.json({ ok: true });
});
router.delete('/live/:id', (req, res) => { db.prepare('DELETE FROM live_sessions WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

/* ---- refunds ---- */
router.get('/refunds', (req, res) => res.json({ refunds: db.prepare(`SELECT r.*, u.name, c.title_ar FROM refunds r JOIN users u ON u.id = r.user_id JOIN courses c ON c.id = r.course_id ORDER BY (r.status != 'pending'), r.id DESC`).all() }));
router.post('/refunds/:id/decide', validate(z.object({ approve: z.boolean() })), (req, res) => {
  const r = db.prepare('SELECT * FROM refunds WHERE id = ?').get(Number(req.params.id));
  if (!r || r.status !== 'pending') return res.status(409).json({ error: 'تم البت في الطلب' });
  db.prepare("UPDATE refunds SET status = ?, decided_at = datetime('now') WHERE id = ?").run(req.body.approve ? 'approved' : 'rejected', r.id);
  if (req.body.approve) db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(r.user_id, r.course_id);
  notify(r.user_id, req.body.approve ? 'تمت الموافقة على الاسترداد' : 'تم رفض طلب الاسترداد', 'الاسترداد بيتم يدوياً على نفس وسيلة الدفع.', '#/student');
  logAct(req.user, req.body.approve ? 'موافقة على استرداد' : 'رفض استرداد', ''); res.json({ ok: true });
});

/* ---- students: ban, moderator, devices, import, report ---- */
router.post('/students/:id/ban', validate(z.object({ banned: z.boolean(), reason: z.string().trim().max(200).optional().default('') })), (req, res) => {
  const r = db.prepare("UPDATE users SET banned = ?, ban_reason = ? WHERE id = ? AND role = 'student'").run(req.body.banned ? 1 : 0, req.body.banned ? req.body.reason : '', Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'الطالب غير موجود' });
  logAct(req.user, req.body.banned ? 'إيقاف طالب' : 'إلغاء إيقاف طالب', req.body.reason); res.json({ ok: true });
});
router.post('/students/:id/mod', validate(z.object({ mod: z.boolean() })), (req, res) => {
  db.prepare("UPDATE users SET is_mod = ? WHERE id = ? AND role = 'student'").run(req.body.mod ? 1 : 0, Number(req.params.id));
  logAct(req.user, req.body.mod ? 'تعيين مشرف' : 'إلغاء مشرف', ''); res.json({ ok: true });
});
router.get('/students/:id/devices', (req, res) => res.json({ devices: db.prepare('SELECT id, ua, first_seen, last_seen FROM devices WHERE user_id = ? ORDER BY id').all(Number(req.params.id)) }));
router.post('/students/:id/devices/reset', (req, res) => { db.prepare('DELETE FROM devices WHERE user_id = ?').run(Number(req.params.id)); logAct(req.user, 'إعادة ضبط أجهزة طالب', ''); res.json({ ok: true }); });
router.get('/students/:id/gradesheet', (req, res) => res.json(gradeSheet(Number(req.params.id))));
router.get('/students-extra', (req, res) => {
  res.json({ students: db.prepare("SELECT id, banned, ban_reason, is_mod, governorate, school, parent_phone, last_seen, (SELECT COUNT(*) FROM devices d WHERE d.user_id = users.id) AS devices FROM users WHERE role = 'student'").all().map((r) => ({ ...r, parent_phone: open(r.parent_phone) })) });
});

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
// Bulk import from a CSV file (Excel: File > Save As > CSV). Columns: name, email, [password], [governorate], [school]
router.post('/students/import', express.json({ limit: '1mb' }), validate(z.object({ csv: z.string().max(900000) })), (req, res) => {
  const rows = parseCsv(req.body.csv.replace(/^\uFEFF/, ''));
  if (rows.length && /name|اسم/i.test(rows[0][0] || '') ) rows.shift();
  const created = [], skipped = [];
  for (const r of rows.slice(0, 500)) {
    const [name, email, pw, gov, school] = r.map((c) => (c || '').trim());
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) { skipped.push({ row: r.join(' | '), why: 'بيانات ناقصة' }); continue; }
    if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) { skipped.push({ row: email, why: 'الإيميل موجود' }); continue; }
    const password = pw && pw.length >= 8 ? pw : 'Noor' + crypto.randomInt(100000, 999999);
    db.prepare("INSERT INTO users (name, email, password_hash, role, active, governorate, school) VALUES (?, ?, ?, 'student', 1, ?, ?)").run(name, email.toLowerCase(), bcrypt.hashSync(password, 10), gov || '', school || '');
    created.push({ name, email, password });
  }
  logAct(req.user, 'استيراد طلاب من ملف', `${created.length} طالب`);
  res.json({ created, skipped });
});

const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
router.get('/report.csv', (req, res) => {
  const rows = db.prepare("SELECT u.id, u.name, u.email, u.governorate, u.school FROM users u WHERE u.role = 'student' ORDER BY u.id").all();
  const out = [['الاسم', 'الإيميل', 'المحافظة', 'الكورس', 'دروس مكتملة', 'إجمالي الدروس', 'متوسط الامتحانات %', 'عدد المحاولات']];
  for (const u of rows) {
    const cs = db.prepare('SELECT c.id, c.title_ar FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ?').all(u.id);
    if (!cs.length) out.push([u.name, u.email, u.governorate, '-', 0, 0, '', 0]);
    for (const c of cs) { const s = courseCompletion(u.id, c.id); out.push([u.name, u.email, u.governorate, c.title_ar, s.watched, s.total, s.pct || '', db.prepare('SELECT COUNT(*) AS n FROM exam_attempts a JOIN lessons l ON l.id = a.lesson_id WHERE a.user_id = ? AND l.course_id = ?').get(u.id, c.id).n]); }
  }
  res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="noor-report.csv"');
  res.send('\uFEFF' + out.map((r) => r.map(csvCell).join(',')).join('\r\n'));
});
router.get('/report', (req, res) => {
  const rows = db.prepare("SELECT u.id, u.name, u.governorate FROM users u WHERE u.role = 'student' ORDER BY u.id").all();
  const items = [];
  for (const u of rows) for (const c of db.prepare('SELECT c.id, c.title_ar FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ?').all(u.id)) { const s = courseCompletion(u.id, c.id); items.push({ student: u.name, governorate: u.governorate, course: c.title_ar, watched: s.watched, total: s.total, avg: s.pct }); }
  res.json({ items });
});

/* ---- grading essays, absentees, lesson analytics ---- */
router.get('/grading', (req, res) => {
  const rows = db.prepare(`SELECT a.id, a.detail, a.created_at, u.name, l.title_ar AS lesson FROM exam_attempts a JOIN users u ON u.id = a.user_id JOIN lessons l ON l.id = a.lesson_id WHERE a.pending = 1 ORDER BY a.id`).all();
  res.json({ attempts: rows.map((r) => ({ id: r.id, student: r.name, lesson: r.lesson, created_at: r.created_at, essays: parse(r.detail, []).filter((d) => d.type === 'essay').map((d) => ({ id: d.id, q: d.q, points: d.points, your: d.your })) })) });
});
router.post('/attempts/:id/grade', validate(z.object({ points: z.record(z.string(), z.number().min(0).max(10)), comment: z.string().trim().max(500).optional().default('') })), (req, res) => {
  const a = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'المحاولة غير موجودة' });
  const detail = parse(a.detail, []); let score = 0;
  for (const d of detail) {
    if (d.type === 'essay') { const p = Math.min(req.body.points[String(d.id)] ?? 0, d.points); d.got = p; d.right = p >= d.points / 2; d.pending = false; }
    score += d.got || 0;
  }
  db.prepare('UPDATE exam_attempts SET detail = ?, score = ?, pending = 0, feedback = ? WHERE id = ?').run(JSON.stringify(detail), score, req.body.comment, a.id);
  const l = db.prepare('SELECT title_ar FROM lessons WHERE id = ?').get(a.lesson_id);
  notify(a.user_id, 'تم تصحيح امتحانك', `${l.title_ar}: ${score} من ${a.total}` + (req.body.comment ? ' - ' + req.body.comment.slice(0, 60) : ''), `#/exam/${a.lesson_id}`);
  logAct(req.user, 'تصحيح أسئلة مقالية', l.title_ar); res.json({ ok: true, score });
});
router.get('/absentees', (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.name, u.parent_phone, l.title_ar AS lesson, l.id AS lid FROM lessons l JOIN enrollments e ON e.course_id = l.course_id JOIN users u ON u.id = e.user_id
    WHERE l.exam_close_at IS NOT NULL AND l.exam_close_at < ? AND u.role = 'student' AND NOT EXISTS (SELECT 1 FROM exam_attempts a WHERE a.user_id = u.id AND a.lesson_id = l.id) ORDER BY l.id DESC LIMIT 100`).all(new Date().toISOString());
  res.json({ items: rows.map((r) => ({ ...r, parent_phone: open(r.parent_phone) })) });
});
router.get('/lessons/:id/analytics', (req, res) => {
  const id = Number(req.params.id);
  const ws = db.prepare('SELECT watch_sec, max_sec, dur FROM watch_stats WHERE lesson_id = ?').all(id);
  const dur = Math.max(...ws.map((w) => w.dur), 0);
  const buckets = Array(10).fill(0);
  for (const w of ws) if (w.dur > 0) buckets[Math.min(9, Math.floor((w.max_sec / w.dur) * 10))] += 1; // where each student stopped
  res.json({ viewers: ws.length, avgWatchSec: ws.length ? Math.round(ws.reduce((a, w) => a + w.watch_sec, 0) / ws.length) : 0, durSec: Math.round(dur), stopBuckets: buckets,
    questionStats: db.prepare('SELECT COUNT(*) AS n FROM exam_attempts WHERE lesson_id = ?').get(id).n });
});
router.put('/lessons/:id/notes', validate(z.object({ notes: z.string().max(20000) })), (req, res) => {
  db.prepare('UPDATE lessons SET notes = ? WHERE id = ?').run(req.body.notes, Number(req.params.id)); res.json({ ok: true });
});
router.get('/lessons/:id/notes', (req, res) => { const l = db.prepare('SELECT notes FROM lessons WHERE id = ?').get(Number(req.params.id)); res.json({ notes: l ? l.notes : '' }); });
router.post('/courses/:id/sequential', validate(z.object({ on: z.boolean() })), (req, res) => {
  db.prepare('UPDATE courses SET sequential = ? WHERE id = ?').run(req.body.on ? 1 : 0, Number(req.params.id)); logAct(req.user, req.body.on ? 'تفعيل قفل ترتيب الدروس' : 'إلغاء قفل ترتيب الدروس', ''); res.json({ ok: true });
});
router.get('/courses-flags', (req, res) => res.json({ courses: db.prepare('SELECT id, sequential FROM courses').all().map((c) => ({ id: c.id, sequential: !!c.sequential })) }));

/* ---- site: activity log, backup, maintenance, theme, leaderboard toggle ---- */
router.get('/activity', (req, res) => res.json({ items: db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 80').all() }));
router.get('/backup', async (req, res) => {
  const tmp = path.join(require('os').tmpdir(), `noor-backup-${Date.now()}.sqlite`);
  try {
    await db.backup(tmp);
    logAct(req.user, 'نسخة احتياطية من قاعدة البيانات', '');
    res.download(tmp, `noor-backup-${new Date().toISOString().slice(0, 10)}.sqlite`, () => fs.unlink(tmp, () => {}));
  } catch (e) { res.status(500).json({ error: 'فشل إنشاء النسخة الاحتياطية' }); }
});
router.get('/site-settings', (req, res) => res.json({ maintenance: getSetting('maintenance_on', '0') === '1', maintenanceMsg: getSetting('maintenance_msg', ''), primary: getSetting('theme_primary', ''), accent: getSetting('theme_accent', ''), leaderboardOn: getSetting('leaderboard_on', '1') === '1', hasLogo: !!getSetting('logo_file', '') }));
const HEX = /^#[0-9a-fA-F]{6}$/;
router.post('/site-settings', validate(z.object({ maintenance: z.boolean().optional(), maintenanceMsg: z.string().max(300).optional(), primary: z.string().regex(HEX).or(z.literal('')).optional(), accent: z.string().regex(HEX).or(z.literal('')).optional(), leaderboardOn: z.boolean().optional() })), (req, res) => {
  const b = req.body;
  if (b.maintenance !== undefined) setSetting('maintenance_on', b.maintenance ? '1' : '0');
  if (b.maintenanceMsg !== undefined) setSetting('maintenance_msg', b.maintenanceMsg);
  if (b.primary !== undefined) setSetting('theme_primary', b.primary);
  if (b.accent !== undefined) setSetting('theme_accent', b.accent);
  if (b.leaderboardOn !== undefined) setSetting('leaderboard_on', b.leaderboardOn ? '1' : '0');
  logAct(req.user, 'تعديل إعدادات الموقع', ''); res.json({ ok: true });
});
const logoUp = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.post('/logo', (req, res) => logoUp.single('logo')(req, res, (err) => {
  if (err || !req.file) return res.status(400).json({ error: 'اختار صورة (حد أقصى 2 ميجا)' });
  const b = req.file.buffer; const ext = b[0] === 0xff ? 'jpg' : b.slice(1, 4).toString() === 'PNG' ? 'png' : b.slice(0, 4).toString() === 'RIFF' ? 'webp' : null;
  if (!ext) return res.status(400).json({ error: 'JPG أو PNG أو WebP فقط' });
  const dir = path.join(__dirname, '..', 'uploads', 'covers'); fs.mkdirSync(dir, { recursive: true });
  const name = `logo-${Date.now()}.${ext}`; fs.writeFileSync(path.join(dir, name), b); setSetting('logo_file', name);
  logAct(req.user, 'تغيير الشعار', ''); res.json({ ok: true });
}));
router.delete('/logo', (req, res) => { setSetting('logo_file', ''); res.json({ ok: true }); });

/* ---- paths + faq + broadcast ---- */
router.get('/paths', (req, res) => res.json({ paths: db.prepare('SELECT * FROM paths').all().map((p) => ({ ...p, courseIds: db.prepare('SELECT course_id FROM path_courses WHERE path_id = ? ORDER BY pos').all(p.id).map((r) => r.course_id) })) }));
router.post('/paths', validate(z.object({ title: z.string().trim().min(2).max(100), descr: z.string().max(300).optional().default(''), courseIds: z.array(z.number().int()).min(1).max(12) })), (req, res) => {
  const info = db.prepare('INSERT INTO paths (title, descr) VALUES (?, ?)').run(req.body.title, req.body.descr);
  req.body.courseIds.forEach((c, i) => db.prepare('INSERT OR IGNORE INTO path_courses (path_id, course_id, pos) VALUES (?, ?, ?)').run(info.lastInsertRowid, c, i));
  logAct(req.user, 'إنشاء مسار تعلم', req.body.title); res.status(201).json({ ok: true });
});
router.delete('/paths/:id', (req, res) => { db.prepare('DELETE FROM paths WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
router.post('/faq', validate(z.object({ q: z.string().trim().min(3).max(200), a: z.string().trim().min(2).max(800), keywords: z.string().max(200).optional().default('') })), (req, res) => {
  db.prepare('INSERT INTO faq (q, a, keywords) VALUES (?, ?, ?)').run(req.body.q, req.body.a, req.body.keywords); res.status(201).json({ ok: true });
});
router.delete('/faq/:id', (req, res) => { db.prepare('DELETE FROM faq WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
router.post('/broadcast', validate(z.object({ title: z.string().trim().min(2).max(100), body: z.string().max(300).optional().default('') })), (req, res) => {
  for (const u of db.prepare("SELECT id FROM users WHERE role = 'student'").all()) notify(u.id, req.body.title, req.body.body, '');
  logAct(req.user, 'إشعار لكل الطلاب', req.body.title); res.json({ ok: true });
});
router.get('/mods', (req, res) => res.json({ mods: db.prepare('SELECT id, name, email FROM users WHERE is_mod = 1').all() }));

module.exports = router;
