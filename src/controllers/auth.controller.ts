import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { type AuthenticatedRequest } from '../types';

/**
 * Auth controller. Errors are forwarded with `next(error)`; the global
 * errorHandler renders typed errors (InvalidCredentialsError, ...) with their
 * status + errorCode and hides internals on 500.
 */
export class AuthController {
  async register (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body as { email: string, password: string, name: string };
      const result = await authService.register({ email, password, name });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async login (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string, password: string };
      const result = await authService.login({ email, password });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async logout (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // authenticateJWT already guaranteed a well-formed Bearer header.
      const token = (req.headers.authorization ?? '').slice('Bearer '.length).trim();
      const userId = req.user!.userId;

      const result = await authService.logout(token, userId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await userService.getUserProfile(req.user!.userId);

      res.status(200).json({
        success: true,
        ...profile
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
