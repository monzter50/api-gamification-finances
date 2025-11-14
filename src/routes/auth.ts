import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { BlacklistedToken } from '../models/BlacklistedToken';
import { blacklistToken, isTokenBlacklisted } from '../utils/tokenUtils';
import { AuthenticatedRequest } from '../types';
import { logger } from '../config/logger';

const router = express.Router();

type TypeJWTExpiresIn = '7d' | '1d' | '1h' | '1m' | '1s';
// JWT helpers
const JWT_SECRET = process.env.JWT_SECRET ?? 'default_secret';
const JWT_EXPIRES_IN: TypeJWTExpiresIn = process.env.JWT_EXPIRES_IN as TypeJWTExpiresIn ?? '7d';

function generateToken(user: { id: string; email: string; fullName: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.fullName },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES_IN}
  );
}

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
    
    const decoded = jwt.verify(token, JWT_SECRET as string) as any;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }
}

// Register new user
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'User already exists' });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase(), password: hashedPassword, name });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { userId: user._id }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user'
    });
  }
});

// Login user
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }
    const token = generateToken({ id: (user._id as any).toString(), email: user.email, fullName: user.name });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
});

// Logout user (with authentication and token blacklisting)
router.post('/logout', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token: string = authHeader!.split(' ')[1] as string;
    
    // Add token to blacklist
    await blacklistToken(token, req.user!.id);

    // Log the logout action (optional)
    logger.info(`User ${req.user?.email} logged out`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

// Get current user profile (protected) 
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting profile'
    });
  }
});

export { router as authRoutes }; 