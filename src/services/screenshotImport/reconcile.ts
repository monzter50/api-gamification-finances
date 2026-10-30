/**
 * Count reconciliation: the heart of import idempotency.
 *
 * Two rules (plan, "Conciliación por conteo"):
 *  1. Within a batch, `n` for a fingerprint is the MAX number of times it
 *     appears in any single image, not the sum. Overlapping screenshots repeat
 *     rows across images; legitimate identical purchases show up together in
 *     the same image.
 *  2. Against the DB, insert `max(0, n − m)`, where `m` is how many rows with
 *     that fingerprint the user already has.
 *
 * Pure function: the service runs it inside a transaction holding a per-user
 * advisory lock, so `m` cannot change underneath it.
 */
export const planInsertions = <Row extends { fingerprint: string }>(
  images: ReadonlyArray<{ rows: readonly Row[] }>,
  existingCounts: ReadonlyMap<string, number>
): { toInsert: Row[], skippedAsDuplicate: number } => {
  // fingerprint → the rows of the image where it appears most often
  const best = new Map<string, Row[]>();
  let totalRows = 0;

  for (const image of images) {
    const perImage = new Map<string, Row[]>();
    for (const row of image.rows) {
      totalRows++;
      const list = perImage.get(row.fingerprint);
      if (list) list.push(row); else perImage.set(row.fingerprint, [row]);
    }
    for (const [fp, rows] of perImage) {
      if (rows.length > (best.get(fp)?.length ?? 0)) best.set(fp, rows);
    }
  }

  const toInsert: Row[] = [];
  for (const [fp, rows] of best) {
    const missing = rows.length - (existingCounts.get(fp) ?? 0);
    if (missing > 0) toInsert.push(...rows.slice(0, missing));
  }
  return { toInsert, skippedAsDuplicate: totalRows - toInsert.length };
};
