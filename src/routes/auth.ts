import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
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
router.post('/register', registerValidation, validate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register({ email, password, name });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error registering user';
    const statusCode = message.includes('already exists') ? 409 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Login user
router.post('/login', loginValidation, validate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error logging in';
    const statusCode = message.includes('Invalid') || message.includes('deactivated') ? 401 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Logout user (with authentication and token blacklisting)
router.post('/logout', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token: string = authHeader!.split(' ')[1] as string;
    const userId = req.user!.id;

    const result = await authService.logout(token, userId);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error during logout';

    res.status(500).json({
      success: false,
      message
    });
  }
});

// Get current user profile (protected)
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const profile = await userService.getUserProfile(userId);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error getting profile';
    const statusCode = message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

export { router as authRoutes }; 