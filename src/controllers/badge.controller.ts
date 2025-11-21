import type { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { badgeService } from '../services/badge.service';
import { CreateBadgeRequestDto, UpdateBadgeRequestDto } from '../dto/request/badge.dto';
import { BadgeResponseDto, AwardBadgeResponseDto, UnlockableBadgesResponseDto } from '../dto/response/badge.dto';
import { IBadge } from '../models/Badge';
import { logger } from '../config/logger';

/**
 * Helper function to map Badge model to BadgeResponseDto
 */
function mapBadgeToResponse(badge: IBadge): BadgeResponseDto {
  const response: BadgeResponseDto = {
    id: (badge._id as any).toString(),
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    category: badge.category,
    rarity: badge.rarity,
    criteria: badge.criteria,
    isActive: badge.isActive,
    isLimited: badge.isLimited,
    rarityColor: badge.rarityColor,
    createdAt: badge.createdAt,
    updatedAt: badge.updatedAt
  };

  if (badge.availableFrom !== undefined) {
    response.availableFrom = badge.availableFrom;
  }

  if (badge.availableUntil !== undefined) {
    response.availableUntil = badge.availableUntil;
  }

  return response;
}

/**
 * Badge Controller
 * Handles HTTP requests for badge operations
 */
export class BadgeController {
  /**
   * Get all active badges
   */
  async getAllActiveBadges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const badges = await badgeService.getAllActiveBadges();
      const badgeResponses = badges.map(mapBadgeToResponse);

      res.status(200).json({
        success: true,
        data: {
          badges: badgeResponses,
          total: badgeResponses.length
        }
      });
    } catch (error) {
      logger.error('Error getting active badges:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting active badges'
      });
    }
  }

  /**
   * Get all available badges (considering time limits)
   */
  async getAllAvailableBadges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const badges = await badgeService.getAllAvailableBadges();
      const badgeResponses = badges.map(mapBadgeToResponse);

      res.status(200).json({
        success: true,
        data: {
          badges: badgeResponses,
          total: badgeResponses.length
        }
      });
    } catch (error) {
      logger.error('Error getting available badges:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting available badges'
      });
    }
  }

  /**
   * Get badge by ID
   */
  async getBadgeById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { badgeId } = req.params;
      if (!badgeId) {
        res.status(400).json({
          success: false,
          message: 'Badge ID is required'
        });
        return;
      }

      const badge = await badgeService.getBadgeById(badgeId);
      const badgeResponse = mapBadgeToResponse(badge);

      res.status(200).json({
        success: true,
        data: badgeResponse
      });
    } catch (error) {
      logger.error('Error getting badge:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error getting badge'
      });
    }
  }

  /**
   * Get badges by category
   */
  async getBadgesByCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      if (!category) {
        res.status(400).json({
          success: false,
          message: 'Category is required'
        });
        return;
      }

      const badges = await badgeService.getBadgesByCategory(category);
      const badgeResponses = badges.map(mapBadgeToResponse);

      res.status(200).json({
        success: true,
        data: {
          badges: badgeResponses,
          total: badgeResponses.length
        }
      });
    } catch (error) {
      logger.error('Error getting badges by category:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting badges by category'
      });
    }
  }

  /**
   * Get badges by rarity
   */
  async getBadgesByRarity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { rarity } = req.params;
      if (!rarity) {
        res.status(400).json({
          success: false,
          message: 'Rarity is required'
        });
        return;
      }

      const badges = await badgeService.getBadgesByRarity(rarity);
      const badgeResponses = badges.map(mapBadgeToResponse);

      res.status(200).json({
        success: true,
        data: {
          badges: badgeResponses,
          total: badgeResponses.length
        }
      });
    } catch (error) {
      logger.error('Error getting badges by rarity:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting badges by rarity'
      });
    }
  }

  /**
   * Get user's badges
   */
  async getUserBadges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const badges = await badgeService.getUserBadges(userId);
      const badgeResponses = badges.map(mapBadgeToResponse);

      res.status(200).json({
        success: true,
        data: {
          badges: badgeResponses,
          total: badgeResponses.length
        }
      });
    } catch (error) {
      logger.error('Error getting user badges:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting user badges'
      });
    }
  }

  /**
   * Create a new badge (admin only)
   */
  async createBadge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const badgeData: CreateBadgeRequestDto = req.body;

      // Convert date strings to Date objects if provided
      const createData: any = {
        ...badgeData
      };

      if (badgeData.availableFrom) {
        createData.availableFrom = new Date(badgeData.availableFrom);
      }

      if (badgeData.availableUntil) {
        createData.availableUntil = new Date(badgeData.availableUntil);
      }

      const badge = await badgeService.createBadge(createData);
      const badgeResponse = mapBadgeToResponse(badge);

      res.status(201).json({
        success: true,
        message: 'Badge created successfully',
        data: badgeResponse
      });
    } catch (error) {
      logger.error('Error creating badge:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error creating badge'
      });
    }
  }

  /**
   * Update a badge (admin only)
   */
  async updateBadge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { badgeId } = req.params;
      if (!badgeId) {
        res.status(400).json({
          success: false,
          message: 'Badge ID is required'
        });
        return;
      }

      const updateData: UpdateBadgeRequestDto = req.body;

      // Convert date strings to Date objects if provided
      const updateFields: any = {
        ...updateData
      };

      if (updateData.availableFrom) {
        updateFields.availableFrom = new Date(updateData.availableFrom);
      }

      if (updateData.availableUntil) {
        updateFields.availableUntil = new Date(updateData.availableUntil);
      }

      const badge = await badgeService.updateBadge(badgeId, updateFields);
      const badgeResponse = mapBadgeToResponse(badge);

      res.status(200).json({
        success: true,
        message: 'Badge updated successfully',
        data: badgeResponse
      });
    } catch (error) {
      logger.error('Error updating badge:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error updating badge'
      });
    }
  }

  /**
   * Delete a badge (admin only)
   */
  async deleteBadge(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { badgeId } = req.params;
      if (!badgeId) {
        res.status(400).json({
          success: false,
          message: 'Badge ID is required'
        });
        return;
      }

      await badgeService.deleteBadge(badgeId);

      res.status(200).json({
        success: true,
        message: 'Badge deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting badge:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error deleting badge'
      });
    }
  }

  /**
   * Check and award unlockable badges to user
   */
  async checkAndAwardBadges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const result = await badgeService.checkAndAwardBadges(userId);

      const response: UnlockableBadgesResponseDto = {
        badgesAwarded: result.badgesAwarded.map(mapBadgeToResponse),
        totalCoins: result.totalCoins,
        totalExperience: result.totalExperience,
        count: result.badgesAwarded.length
      };

      res.status(200).json({
        success: true,
        message: result.badgesAwarded.length > 0
          ? `Awarded ${result.badgesAwarded.length} new badge(s)!`
          : 'No new badges to award',
        data: response
      });
    } catch (error) {
      logger.error('Error checking and awarding badges:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking and awarding badges'
      });
    }
  }

  /**
   * Get badge statistics
   */
  async getBadgeStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await badgeService.getBadgeStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting badge statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting badge statistics'
      });
    }
  }
}

// Export singleton instance
export const badgeController = new BadgeController();
