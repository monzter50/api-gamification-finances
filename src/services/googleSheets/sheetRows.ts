import { fromCents } from '../../utils/money';
import { type SheetTable } from './googleGateway.port';

/**
 * Pure mapping: transactions → spreadsheet table. No I/O, fully unit-tested.
 *
 * - Money comes from the integer-cents column (exact), written as a number.
 * - Dates are written as Sheets date serial numbers (days since 1899-12-30,
 *   UTC) and formatted as dates by the adapter, so they sort/filter as real
 *   dates without ever letting Sheets parse user text.
 * - Text is written verbatim; the adapter uses valueInputOption RAW so a
 *   vendor like "=IMPORTXML(...)" stays text and never runs as a formula.
 */

export interface ExportTransaction {
  id: string
  date: Date
  type: string
  amountCents: number
  vendor: string
  description: string | null
  account: { name: string, currency: string } | null
  budget: { year: number, month: number } | null
  incomeItem: { description: string } | null
  expenseItem: { description: string } | null
}

export const SHEET_HEADER = [
  'Fecha',
  'Tipo',
  'Monto',
  'Moneda',
  'Comercio',
  'Descripción',
  'Cuenta',
  'Presupuesto',
  'Partida',
  'ID'
];

const TYPE_LABELS: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto'
};

const MS_PER_DAY = 86_400_000;
/** Sheets/Excel epoch: 1899-12-30T00:00:00Z. */
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Calendar date (UTC) → Sheets date serial number. */
export const toSheetsDateSerial = (date: Date): number => {
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((midnightUtc - SHEETS_EPOCH_MS) / MS_PER_DAY);
};

/** Budget period as YYYY-MM (stored month is 0-based). */
const budgetLabel = (budget: ExportTransaction['budget']): string =>
  budget === null ? '' : `${budget.year}-${String(budget.month + 1).padStart(2, '0')}`;

export const toSheetTable = (transactions: ExportTransaction[]): SheetTable => ({
  header: SHEET_HEADER,
  rows: transactions.map((tx) => [
    toSheetsDateSerial(tx.date),
    TYPE_LABELS[tx.type] ?? tx.type,
    fromCents(tx.amountCents),
    tx.account?.currency ?? '',
    tx.vendor,
    tx.description ?? '',
    tx.account?.name ?? '',
    budgetLabel(tx.budget),
    tx.incomeItem?.description ?? tx.expenseItem?.description ?? '',
    tx.id
  ]),
  dateColumns: [0],
  moneyColumns: [2]
});
