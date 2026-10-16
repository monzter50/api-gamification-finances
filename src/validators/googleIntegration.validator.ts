import { body } from 'express-validator';

/** POST /api/integrations/google/sheet/sync — all filters optional. */
export const syncSheetValidation = [
  body('from')
    .optional()
    .isISO8601()
    .withMessage('from must be a valid ISO 8601 date'),
  body('to')
    .optional()
    .isISO8601()
    .withMessage('to must be a valid ISO 8601 date')
    .custom((to: string, { req }) => {
      const from = (req.body as { from?: string }).from;
      return from === undefined || new Date(from) <= new Date(to);
    })
    .withMessage('to must be on or after from'),
  body('budgetId')
    .optional()
    .isUUID()
    .withMessage('Budget ID must be a valid UUID')
];
