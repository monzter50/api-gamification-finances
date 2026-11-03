import express from 'express';
import { userController } from '../controllers/user.controller';
import { apiTokenController } from '../controllers/apiToken.controller';
import { updateProfileValidation } from '../validators/user.validator';
import { createApiTokenValidation, apiTokenIdValidation } from '../validators/apiToken.validator';
import { validate } from '../middleware/validate';
import { authenticateJWT, authenticateUserOrApiToken } from '../middleware/auth';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateUserOrApiToken, userController.getProfile.bind(userController));

// Update user profile
router.put('/profile', authenticateJWT, updateProfileValidation, validate, userController.updateProfile.bind(userController));

/**
 * @openapi
 * /api/users/tokens:
 *   post:
 *     tags: [API Tokens]
 *     summary: Create a personal API token
 *     description: |
 *       For the MCP server, scripts and automations. **The raw `token` is in
 *       this response only** — it's stored as a hash and can't be shown again.
 *
 *       Requires an app session (JWT); an API token can't create tokens.
 *       `read` allows GET requests; `write` (implies `read`) also allows
 *       POST/PUT/PATCH/DELETE — but only on endpoints that accept API tokens
 *       (accounts, transactions, budgets, profile reads). Max 10 active tokens.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scopes]
 *             properties:
 *               name: { type: string, maxLength: 60, example: 'Claude MCP (laptop)' }
 *               scopes:
 *                 type: array
 *                 items: { type: string, enum: [read, write] }
 *                 example: [read]
 *               expiresInDays: { type: integer, minimum: 1, maximum: 365, default: 90 }
 *     responses:
 *       201:
 *         description: Token created (copy `data.token` now)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/ApiToken'
 *                     - type: object
 *                       properties:
 *                         token: { type: string, example: 'fpat_3q2+7w…' }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { description: 'Called with an API token (API_TOKEN_NOT_ALLOWED)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: 'Too many active tokens (API_TOKEN_LIMIT_REACHED)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   get:
 *     tags: [API Tokens]
 *     summary: List active personal API tokens
 *     description: Never returns the token or its hash — only the display prefix.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active (not revoked, not expired) tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ApiToken' } }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { description: 'Called with an API token (API_TOKEN_NOT_ALLOWED)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/tokens', authenticateJWT, createApiTokenValidation, validate, apiTokenController.create.bind(apiTokenController));
router.get('/tokens', authenticateJWT, apiTokenController.list.bind(apiTokenController));

/**
 * @openapi
 * /api/users/tokens/{tokenId}:
 *   delete:
 *     tags: [API Tokens]
 *     summary: Revoke a personal API token
 *     description: Takes effect immediately. Another user's token id → 404.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Token revoked }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { description: 'Called with an API token (API_TOKEN_NOT_ALLOWED)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: 'Unknown, already revoked or not yours (API_TOKEN_NOT_FOUND)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.delete('/tokens/:tokenId', authenticateJWT, apiTokenIdValidation, validate, apiTokenController.revoke.bind(apiTokenController));

export { router as userRoutes };
