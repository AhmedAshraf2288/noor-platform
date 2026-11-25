const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { lockedLessonIds } = require('../lib/util');
const config = require('../config');

const router = express.Router();

// Optional auth: attach user when a valid session cookie exists
function optionalUser(req) {
  const token = req.cookies.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT id, name, email, role, active, is_mod FROM users WHERE id = ?').get(payload.sub) || null;
  } catch {
    return null;
  }
}

function courseRow(c) {
  const lessons = db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?').get(c.id).n;
  return {
    id: c.id, titleAr: c.title_ar, titleEn: c.title_en, descAr: c.desc_ar, descEn: c.desc_en,
    price: c.price, icon: c.icon, theme: c.theme, lessonCount: lessons,
    coverUrl: c.cover_file ? `/api/courses/${c.id}/cover?v=${encodeURIComponent(c.cover_file)}` : null,
  };
}

const fs = require('fs');
const path = require('path');
// Public: serve a course cover image (only the stored, validated file name is ever used)
router.get('/:id/cover', (req, res) => {
  const c = db.prepare('SELECT cover_file FROM courses WHERE id = ? AND published = 1').get(Number(req.params.id));
  if (!c || !c.cover_file) return res.status(404).end();
  const f = path.join(__dirname, '..', 'uploads', 'covers', path.basename(c.cover_file));
  if (!fs.existsSync(f)) return res.status(404).end();
  const ext = path.extname(f).toLowerCase();
  res.set('Content-Type', ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(f).pipe(res);
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM courses WHERE published = 1 ORDER BY id').all();
  res.json({ courses: rows.map(courseRow) });
});

router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM courses WHERE id = ? AND published = 1').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'الكورس غير موجود' });
  const user = optionalUser(req);
  let hasAccess = false;
  let requestStatus = null;
  if (user) {
    hasAccess = user.role === 'admin' || user.is_mod === 1 ||
      !!db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(user.id, c.id);
    const r = db.prepare(
      'SELECT status FROM course_requests WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 1'
    ).get(user.id, c.id);
    requestStatus = r ? r.status : null;
  }
  const lessons = db.prepare(
    `SELECT l.id, l.title_ar, l.title_en, l.duration, l.position,
            (l.video_file IS NOT NULL) AS has_video,
            (SELECT COUNT(*) FROM exam_questions q WHERE q.lesson_id = l.id) AS exam_count
     FROM lessons l WHERE l.course_id = ? ORDER BY l.position, l.id`
  ).all(c.id);
  let best = {};
  if (user) {
    const rows = db.prepare(
      `SELECT a.lesson_id, MAX(CAST(a.score AS REAL) / MAX(a.total, 1)) AS pct, MAX(a.score) AS score, a.total
       FROM exam_attempts a JOIN lessons l ON l.id = a.lesson_id
       WHERE a.user_id = ? AND l.course_id = ? GROUP BY a.lesson_id`
    ).all(user.id, c.id);
    for (const r of rows) best[r.lesson_id] = { score: r.score, total: r.total, pct: Math.round(r.pct * 100) };
  }
  const locked = user && hasAccess && user.role !== 'admin' && !user.is_mod ? lockedLessonIds(user.id, c.id) : new Set();
  res.json({
    course: { ...courseRow(c), sequential: !!c.sequential },
    lessons: lessons.map((l) => ({
      id: l.id, titleAr: l.title_ar, titleEn: l.title_en, duration: l.duration,
      position: l.position, hasVideo: !!l.has_video, examCount: l.exam_count,
      examBest: best[l.id] || null, locked: locked.has(l.id),
    })),
    hasAccess,
    requestStatus,
  });
});

module.exports = { router };
