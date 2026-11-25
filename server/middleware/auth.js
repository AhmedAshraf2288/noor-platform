const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'مطلوب تسجيل الدخول' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, name, email, role, active, is_mod, banned, ban_reason FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'الحساب غير موجود' });
    if (user.banned) return res.status(403).json({ error: 'تم إيقاف حسابك' + (user.ban_reason ? ': ' + user.ban_reason : ''), banned: true });
    if (user.is_mod && user.role !== 'admin') user.role = 'mod';
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'الجلسة انتهت، سجل الدخول من جديد' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الإجراء' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };
