import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authController } from '../controllers/auth.controller';
import { registerValidation, loginValidation } from '../validators/auth.validator';
import { validate } from '../middleware/validate';
import { isTokenBlacklisted } from '../utils/tokenUtils';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

// Auth middleware
export async function authenticateJWT(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const token: string = authHeader.split(' ')[1] as string;

  try {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Token has been revoked' });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET ?? 'default_secret';
    const decoded = jwt.verify(token, JWT_SECRET as string) as any;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }
}

// Register new user
router.post('/register', registerValidation, validate, authController.register.bind(authController));

// Login user
router.post('/login', loginValidation, validate, authController.login.bind(authController));

// Logout user (with authentication and token blacklisting)
router.post('/logout', authenticateJWT, authController.logout.bind(authController));

// Get current user profile (protected)
router.get('/me', authenticateJWT, authController.getCurrentUser.bind(authController));

export { router as authRoutes }; 