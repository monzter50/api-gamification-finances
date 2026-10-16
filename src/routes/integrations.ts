import express from 'express';
import { googleIntegrationController } from '../controllers/googleIntegration.controller';
import { authenticateJWT } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { googleSyncRateLimiter } from '../middleware/rateLimiters';
import { syncSheetValidation } from '../validators/googleIntegration.validator';

const router = express.Router();
const ctrl = googleIntegrationController;

/**
 * @openapi
 * /api/integrations/google/connect:
 *   get:
 *     tags: [Integrations]
 *     summary: Start connecting a Google account (Sheets export)
 *     description: |
 *       Returns Google's consent URL. Send the browser there; Google redirects back to
 *       `/api/integrations/google/callback`, which then redirects to
 *       `FRONTEND_URL/settings/integrations?google=connected` (or `google=error&reason=...`).
 *       Scope is `drive.file`: the app can only access spreadsheets it creates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consent URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     url: { type: string, format: uri }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       503:
 *         description: Google integration not configured on this server (GOOGLE_NOT_CONFIGURED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/google/connect', authenticateJWT, ctrl.connect.bind(ctrl));

/**
 * @openapi
 * /api/integrations/google/callback:
 *   get:
 *     tags: [Integrations]
 *     summary: OAuth redirect target (called by Google, not by the SPA)
 *     description: |
 *       Public endpoint — the user is identified by the signed, 10-minute `state`.
 *       Always responds with a 302 to the frontend. Possible `reason` values:
 *       `access_denied`, `google_error`, `invalid_request`, `invalid_state`,
 *       `missing_scope`, `exchange_failed`.
 *     parameters:
 *       - { in: query, name: code, schema: { type: string } }
 *       - { in: query, name: state, schema: { type: string } }
 *       - { in: query, name: error, schema: { type: string } }
 *     responses:
 *       302: { description: Redirect to the frontend integrations page }
 */
router.get('/google/callback', ctrl.callback.bind(ctrl));

/**
 * @openapi
 * /api/integrations/google/status:
 *   get:
 *     tags: [Integrations]
 *     summary: Google connection status for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     configured: { type: boolean, description: 'Server has Google credentials' }
 *                     connected: { type: boolean }
 *                     googleEmail: { type: string, nullable: true }
 *                     spreadsheetId: { type: string, nullable: true }
 *                     spreadsheetUrl: { type: string, nullable: true }
 *                     lastSyncAt: { type: string, format: date-time, nullable: true }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
router.get('/google/status', authenticateJWT, ctrl.status.bind(ctrl));

/**
 * @openapi
 * /api/integrations/google/sheet:
 *   post:
 *     tags: [Integrations]
 *     summary: Create a new export spreadsheet in the user's Drive
 *     description: Replaces the stored export target. The old spreadsheet is left untouched in Drive.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Spreadsheet created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     spreadsheetId: { type: string }
 *                     spreadsheetUrl: { type: string, format: uri }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       409:
 *         description: Google not connected (GOOGLE_NOT_CONNECTED) or must be reconnected (GOOGLE_REAUTH_REQUIRED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: Google unavailable or not configured
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/google/sheet', authenticateJWT, googleSyncRateLimiter, ctrl.createSheet.bind(ctrl));

/**
 * @openapi
 * /api/integrations/google/sheet/sync:
 *   post:
 *     tags: [Integrations]
 *     summary: Export transactions to the Google spreadsheet (on demand)
 *     description: |
 *       Replaces the contents of the tab "Transacciones (app)" — other tabs are never touched.
 *       Creates the spreadsheet on first use, or again if the user deleted it.
 *       Values are written literally (no formula execution). Max 20,000 rows per sync.
 *       Rate limited per user (6/min by default).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from: { type: string, format: date, example: '2026-09-01' }
 *               to: { type: string, format: date, example: '2026-09-30' }
 *               budgetId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Exported
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     spreadsheetId: { type: string }
 *                     spreadsheetUrl: { type: string, format: uri }
 *                     rowsWritten: { type: integer }
 *                     syncedAt: { type: string, format: date-time }
 *                     createdSpreadsheet: { type: boolean }
 *       400: { $ref: '#/components/responses/BadRequestError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404:
 *         description: Budget not found (when filtering by budgetId)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Google not connected (GOOGLE_NOT_CONNECTED) or must be reconnected (GOOGLE_REAUTH_REQUIRED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: More than 20,000 transactions in range (EXPORT_TOO_LARGE)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429: { description: Too many syncs (TOO_MANY_SYNCS) }
 *       503:
 *         description: Google unavailable (GOOGLE_UNAVAILABLE) or not configured (GOOGLE_NOT_CONFIGURED)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/google/sheet/sync', authenticateJWT, googleSyncRateLimiter, syncSheetValidation, validate, ctrl.sync.bind(ctrl));

/**
 * @openapi
 * /api/integrations/google:
 *   delete:
 *     tags: [Integrations]
 *     summary: Disconnect Google (revokes access at Google and deletes the stored token)
 *     description: The exported spreadsheet stays in the user's Drive.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Disconnected (idempotent) }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
router.delete('/google', authenticateJWT, ctrl.disconnect.bind(ctrl));

export { router as integrationRoutes };
