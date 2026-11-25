// Double-submit cookie check for all state-changing API requests.
// The /api/auth/csrf endpoint issues the token; the client echoes it in x-csrf-token.
module.exports = function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const header = req.get('x-csrf-token');
  const cookie = req.cookies.csrf;
  if (!header || !cookie || header.length < 16 || header !== cookie) {
    return res.status(403).json({ error: 'فشل التحقق من الطلب' });
  }
  next();
};
