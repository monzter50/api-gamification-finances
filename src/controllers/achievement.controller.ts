import type { Response } from 'express';
import { achievementService } from '../services/achievement.service';
import { AuthenticatedRequest } from '../types';

/**
 * Achievement Controller
 * Handles HTTP requests/responses for achievement endpoints
 */
export class AchievementController {
  /**
   * Get all achievements
   * GET /api/achievements
   */
  async getAllAchievements(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const achievements = await achievementService.getAllAchievements();

      res.status(200).json({
        success: true,
        data: achievements
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al obtener los logros';

      res.status(500).json({
        success: false,
        message
      });
    }
  }

  /**
   * Get user achievements with unlock status
   * GET /api/achievements/user
   */
  async getUserAchievements(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = await achievementService.getUserAchievements(userId);

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al obtener los logros del usuario';
      const statusCode = message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message
      });
    }
  }

  /**
   * Unlock an achievement
   * POST /api/achievements/:id/unlock
   */
  async unlockAchievement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Achievement ID is required'
        });
        return;
      }

      const result = await achievementService.unlockAchievement(userId, id);

      res.status(200).json({
        success: true,
        message: `¡Logro desbloqueado: ${result.achievement.name}!`,
        data: result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desbloquear el logro';
      let statusCode = 500;

      if (message.includes('not found')) {
        statusCode = 404;
      } else if (message.includes('not available') || message.includes('already unlocked')) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message
      });
    }
  }

  /**
   * Get achievement progress
   * GET /api/achievements/:id/progress
   */
  async getAchievementProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Achievement ID is required'
        });
        return;
      }

      const data = await achievementService.getAchievementProgress(userId, id);

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al obtener el progreso del logro';
      const statusCode = message.includes('not found') ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message
      });
    }
  }
}

// Export singleton instance
export const achievementController = new AchievementController();
