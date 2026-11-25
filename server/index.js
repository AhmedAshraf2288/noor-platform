const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const config = require('./config');
const csrfProtection = require('./middleware/csrf');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api')) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache'); }
  next();
});
app.use(require('compression')());
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use(
  cors({
    origin: config.isProd ? false : config.clientOrigin,
    credentials: true,
  })
);

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'محاولات كثيرة، جرب بعد قليل' },
});

app.use('/api', apiLimiter, csrfProtection);
// Strict limiter only on credential-attempt endpoints; /me and /csrf must stay available on every page load
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', authLimiter);
// Maintenance mode: everything except login/site info is paused for non-admins
app.use('/api', (req, res, next) => {
  const { getSetting } = require('./lib/util');
  if (getSetting('maintenance_on', '0') !== '1') return next();
  if (/^\/(auth|site|public|csrf)/.test(req.path)) return next();
  try { const u = require('jsonwebtoken').verify(req.cookies.token, config.jwtSecret); const row = require('./db').prepare('SELECT role FROM users WHERE id = ?').get(u.sub); if (row && row.role === 'admin') return next(); } catch (e) {}
  res.status(503).json({ error: getSetting('maintenance_msg', '') || 'الموقع تحت الصيانة، هنرجع قريب', maintenance: true });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses').router);
app.use('/api', require('./routes/site'));
app.use('/api', require('./routes/requests'));
app.use('/api', require('./routes/videos'));
app.use('/api', require('./routes/exams'));
app.use('/api', require('./routes/progress'));
app.use('/api', require('./routes/features'));
app.use('/api/admin', require('./routes/admin2'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

// Central error handler: never leak internals
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// Production: serve the built client
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Auto-seed an empty database (fresh deploys, ephemeral filesystems)
try {
  const db = require('./db');
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    console.log('empty database - running seed');
    require('./scripts/seed');
  }
} catch (e) {
  console.error('auto-seed failed:', e.message);
}

app.listen(config.port, () => {
  console.log(`Noor platform API listening on http://localhost:${config.port}`);
});
