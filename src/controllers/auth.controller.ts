import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { AuthenticatedRequest } from '../types';
import { AuthError } from '../errors/AuthErrors';

/**
 * Auth Controller
 * Handles HTTP requests/responses for authentication endpoints
 */
export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register({ email, password, name });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        ...result
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errorCode: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Error registering user',
          errorCode: 'INTERNAL_ERROR'
        });
      }
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errorCode: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Error logging in',
          errorCode: 'INTERNAL_ERROR'
        });
      }
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errorCode: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Error during logout',
          errorCode: 'INTERNAL_ERROR'
        });
      }
    }
  }

  /**
   * Get current authenticated user profile
   * GET /api/auth/me
   */
  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await userService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        ...profile
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          errorCode: error.errorCode
        });
      } else {
        const message = error instanceof Error ? error.message : 'Error getting profile';
        const statusCode = message.includes('not found') ? 404 : 500;

        res.status(statusCode).json({
          success: false,
          message,
          errorCode: statusCode === 404 ? 'USER_NOT_FOUND' : 'INTERNAL_ERROR'
        });
      }
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
