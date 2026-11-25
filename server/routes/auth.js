const express = require('express');
const { open } = require('../lib/vault');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { authRequired } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { notify } = require('../lib/util');

const router = express.Router();

const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(100, 'كلمة المرور طويلة جدا')
  .regex(/[A-Za-z\u0600-\u06FF]/, 'كلمة المرور يجب أن تحتوي على حروف')
  .regex(/[0-9]/, 'كلمة المرور يجب أن تحتوي على أرقام');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'الاسم قصير جدا').max(60, 'الاسم طويل جدا'),
  email: z.string().trim().toLowerCase().email('البريد الإلكتروني غير صحيح').max(120),
  password: passwordSchema,
  governorate: z.string().trim().max(40).optional().default(''),
  deviceId: z.string().trim().max(80).optional().default(''),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
  deviceId: z.string().trim().max(80).optional().default(''),
});

const MAX_DEVICES = 2;
// Device limit: a student account works on at most 2 devices; a new one triggers a notice
function checkDevice(user, deviceId, ua) {
  if (!deviceId || user.role === 'admin') return { ok: true };
  const known = db.prepare('SELECT device_id FROM devices WHERE user_id = ?').all(user.id);
  const has = known.some((d) => d.device_id === deviceId);
  if (has) { db.prepare("UPDATE devices SET last_seen = datetime('now') WHERE user_id = ? AND device_id = ?").run(user.id, deviceId); return { ok: true }; }
  if (known.length >= MAX_DEVICES) return { ok: false };
  db.prepare('INSERT INTO devices (user_id, device_id, ua) VALUES (?, ?, ?)').run(user.id, deviceId, String(ua || '').slice(0, 160));
  if (known.length > 0) notify(user.id, 'دخول من جهاز جديد', 'تم تسجيل الدخول لحسابك من جهاز جديد. لو مش انت غير كلمة المرور فوراً.', '#/student', 'dev-' + deviceId);
  return { ok: true };
}

function cookieBase() {
  return { sameSite: 'strict', secure: config.isProd, path: '/' };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
  });
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie('token', token, { ...cookieBase(), httpOnly: true, maxAge: 12 * 3600 * 1000 });
  res.cookie('csrf', csrf, { ...cookieBase(), httpOnly: false, maxAge: 12 * 3600 * 1000 });
  return csrf;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: (u.is_mod && u.role !== 'admin') ? 'mod' : u.role, active: !!u.active, governorate: u.governorate || '', school: u.school || '', parentPhone: open(u.parent_phone) };
}

// Issues a CSRF cookie before login so even login/register are protected.
router.get('/csrf', (req, res) => {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf', csrf, { ...cookieBase(), httpOnly: false, maxAge: 12 * 3600 * 1000 });
  res.json({ csrfToken: csrf });
});

router.post('/register', validate(registerSchema), (req, res) => {
  const { name, email, password, governorate, deviceId } = req.body;
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'هذا البريد مسجل بالفعل' });
  const hash = bcrypt.hashSync(password, config.bcryptRounds);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, governorate) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, hash, 'student', governorate);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  checkDevice(user, deviceId, req.headers['user-agent']);
  const csrfToken = issueSession(res, user);
  res.status(201).json({ user: publicUser(user), csrfToken });
});

router.post('/login', validate(loginSchema), (req, res) => {
  const { email, password, deviceId } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  if (user.banned) return res.status(403).json({ error: 'تم إيقاف حسابك' + (user.ban_reason ? ': ' + user.ban_reason : '') });
  if (!checkDevice(user, deviceId, req.headers['user-agent']).ok) {
    return res.status(403).json({ error: 'تجاوزت عدد الأجهزة المسموح بها (جهازين). كلم الإدارة لإعادة ضبط أجهزتك.' });
  }
  const csrfToken = issueSession(res, user);
  res.json({ user: publicUser(user), csrfToken });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...cookieBase(), httpOnly: true });
  res.clearCookie('csrf', { ...cookieBase(), httpOnly: false });
  res.json({ ok: true });
});

// Change own password (student or admin)
router.post('/change-password', authRequired, validate(z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: passwordSchema,
})), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u || !bcrypt.compareSync(req.body.currentPassword, u.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(req.body.newPassword, config.bcryptRounds), u.id);
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  // welcome-back nudge for students away more than a week
  if (u.last_seen && u.role === 'student' && Date.now() - Date.parse(u.last_seen + 'Z') > 7 * 864e5) {
    notify(u.id, 'وحشتنا! كمّل من فين وقفت', 'غبت أكتر من أسبوع. فانوسك مستنيك، كمّل دروسك.', '#/student', 'absent-' + new Date().toISOString().slice(0, 10));
  }
  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(u.id);
  res.json({ user: publicUser(u) });
});

module.exports = router;
