import { logger } from '../../config/logger';
import { ClaudeTransactionExtractor } from './ClaudeTransactionExtractor';
import { MockTransactionExtractor } from './MockTransactionExtractor';
import { type TransactionExtractor } from './types';

export { type ExtractedTransaction, type ExtractionResult, type TransactionExtractor } from './types';

/**
 * Select the extractor implementation:
 *  - mock if `USE_MOCK_EXTRACTION=true` (force, even with a key — useful in tests)
 *  - mock if there is no `ANTHROPIC_API_KEY`
 *  - otherwise the real Claude extractor
 *
 * Evaluated once at module load (matches the singleton pattern used across the
 * codebase). Note: changing the env requires a restart to switch extractors.
 */
function selectExtractor (): TransactionExtractor {
  const forceMock = process.env.USE_MOCK_EXTRACTION === 'true';
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (forceMock || !hasKey) {
    logger.info(`Transaction extractor: mock${forceMock ? ' (forced)' : ' (no ANTHROPIC_API_KEY)'}`);
    return new MockTransactionExtractor();
  }

  logger.info('Transaction extractor: claude');
  return new ClaudeTransactionExtractor();
}

export const transactionExtractor: TransactionExtractor = selectExtractor();
