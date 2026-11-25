const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Mark a lesson as watched (the student's "Noor Lantern" gets brighter)
router.post('/lessons/:id/watched', authRequired, (req, res) => {
  const lesson = db.prepare('SELECT id, course_id FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
  if (req.user.role !== 'admin') {
    const ok = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, lesson.course_id);
    if (!ok) return res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' });
  }
  db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)').run(req.user.id, lesson.id);
  res.json({ ok: true });
});

// Progress per course for the logged-in user: { courses: { [id]: { watched, total, lessonIds } } }
router.get('/progress', authRequired, (req, res) => {
  const lessons = db.prepare('SELECT id, course_id FROM lessons').all();
  const done = new Set(db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ?').all(req.user.id).map((r) => r.lesson_id));
  const out = {};
  for (const l of lessons) {
    const c = out[l.course_id] || (out[l.course_id] = { watched: 0, total: 0, lessonIds: [] });
    c.total += 1;
    if (done.has(l.id)) { c.watched += 1; c.lessonIds.push(l.id); }
  }
  res.json({ courses: out });
});

module.exports = router;
