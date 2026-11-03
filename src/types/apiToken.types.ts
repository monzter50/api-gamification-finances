/**
 * Personal API token types.
 *
 * Scopes are coarse on purpose: `read` = GET/HEAD, `write` = everything else
 * (on the routes that accept API tokens at all). A token with `write` but not
 * `read` makes no sense, so `write` always implies `read`.
 */
export const API_TOKEN_SCOPES = ['read', 'write'] as const;
export type ApiTokenScope = typeof API_TOKEN_SCOPES[number];

/** What the API returns about a token. Never includes the hash or the raw token. */
export interface ApiTokenView {
  id: string
  name: string
  tokenPrefix: string
  scopes: ApiTokenScope[]
  expiresAt: Date
  lastUsedAt: Date | null
  createdAt: Date
}

/** Returned once, on creation. */
export interface CreatedApiTokenView extends ApiTokenView {
  token: string
}

export interface CreateApiTokenInput {
  name: string
  scopes: ApiTokenScope[]
  expiresInDays?: number
}
