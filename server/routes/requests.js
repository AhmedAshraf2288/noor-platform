const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { priceNum, notify } = require('../lib/util');

const router = express.Router();

const createSchema = z.object({
  courseId: z.number().int().positive(),
  method: z.enum(['instapay', 'wallet']),
  couponCode: z.string().trim().max(40).optional().default(''),
});

// Student creates a course subscription request (after manual payment).
// Requirement: only registered, logged-in AND admin-approved (active) accounts reach this step.
router.post('/requests', authRequired, validate(createSchema), (req, res) => {
  if (req.user.role !== 'admin' && !req.user.active) {
    return res.status(403).json({ error: 'حسابك لم يتم تفعيله بعد من الإدارة' });
  }
  const course = db.prepare('SELECT id, price FROM courses WHERE id = ? AND published = 1').get(req.body.courseId);
  if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });
  const enrolled = db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  if (enrolled) return res.status(409).json({ error: 'الكورس مفتوح لك بالفعل' });
  const pending = db.prepare(
    "SELECT 1 FROM course_requests WHERE user_id = ? AND course_id = ? AND status = 'pending'"
  ).get(req.user.id, course.id);
  if (pending) return res.status(409).json({ error: 'لديك طلب قيد المراجعة لهذا الكورس بالفعل' });
  let amount = priceNum(course.price), code = '';
  if (req.body.couponCode) {
    const r = require('./features').couponFor(req.body.couponCode, course.id);
    if (r.error) return res.status(400).json({ error: r.error });
    amount = Math.round(amount * (100 - r.c.percent)) / 100; code = r.c.code;
    db.prepare('UPDATE coupons SET used = used + 1 WHERE id = ?').run(r.c.id);
  }
  const info = db.prepare(
    'INSERT INTO course_requests (user_id, course_id, method, coupon_code, amount) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, course.id, req.body.method, code, amount);
  const row = db.prepare('SELECT * FROM course_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ request: row });
});

// Student's own requests with course info
router.get('/requests/mine', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.status, r.method, r.created_at, r.decided_at, r.amount, r.coupon_code,
           c.id AS course_id, c.title_ar, c.title_en, c.icon, c.theme, c.price
    FROM course_requests r JOIN courses c ON c.id = r.course_id
    WHERE r.user_id = ? ORDER BY r.id DESC
  `).all(req.user.id);
  res.json({ requests: rows });
});

// Student's opened courses (enrollments)
router.get('/my-courses', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.title_ar, c.title_en, c.desc_ar, c.desc_en, c.price, c.icon, c.theme, e.granted_at,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
    FROM enrollments e JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ? ORDER BY e.granted_at DESC
  `).all(req.user.id);
  res.json({ courses: rows });
});

module.exports = router;
