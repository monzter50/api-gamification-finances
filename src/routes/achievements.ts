import express from 'express';
import { achievementController } from '../controllers/achievement.controller';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get all achievements
router.get('/', authenticateJWT, achievementController.getAllAchievements.bind(achievementController));

// Get user achievements with unlock status
router.get('/user', authenticateJWT, achievementController.getUserAchievements.bind(achievementController));

// Unlock achievement
router.post('/:id/unlock', authenticateJWT, achievementController.unlockAchievement.bind(achievementController));

// Get achievement progress
router.get('/:id/progress', authenticateJWT, achievementController.getAchievementProgress.bind(achievementController));

export { router as achievementRoutes };
