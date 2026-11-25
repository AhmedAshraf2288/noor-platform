const path = require('path');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || '';

if (isProd && jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET (32+ chars) must be set in production. Copy .env.example to .env');
  process.exit(1);
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 4000),
  jwtSecret: jwtSecret || 'dev-only-secret-change-me-in-production-0000',
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  bcryptRounds: 12,
};
