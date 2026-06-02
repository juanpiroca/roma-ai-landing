const { verifyToken } = require('@clerk/backend');

/**
 * Middleware para verificar JWT de Clerk
 * Extrae el token del header Authorization y lo valida
 */
async function clerkAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.first_name,
      lastName: decoded.last_name,
    };
  } catch (err) {
    console.log('Token inválido:', err.message);
    req.user = null;
  }

  next();
}

/**
 * Middleware que requiere autenticación
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = {
  clerkAuthMiddleware,
  requireAuth,
};
