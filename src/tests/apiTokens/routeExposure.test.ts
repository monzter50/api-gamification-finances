import { describe, it, expect, vi } from 'vitest';
import type { Router } from 'express';
import { authenticateUserOrApiToken } from '../../middleware/auth';
import { routes } from '../../routes';

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

interface Layer {
  route?: { path: string, methods: Record<string, boolean>, stack: Array<{ handle: unknown }> }
  handle: Router & { stack?: Layer[] }
  regexp: RegExp
}

/** Walk the mounted routers and list "METHOD /path" for routes that accept API tokens. */
function apiTokenRoutes (): string[] {
  const found: string[] = [];
  const mounts: Record<string, string> = { auth: '/auth', users: '/users', transactions: '/transactions', budgets: '/budgets', accounts: '/accounts' };
  for (const layer of (routes as unknown as { stack: Layer[] }).stack) {
    const mount = Object.values(mounts).find((m) => layer.regexp.test(m));
    for (const inner of layer.handle.stack ?? []) {
      if (inner.route?.stack.some((h) => h.handle === authenticateUserOrApiToken) === true) {
        for (const method of Object.keys(inner.route.methods)) found.push(`${method.toUpperCase()} ${mount ?? ''}${inner.route.path}`);
      }
    }
  }
  return found.sort();
}

describe('API token exposure', () => {
  const exposed = apiTokenRoutes();

  it('never reaches token management, logout, login, profile writes or the Excel import', () => {
    // The screenshot import IS open to tokens (write scope): its client is the
    // MCP server. The Excel import stays session-only.
    for (const forbidden of ['/users/tokens', '/auth/logout', '/auth/login', '/auth/register', '/transactions/import/xlsx']) {
      expect(exposed.filter((r) => r.includes(forbidden))).toEqual([]);
    }
    expect(exposed).not.toContain('PUT /users/profile');
  });

  it('matches the reviewed allow-list (update this snapshot deliberately)', () => {
    expect(exposed).toMatchInlineSnapshot(`
      [
        "DELETE /accounts/:id",
        "DELETE /budgets/:id",
        "DELETE /budgets/:id/expense/:expenseId",
        "DELETE /budgets/:id/income/:incomeId",
        "DELETE /transactions/:id",
        "GET /accounts/",
        "GET /accounts/:id",
        "GET /auth/me",
        "GET /budgets/",
        "GET /budgets/:id",
        "GET /budgets/:id/expense",
        "GET /budgets/:id/income",
        "GET /budgets/stats",
        "GET /transactions/",
        "GET /transactions/:id",
        "GET /transactions/budget/:budgetId/balance",
        "GET /transactions/monthly/:year/:month",
        "GET /transactions/summary",
        "GET /users/profile",
        "PATCH /budgets/:id/expense",
        "PATCH /budgets/:id/income",
        "POST /accounts/",
        "POST /budgets/",
        "POST /budgets/:id/duplicate",
        "POST /budgets/:id/expense",
        "POST /budgets/:id/income",
        "POST /transactions/",
        "POST /transactions/import/screenshots",
        "POST /transactions/import/screenshots/check",
        "PUT /accounts/:id",
        "PUT /budgets/:id",
        "PUT /budgets/:id/expense/:expenseId",
        "PUT /budgets/:id/income/:incomeId",
        "PUT /transactions/:id",
      ]
    `);
  });
});
