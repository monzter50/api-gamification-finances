import type { Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { type AuthenticatedRequest } from '../types';

export class UserController {
  async getProfile (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await userService.getUserProfile(req.user!.userId);

      res.status(200).json({
        success: true,
        message: 'Perfil obtenido correctamente',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body as { name?: string };
      const data: { name?: string } = {};
      if (name !== undefined) data.name = name;

      const profile = await userService.updateProfile(req.user!.userId, data);

      res.status(200).json({
        success: true,
        message: 'Perfil actualizado correctamente',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const userController = new UserController();
