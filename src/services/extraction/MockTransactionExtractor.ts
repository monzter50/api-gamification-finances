import { type ExtractionResult, type TransactionExtractor } from './types';

/**
 * Mock extractor used until a real ANTHROPIC_API_KEY is configured.
 *
 * Ignores the image and returns a realistic statement extraction so the whole
 * upload → review → bulk-create flow can be built and tested end-to-end. The
 * rows deliberately exercise the review UI's edge cases:
 *  - mixed income / expense
 *  - a `medium` and a `low` confidence row
 *  - one row with an empty `date` (unreadable) that must be fixed before saving
 *
 * The output shape is byte-identical to what ClaudeTransactionExtractor will
 * return, so swapping in the real extractor needs no downstream changes.
 */
export class MockTransactionExtractor implements TransactionExtractor {
  readonly source = 'mock' as const;

  async extract (_image: Buffer, _mimeType: string): Promise<ExtractionResult> {
    return {
      currencyHint: 'MXN',
      transactions: [
        {
          date: '2026-05-03',
          amount: 1250.0,
          vendor: 'ACME Payroll',
          type: 'income',
          confidence: 'high',
          sourceText: '05/03 ACME PAYROLL DEPOSIT 1,250.00'
        },
        {
          date: '2026-05-05',
          amount: 84.2,
          vendor: 'Whole Foods Market',
          type: 'expense',
          description: 'Groceries',
          confidence: 'high',
          sourceText: '05/05 WHOLEFDS #123 84.20'
        },
        {
          date: '2026-05-07',
          amount: 12.99,
          vendor: 'Netflix',
          type: 'expense',
          confidence: 'high',
          sourceText: '05/07 NETFLIX.COM 12.99'
        },
        {
          date: '2026-05-11',
          amount: 45.0,
          vendor: 'Shell',
          type: 'expense',
          description: 'Fuel',
          confidence: 'medium',
          sourceText: '05/11 SHELL OIL 5732 45.00'
        },
        {
          date: '',
          amount: 30.0,
          vendor: 'Refund - Amazon',
          type: 'income',
          confidence: 'low',
          sourceText: '05/?? AMZN refund 30.00 (date smudged)'
        }
      ]
    };
  }
}
