const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  desc_ar TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '0',
  icon TEXT NOT NULL DEFAULT '📚',
  theme TEXT NOT NULL DEFAULT 'cv1',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  video_file TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS course_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'instapay',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  UNIQUE (user_id, course_id, status) ON CONFLICT IGNORE
);
CREATE TABLE IF NOT EXISTS exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_eq_lesson ON exam_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_lesson ON exam_attempts(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON course_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user ON course_requests(user_id);
`);


// --- Exam scheduling, anti-cheat state, and course-icon migration (v2) ---
try { db.exec("ALTER TABLE courses ADD COLUMN cover_file TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE lessons ADD COLUMN exam_open_at TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE lessons ADD COLUMN exam_close_at TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE lessons ADD COLUMN exam_duration_min INTEGER"); } catch (e) {}
db.exec(`CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, watched_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE)`);
db.exec(`CREATE TABLE IF NOT EXISTS exam_states (
  user_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  strikes INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
)`);
// Older databases stored emoji course icons, which render as blank boxes on some devices
const iconMap = { '🐍': 'code', '🗣️': 'chat', '🎨': 'palette', '⚛️': 'atom', '📚': 'book', '🧠': 'code', '🎧': 'chat', '✨': 'sparkles', '🌐': 'globe' };
for (const [from, to] of Object.entries(iconMap)) { try { db.prepare('UPDATE courses SET icon = ? WHERE icon = ?').run(to, from); } catch (e) {} }

// --- v5: big feature batch (notes, coupons, live, certificates, question types, etc.) ---
const addCol = (t, c, d) => { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`); } catch (e) {} };
addCol('users', 'governorate', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'school', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'parent_phone', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'parent_token', 'TEXT');
addCol('users', 'banned', 'INTEGER NOT NULL DEFAULT 0');
addCol('users', 'ban_reason', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'is_mod', 'INTEGER NOT NULL DEFAULT 0');
addCol('users', 'last_seen', 'TEXT');
addCol('courses', 'sequential', 'INTEGER NOT NULL DEFAULT 0');
addCol('lessons', 'notes', "TEXT NOT NULL DEFAULT ''");
addCol('lessons', 'exam_max_attempts', 'INTEGER');
addCol('exam_questions', 'qtype', "TEXT NOT NULL DEFAULT 'mcq'");
addCol('exam_questions', 'image_file', 'TEXT');
addCol('exam_questions', 'data', 'TEXT');
addCol('exam_questions', 'points', 'INTEGER NOT NULL DEFAULT 1');
addCol('exam_attempts', 'answers', 'TEXT');
addCol('exam_attempts', 'detail', 'TEXT');
addCol('exam_attempts', 'pending', 'INTEGER NOT NULL DEFAULT 0');
addCol('exam_attempts', 'feedback', 'TEXT');
addCol('exam_states', 'draw', 'TEXT');
addCol('course_requests', 'coupon_code', "TEXT NOT NULL DEFAULT ''");
addCol('course_requests', 'amount', 'REAL NOT NULL DEFAULT 0');
db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', read INTEGER NOT NULL DEFAULT 0,
  ukey TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, ukey));
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, percent INTEGER NOT NULL,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, starts_at TEXT, ends_at TEXT,
  max_uses INTEGER, used INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS video_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, sec INTEGER NOT NULL, text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS lesson_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  stored TEXT NOT NULL, orig_name TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, starts_at TEXT NOT NULL, duration_min INTEGER NOT NULL DEFAULT 60, link TEXT NOT NULL,
  lesson_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, ua TEXT NOT NULL DEFAULT '', first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, device_id));
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS watch_stats (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watch_sec REAL NOT NULL DEFAULT 0, max_sec REAL NOT NULL DEFAULT 0, last_sec REAL NOT NULL DEFAULT 0,
  dur REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, lesson_id));
CREATE TABLE IF NOT EXISTS paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS path_courses (
  path_id INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (path_id, course_id));
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')), decided_at TEXT);
CREATE TABLE IF NOT EXISTS lesson_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, answer TEXT,
  answered_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), answered_at TEXT);
CREATE TABLE IF NOT EXISTS faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT, q TEXT NOT NULL, a TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, lesson_id INTEGER, kind TEXT NOT NULL DEFAULT 'completion',
  rank INTEGER, pct INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

module.exports = db;
