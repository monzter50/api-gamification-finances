import ExcelJS, { type CellValue } from 'exceljs';
import {
  type ExpenseItemType,
  type ParseResult,
  type ParsedExpenseItem,
  type ParsedIncomeItem,
  type ParsedTransaction
} from './types';

/**
 * Parser for the "TARJETAS Y GASTOS" budget workbook → three app entities:
 *  - "Budget track" → transactions (expense ledger; account via Payment/Card)
 *  - "Income"       → income items  (Current income | Expected Amount)
 *  - "Expenses"     → expense items (Category | Expected Amount; Fixed/Variable
 *                     from the "Gastos Fijos / Gastos Variables" section rows)
 */

const SHEET_TRANSACTIONS = 'Budget track';
const SHEET_INCOME = 'Income';
const SHEET_EXPENSES = 'Expenses';

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

const cellToString = (v: CellValue): string => {
  if (v === null || v === undefined) { return ''; }
  if (typeof v === 'string') { return v.trim(); }
  if (typeof v === 'number' || typeof v === 'boolean') { return String(v); }
  if (v instanceof Date) { return v.toISOString(); }
  if (typeof v === 'object') {
    const obj = v as unknown as Record<string, unknown>;
    if (typeof obj.text === 'string') { return obj.text.trim(); }
    if ('result' in obj) { return cellToString(obj.result as CellValue); }
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => (r as { text: string }).text).join('').trim();
    }
  }
  return String(v).trim();
};

const cellToNumber = (v: CellValue): number | null => {
  if (v === null || v === undefined || v === '') { return null; }
  if (typeof v === 'number') { return Number.isFinite(v) ? v : null; }
  if (typeof v === 'object' && 'result' in (v as object)) {
    return cellToNumber((v as { result: CellValue }).result);
  }
  const n = Number(String(v).replace(/[,$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const cellToDateISO = (v: CellValue): string => {
  if (v === null || v === undefined || v === '') { return ''; }
  if (v instanceof Date) { return v.toISOString().slice(0, 10); }
  if (typeof v === 'object' && 'result' in (v as object)) {
    return cellToDateISO((v as { result: CellValue }).result);
  }
  const serial = typeof v === 'number' ? v : Number(v);
  if (Number.isFinite(serial) && serial > 0) {
    return new Date(EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY).toISOString().slice(0, 10);
  }
  return '';
};


/** "Budget track" → expense transactions. */
const parseTransactions = (ws: ExcelJS.Worksheet): ParsedTransaction[] => {
  const rows: ParsedTransaction[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) { return; } // header
    const amount = cellToNumber(row.getCell(4).value); // D Amount Paid
    if (amount === null || amount <= 0) { return; }

    const expense = cellToString(row.getCell(1).value); // A
    const vendor = cellToString(row.getCell(2).value);  // B
    const category = cellToString(row.getCell(3).value); // C
    const date = cellToDateISO(row.getCell(5).value);   // E
    const method = cellToString(row.getCell(6).value);  // F
    const card = cellToString(row.getCell(7).value);    // G
    const paymentSource = [method, card].filter(Boolean).join(' / ');

    const parsed: ParsedTransaction = { date, amount, vendor, type: 'expense' };
    // Description is the expense label (A); the Category (C) drives the
    // expense-item link (expenseItemId), so it's NOT folded into the text.
    const description = expense || category;
    if (description) { parsed.description = description; }
    if (paymentSource) { parsed.paymentSource = paymentSource; }
    if (category) { parsed.category = category; }
    rows.push(parsed);
  });
  return rows;
};

/** "Income" → income items (description + amount only; type/account chosen in UI). */
const parseIncomeItems = (ws: ExcelJS.Worksheet): ParsedIncomeItem[] => {
  const items: ParsedIncomeItem[] = [];
  // Header on row 2 (Current income | Expected Amount | Date); data from row 3.
  for (let rowNumber = 3; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const name = cellToString(row.getCell(1).value);
    if (!name || name === 'Total' || name === 'Sources' || name === 'Name Source') { break; }
    const amount = cellToNumber(row.getCell(2).value);
    if (amount === null || amount <= 0) { continue; }
    items.push({ description: name, amount });
  }
  return items;
};

/**
 * "Expenses" → expense items, with Fixed/Variable from the section headers.
 *
 * Layout: a "Gastos Fijos" block, a blank row, a "Gastos Variables" block, then
 * a blank row that separates the real list from the summary rows (Profit /
 * Saving / Total / VALIDACIÓN / Básicos / Ahorro / Lujos). We can't break on the
 * first blank (one sits between Fijos and Variables), so we stop on the first
 * blank *after* the Variables section begins — that's the end of the real list.
 */
const parseExpenseItems = (ws: ExcelJS.Worksheet): ParsedExpenseItem[] => {
  const items: ParsedExpenseItem[] = [];
  let currentType: ExpenseItemType = 'Fixed';
  let inVariables = false;

  // Iterate by row number (not eachRow) so blank rows are observable.
  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const label = cellToString(row.getCell(1).value); // A Category
    const lower = label.toLowerCase();

    if (lower.includes('gastos fijos')) { currentType = 'Fixed'; continue; }
    if (lower.includes('gastos variables')) { currentType = 'Variable'; inVariables = true; continue; }

    // End of the real list: first blank row once we're past the Variables header.
    if (!label) {
      if (inVariables) { break; }
      continue;
    }
    if (label === 'Category') { continue; }                       // header row, skip
    if (label === 'Total' || label.includes('VALIDACIÓN')) { break; }

    const amount = cellToNumber(row.getCell(2).value); // B Expected Amount
    if (amount === null || amount <= 0) { continue; }   // skip 0/blank-amount rows

    items.push({ description: label, amount, type: currentType });
  }
  return items;
};

export async function parseWorkbook (buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const txSheet = wb.getWorksheet(SHEET_TRANSACTIONS);
  const incomeSheet = wb.getWorksheet(SHEET_INCOME);
  const expenseSheet = wb.getWorksheet(SHEET_EXPENSES);

  const transactions = txSheet ? parseTransactions(txSheet) : [];
  const incomeItems = incomeSheet ? parseIncomeItems(incomeSheet) : [];
  const expenseItems = expenseSheet ? parseExpenseItems(expenseSheet) : [];

  const paymentSources = Array.from(
    new Set(transactions.map((r) => r.paymentSource).filter((s): s is string => Boolean(s)))
  );

  return {
    transactions,
    incomeItems,
    expenseItems,
    paymentSources,
    counts: {
      transactions: transactions.length,
      incomeItems: incomeItems.length,
      expenseItems: expenseItems.length
    }
  };
}
