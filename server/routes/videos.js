const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { authRequired } = require('../middleware/auth');
const { lockedLessonIds } = require('../lib/util');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Streams a lesson video only to students the course was opened for (or admin).
// The file never lives on a public path; this endpoint is the only way in.
// NOTE: this makes saving the video hard, not impossible - no web tech can fully
// prevent a determined viewer from recording their screen.
router.get('/videos/:lessonId/stream', authRequired, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.lessonId));
  if (!lesson || !lesson.video_file) return res.status(404).json({ error: 'الفيديو غير موجود' });
  if (req.user.role !== 'admin' && req.user.role !== 'mod') {
    const ok = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(req.user.id, lesson.course_id);
    if (!ok) return res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' });
    if (lockedLessonIds(req.user.id, lesson.course_id).has(lesson.id)) return res.status(403).json({ error: 'خلّص الدرس اللي قبله الأول عشان يفتح الدرس ده', locked: true });
  }
  const safeName = path.basename(lesson.video_file);
  const file = path.join(uploadsDir, safeName);
  if (!file.startsWith(uploadsDir) || !fs.existsSync(file)) {
    return res.status(404).json({ error: 'ملف الفيديو غير موجود' });
  }
  const stat = fs.statSync(file);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        return res.end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
  }
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(file).pipe(res);
});

module.exports = router;
