import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

/**
 * Middleware to authenticate requests via JWT stored in httpOnly cookie
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided.' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'tripbwi_secret_key_12984';
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token.' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });

    if (!admin || !admin.is_active) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Account is inactive or does not exist.' });
    }

    // Attach admin context to request
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware to restrict route access based on Role-Permission Matrix
 */
export function permissionMiddleware(module, requiredLevel = 'read') {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin || !admin.role) {
        return res.status(403).json({ success: false, error: 'Forbidden: Role not assigned.' });
      }

      const permissions = admin.role.permissions || {};
      const level = permissions[module] || 'none';

      const weight = { 'none': 0, 'read': 1, 'write': 2 };
      const userWeight = weight[level] || 0;
      const requiredWeight = weight[requiredLevel];

      if (userWeight >= requiredWeight) {
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        error: `Forbidden: Insufficient permissions for module '${module}'. Required: '${requiredLevel}', Found: '${level}'` 
      });
    } catch (err) {
      next(err);
    }
  };
}
