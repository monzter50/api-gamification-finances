import { body, param } from 'express-validator';
import { API_TOKEN_SCOPES } from '../types/apiToken.types';
import { MAX_TOKEN_TTL_DAYS } from '../services/apiToken.service';

export const createApiTokenValidation = [
  body('name')
    .isString()
    .withMessage('Token name is required')
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage('Token name must be 1–60 characters'),

  body('scopes')
    .isArray({ min: 1, max: API_TOKEN_SCOPES.length })
    .withMessage(`scopes must be a non-empty array of: ${API_TOKEN_SCOPES.join(', ')}`),
  body('scopes.*')
    .isIn([...API_TOKEN_SCOPES])
    .withMessage(`Each scope must be one of: ${API_TOKEN_SCOPES.join(', ')}`),

  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: MAX_TOKEN_TTL_DAYS })
    .withMessage(`expiresInDays must be an integer between 1 and ${MAX_TOKEN_TTL_DAYS}`)
    .toInt()
];

export const apiTokenIdValidation = [
  param('tokenId').isUUID().withMessage('Invalid token ID')
];
