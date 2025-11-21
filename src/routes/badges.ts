import express from 'express';
import { badgeController } from '../controllers/badge.controller';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get all active badges
router.get('/active', authenticateJWT, badgeController.getAllActiveBadges.bind(badgeController));

// Get all available badges (considering time limits)
router.get('/available', authenticateJWT, badgeController.getAllAvailableBadges.bind(badgeController));

// Get user's badges
router.get('/user', authenticateJWT, badgeController.getUserBadges.bind(badgeController));

// Get badge statistics
router.get('/stats', authenticateJWT, badgeController.getBadgeStats.bind(badgeController));

// Check and award unlockable badges to user
router.post('/check-unlock', authenticateJWT, badgeController.checkAndAwardBadges.bind(badgeController));

// Get badges by category
router.get('/category/:category', authenticateJWT, badgeController.getBadgesByCategory.bind(badgeController));

// Get badges by rarity
router.get('/rarity/:rarity', authenticateJWT, badgeController.getBadgesByRarity.bind(badgeController));

// Get badge by ID
router.get('/:badgeId', authenticateJWT, badgeController.getBadgeById.bind(badgeController));

// Admin routes - Create, update, delete badges
router.post('/', authenticateJWT, badgeController.createBadge.bind(badgeController));
router.put('/:badgeId', authenticateJWT, badgeController.updateBadge.bind(badgeController));
router.delete('/:badgeId', authenticateJWT, badgeController.deleteBadge.bind(badgeController));

export { router as badgeRoutes };
