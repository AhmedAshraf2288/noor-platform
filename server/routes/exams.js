const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { shuffle, notify } = require('../lib/util');

const router = express.Router();
const MAX_STRIKES = 3;
const SUBMIT_GRACE_SEC = 120;
const SHOWN = 5; // each student gets 5 random questions out of the bank
const isStaff = (u) => u.role === 'admin' || u.role === 'mod';

function lessonForUser(req, res) {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(Number(req.params.id));
  if (!lesson) { res.status(404).json({ error: 'الدرس غير موجود' }); return null; }
  if (!isStaff(req.user)) {
    const ok = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, lesson.course_id);
    if (!ok) { res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' }); return null; }
  }
  return lesson;
}

function examWindow(lesson) {
  const now = Date.now();
  if (lesson.exam_open_at && now < Date.parse(lesson.exam_open_at)) return 'before';
  if (lesson.exam_close_at && now > Date.parse(lesson.exam_close_at)) return 'after';
  return 'open';
}

function getState(uid, lid) {
  db.prepare('INSERT OR IGNORE INTO exam_states (user_id, lesson_id) VALUES (?, ?)').run(uid, lid);
  return db.prepare('SELECT * FROM exam_states WHERE user_id = ? AND lesson_id = ?').get(uid, lid);
}
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const D = (r) => parse(r.data, {});

// Student-safe view of a question: no correct answers; options/items shuffled per student (random order)
function publicQ(r) {
  const d = D(r);
  const base = { id: r.id, type: r.qtype || 'mcq', q: r.question, points: r.points || 1, image: r.image_file ? `/api/question-image/${r.image_file}` : null };
  if (base.type === 'mcq') base.options = shuffle(parse(r.options, []).map((t, i) => ({ i, t })));
  else if (base.type === 'tf') base.options = [{ i: 0, t: 'صح' }, { i: 1, t: 'غلط' }];
  else if (base.type === 'order') base.items = shuffle(d.items || []);
  else if (base.type === 'match') { base.left = (d.pairs || []).map((p) => p[0]); base.right = shuffle((d.pairs || []).map((p) => p[1])); }
  return base;
}

function correctText(r) {
  const d = D(r); const t = r.qtype || 'mcq';
  if (t === 'mcq' || t === 'tf') return (parse(r.options, [])[r.correct]) || '';
  if (t === 'order') return (d.items || []).join(' ← ');
  if (t === 'match') return (d.pairs || []).map((p) => `${p[0]} = ${p[1]}`).join('، ');
  return d.model || '';
}

// grade one answer: returns {got, right, pending}
function gradeOne(r, ans) {
  const t = r.qtype || 'mcq'; const d = D(r); const pts = r.points || 1;
  if (ans === undefined || ans === null || ans === '') return { got: 0, right: false, pending: false };
  if (t === 'mcq' || t === 'tf') { const ok = Number(ans) === r.correct; return { got: ok ? pts : 0, right: ok }; }
  if (t === 'order') { const ok = Array.isArray(ans) && JSON.stringify(ans) === JSON.stringify(d.items || []); return { got: ok ? pts : 0, right: ok }; }
  if (t === 'match') {
    const pairs = d.pairs || []; let n = 0;
    for (const p of pairs) if (ans && ans[p[0]] === p[1]) n += 1;
    const got = Math.round((n / Math.max(pairs.length, 1)) * pts * 100) / 100;
    return { got, right: n === pairs.length };
  }
  return { got: 0, right: false, pending: true }; // essay
}

function cohortAvg(lessonId) {
  const rows = db.prepare(`SELECT user_id, MAX(CAST(score AS REAL) / MAX(total, 0.0001)) AS p FROM exam_attempts WHERE lesson_id = ? AND pending = 0 GROUP BY user_id`).all(lessonId);
  if (!rows.length) return { avg: null, n: 0 };
  return { avg: Math.round((rows.reduce((a, r) => a + r.p, 0) / rows.length) * 100), n: rows.length };
}

router.get('/question-image/:name', authRequired, (req, res) => {
  const p = require('path').join(__dirname, '..', 'uploads', 'covers', require('path').basename(req.params.name));
  if (!/^q-/.test(require('path').basename(p)) || !require('fs').existsSync(p)) return res.status(404).end();
  const ext = require('path').extname(p).toLowerCase();
  res.set('Content-Type', ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, max-age=3600');
  require('fs').createReadStream(p).pipe(res);
});

router.get('/lessons/:id/exam', authRequired, (req, res) => {
  const lesson = lessonForUser(req, res);
  if (!lesson) return;
  const count = db.prepare('SELECT COUNT(*) AS c FROM exam_questions WHERE lesson_id = ?').get(lesson.id).c;
  if (count === 0) return res.json({ hasExam: false });
  const st = isStaff(req.user) ? { strikes: 0, locked: 0, started_at: null } : getState(req.user.id, lesson.id);
  const mine = db.prepare('SELECT score, total, pending FROM exam_attempts WHERE user_id = ? AND lesson_id = ? ORDER BY id').all(req.user.id, lesson.id);
  const best = mine.filter((a) => !a.pending).sort((a, b) => b.score / (b.total || 1) - a.score / (a.total || 1))[0];
  const ca = cohortAvg(lesson.id);
  res.json({
    hasExam: true,
    questionCount: Math.min(count, SHOWN),
    bankSize: count,
    openAt: lesson.exam_open_at || null,
    closeAt: lesson.exam_close_at || null,
    durationMin: lesson.exam_duration_min || null,
    window: examWindow(lesson),
    state: { strikes: st.strikes, locked: !!st.locked, startedAt: st.started_at },
    maxStrikes: MAX_STRIKES,
    maxAttempts: lesson.exam_max_attempts || null,
    attempts: mine.length,
    pendingGrade: mine.some((a) => a.pending),
    best: best ? { score: best.score, total: best.total } : null,
    cohort: ca,
  });
});

router.post('/lessons/:id/exam/start', authRequired, (req, res) => {
  const lesson = lessonForUser(req, res);
  if (!lesson) return;
  const all = db.prepare('SELECT * FROM exam_questions WHERE lesson_id = ? ORDER BY position, id').all(lesson.id);
  if (all.length === 0) return res.status(404).json({ error: 'لا يوجد امتحان لهذا الدرس' });
  const win = examWindow(lesson);
  if (win === 'before') return res.status(403).json({ error: 'الامتحان لم يفتح بعد', window: 'before', openAt: lesson.exam_open_at });
  if (win === 'after') return res.status(403).json({ error: 'انتهى وقت الامتحان', window: 'after' });
  const st = getState(req.user.id, lesson.id);
  if (st.locked) return res.status(403).json({ error: 'تم قفل الامتحان بسبب تجاوز عدد المخالفات', locked: true, strikes: st.strikes });
  const used = db.prepare('SELECT COUNT(*) AS c FROM exam_attempts WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id).c;
  const draw = parse(st.draw, null);
  if (lesson.exam_max_attempts && used >= lesson.exam_max_attempts && !draw) {
    return res.status(403).json({ error: `استنفدت عدد المحاولات المسموح بها (${lesson.exam_max_attempts})`, maxAttempts: lesson.exam_max_attempts });
  }
  let ids, answers = {}, startedAt;
  if (draw && st.started_at) { ids = draw.ids; answers = draw.answers || {}; startedAt = st.started_at; } // resume after a dropped connection
  else {
    ids = shuffle(all).slice(0, Math.min(SHOWN, all.length)).map((r) => r.id);
    startedAt = new Date().toISOString();
    db.prepare('UPDATE exam_states SET started_at = ?, draw = ? WHERE user_id = ? AND lesson_id = ?')
      .run(startedAt, JSON.stringify({ ids, answers: {} }), req.user.id, lesson.id);
  }
  const byId = new Map(all.map((r) => [r.id, r]));
  res.json({
    questions: ids.map((id) => publicQ(byId.get(id))).filter(Boolean),
    answers, startedAt,
    durationMin: lesson.exam_duration_min || null,
    strikes: st.strikes, maxStrikes: MAX_STRIKES,
  });
});

// Autosave answers so a dropped connection loses nothing
router.post('/lessons/:id/exam/save', authRequired, validate(z.object({ answers: z.record(z.string(), z.any()) })), (req, res) => {
  const lesson = lessonForUser(req, res);
  if (!lesson) return;
  const st = getState(req.user.id, lesson.id);
  const draw = parse(st.draw, null);
  if (!draw) return res.status(409).json({ error: 'لا توجد محاولة جارية' });
  draw.answers = req.body.answers;
  db.prepare('UPDATE exam_states SET draw = ? WHERE user_id = ? AND lesson_id = ?').run(JSON.stringify(draw).slice(0, 60000), req.user.id, lesson.id);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

router.post('/lessons/:id/exam/strike', authRequired, (req, res) => {
  const lesson = lessonForUser(req, res);
  if (!lesson) return;
  const st = getState(req.user.id, lesson.id);
  const strikes = st.strikes + 1;
  const locked = strikes >= MAX_STRIKES ? 1 : 0;
  db.prepare('UPDATE exam_states SET strikes = ?, locked = ? WHERE user_id = ? AND lesson_id = ?').run(strikes, locked, req.user.id, lesson.id);
  res.json({ strikes, locked: !!locked, maxStrikes: MAX_STRIKES });
});

router.post('/lessons/:id/exam/submit', authRequired,
  validate(z.object({ answers: z.record(z.string(), z.any()) })),
  (req, res) => {
    const lesson = lessonForUser(req, res);
    if (!lesson) return;
    const st = getState(req.user.id, lesson.id);
    if (st.locked) return res.status(403).json({ error: 'تم قفل الامتحان بسبب تجاوز عدد المخالفات', locked: true });
    const draw = parse(st.draw, null);
    if (!draw) return res.status(409).json({ error: 'ابدأ الامتحان أولاً' });
    if (st.started_at && lesson.exam_duration_min) {
      const elapsed = (Date.now() - Date.parse(st.started_at)) / 1000;
      if (elapsed > lesson.exam_duration_min * 60 + SUBMIT_GRACE_SEC) {
        db.prepare('UPDATE exam_states SET draw = NULL, started_at = NULL WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lesson.id);
        return res.status(403).json({ error: 'انتهى وقت الامتحان', timeUp: true });
      }
    }
    const qs = draw.ids.map((id) => db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(id)).filter(Boolean);
    let score = 0, total = 0, pending = 0;
    const detail = qs.map((r) => {
      const ans = req.body.answers[String(r.id)];
      const g = gradeOne(r, ans);
      score += g.got; total += r.points || 1; if (g.pending) pending = 1;
      return { id: r.id, type: r.qtype || 'mcq', q: r.question, points: r.points || 1, got: g.got, right: g.right, pending: !!g.pending, your: ans === undefined ? null : ans };
    });
    db.prepare('INSERT INTO exam_attempts (user_id, lesson_id, score, total, answers, detail, pending) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.user.id, lesson.id, score, total, JSON.stringify(req.body.answers).slice(0, 60000), JSON.stringify(detail), pending);
    db.prepare('UPDATE exam_states SET draw = NULL, started_at = NULL WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lesson.id);
    const pct = Math.round((score / Math.max(total, 1)) * 100);
    notify(req.user.id, pending ? 'تم استلام امتحانك' : `نتيجة امتحان: ${pct}%`, `${lesson.title_ar}: ${score} من ${total}` + (pending ? ' (الأسئلة المقالية بتتصحح)' : ''), `#/exam/${lesson.id}`);
    const ca = cohortAvg(lesson.id);
    res.json({
      score, total, pct, passed: pct >= 50, pending: !!pending, cohort: ca,
      results: detail.map((d) => ({ id: d.id, right: d.right, pending: d.pending })), // answers are revealed after the exam window ends
      window: examWindow(lesson),
    });
  });

// Model answers: only after the exam window has ended (admin can always see)
router.get('/lessons/:id/exam/review', authRequired, (req, res) => {
  const lesson = lessonForUser(req, res);
  if (!lesson) return;
  if (examWindow(lesson) !== 'after' && !isStaff(req.user)) return res.status(403).json({ error: 'الإجابات النموذجية بتظهر بعد انتهاء وقت الامتحان', window: examWindow(lesson), closeAt: lesson.exam_close_at });
  const att = db.prepare('SELECT * FROM exam_attempts WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id, lesson.id);
  const detail = att ? parse(att.detail, []) : [];
  res.json({
    items: detail.map((d) => {
      const r = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(d.id);
      return { ...d, correctText: r ? correctText(r) : '', image: r && r.image_file ? `/api/question-image/${r.image_file}` : null };
    }),
    feedback: att ? att.feedback : null,
  });
});

// Student exam history across all exams (progress chart)
router.get('/my/exam-history', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT a.id, a.score, a.total, a.pending, a.created_at, l.title_ar AS lesson, l.id AS lesson_id, c.title_ar AS course, c.id AS course_id
    FROM exam_attempts a JOIN lessons l ON l.id = a.lesson_id JOIN courses c ON c.id = l.course_id WHERE a.user_id = ? ORDER BY a.id`).all(req.user.id);
  res.json({ attempts: rows.map((r) => ({ ...r, pct: Math.round((r.score / Math.max(r.total, 1)) * 100), pending: !!r.pending })) });
});

// Final review: every question the student got wrong in a course
router.get('/courses/:id/wrong', authRequired, (req, res) => {
  const cid = Number(req.params.id);
  if (!isStaff(req.user) && !db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, cid)) return res.status(403).json({ error: 'هذا الكورس غير مفتوح لحسابك' });
  const atts = db.prepare(`SELECT a.detail, l.id AS lid, l.title_ar, l.exam_close_at, l.exam_open_at FROM exam_attempts a JOIN lessons l ON l.id = a.lesson_id WHERE a.user_id = ? AND l.course_id = ? AND a.pending = 0 ORDER BY a.id`).all(req.user.id, cid);
  const seen = new Map();
  for (const a of atts) for (const d of parse(a.detail, [])) {
    if (d.right) { seen.delete(d.id); continue; }
    const r = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(d.id);
    if (!r) continue;
    const after = a.exam_close_at && Date.now() > Date.parse(a.exam_close_at);
    seen.set(d.id, { id: d.id, lesson: a.title_ar, lessonId: a.lid, q: d.q, type: d.type, correctText: after ? correctText(r) : null });
  }
  res.json({ items: [...seen.values()] });
});

module.exports = router;
module.exports.correctText = correctText;
