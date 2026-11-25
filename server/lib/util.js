const db = require('../db');

function notify(userId, title, body = '', link = '', ukey = null) {
  try {
    db.prepare('INSERT OR IGNORE INTO notifications (user_id, title, body, link, ukey) VALUES (?, ?, ?, ?, ?)')
      .run(userId, title, body, link, ukey);
  } catch (e) { /* ignore */ }
}

function logAct(actor, action, detail = '') {
  try {
    db.prepare('INSERT INTO activity_log (actor_id, actor_name, action, detail) VALUES (?, ?, ?, ?)')
      .run(actor ? actor.id : null, actor ? actor.name : '', action, String(detail).slice(0, 300));
  } catch (e) { /* ignore */ }
}

function getSetting(key, def = '') {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function priceNum(p) { const n = parseFloat(String(p).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }

// Lessons of a course in display order
function courseLessons(courseId) {
  return db.prepare('SELECT id, title_ar, position FROM lessons WHERE course_id = ? ORDER BY position, id').all(courseId);
}

// Sequential courses: a lesson opens only after the previous one is watched
function lockedLessonIds(userId, courseId) {
  const c = db.prepare('SELECT sequential FROM courses WHERE id = ?').get(courseId);
  if (!c || !c.sequential) return new Set();
  const ls = db.prepare('SELECT id FROM lessons WHERE course_id = ? ORDER BY position, id').all(courseId);
  const done = new Set(db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ?').all(userId).map((r) => r.lesson_id));
  const locked = new Set();
  for (let i = 1; i < ls.length; i++) if (!done.has(ls[i - 1].id) || locked.has(ls[i - 1].id)) locked.add(ls[i].id);
  return locked;
}

module.exports = { lockedLessonIds, notify, logAct, getSetting, setSetting, shuffle, priceNum, courseLessons };
