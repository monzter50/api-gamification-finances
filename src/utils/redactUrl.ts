/**
 * Mask secrets carried in query strings (OAuth `code`/`state`, tokens) before
 * a URL is written to any log. Used by the HTTP access log and errorHandler.
 */
const SENSITIVE_QUERY_PARAMS = ['code', 'state', 'token', 'access_token', 'refresh_token', 'id_token'];

export function redactUrl (raw: string): string {
  const q = raw.indexOf('?');
  if (q === -1) return raw;
  const params = new URLSearchParams(raw.slice(q + 1));
  let changed = false;
  for (const name of SENSITIVE_QUERY_PARAMS) {
    if (params.has(name)) {
      params.set(name, '[REDACTED]');
      changed = true;
    }
  }
  return changed ? `${raw.slice(0, q)}?${params.toString()}` : raw;
}
