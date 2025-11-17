import express from 'express';
import { userController } from '../controllers/user.controller';
import { updateProfileValidation } from '../validators/user.validator';
import { validate } from '../middleware/validate';
import { authenticateJWT } from './auth';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateJWT, userController.getProfile.bind(userController));

// Update user profile
router.put('/profile', authenticateJWT, updateProfileValidation, validate, userController.updateProfile.bind(userController));

// Get user stats
router.get('/stats', authenticateJWT, userController.getStats.bind(userController));

export { router as userRoutes }; 