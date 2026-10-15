---
name: backend-code-review
description: >
  Backend code review for this Express + TypeScript + Prisma finance API: checks a diff,
  branch, PR, or set of files against the repo's architecture and good practices —
  layering, authorization/ownership (IDOR), validation, error handling and leakage,
  money correctness, atomic balance updates, N+1 and query performance, migrations
  safety, security, observability, and tests — and reports ranked, actionable findings.
  Use this skill whenever the user asks to review, audit, check, critique, or sanity-check
  backend code ("review my changes", "is this endpoint ok?", "check this PR", "anything
  wrong with this service?", "before I merge..."), or after you finish a non-trivial
  backend change and want to self-review it before reporting done.
---

# Backend code review (this repo)

The goal is to find the problems that would actually hurt: **users seeing each other's
data, money or balances going wrong, internals leaking, and production breaking on
deploy**. Style nits are last and optional.

## 1. Establish scope

- No target given → review the working tree: `git diff` + `git diff --staged` +
  untracked files under `src/` and `prisma/`.
- Branch/PR → `git diff main...HEAD` (or `gh pr diff <n>`).
- Specific files → those files, but read their callers/callees enough to judge context.

Read the **full** changed functions, not just diff hunks — ownership bugs usually live
in what the hunk *doesn't* show (the query a new service method relies on, the route
that forgot a validator).

## 2. Review against the checklist

Work through `references/checklist.md`. It's grouped by severity; each item says what to
look for and why it matters here. Use the sibling skills as the standard when you need
detail: `backend-api-design` (contract), `backend-data-practices` (data/money),
`backend-security` (auth, secrets, uploads, AI integrations) and `backend-architecture`
(layers, where code belongs, approved tools).

Run the cheap automated gates too, and report their result:

```bash
yarn type-check
yarn lint
yarn test
```

If the schema changed, also inspect the migration SQL under `prisma/migrations/`.

## 3. Verify before reporting

For each candidate finding, confirm it's real: trace the actual code path (does a
middleware or the service already handle it? is the query scoped somewhere upstream?).
Drop anything you can't substantiate, or label it clearly as a question. A short list of
true problems beats a long list with noise — false positives teach people to ignore
reviews.

Distinguish **introduced by this change** from **pre-existing in touched code**.
Pre-existing issues go in a separate short section; don't block a PR on them.

## 4. Report format

```markdown
## Review: <scope>

**Verdict:** Ship / Ship after fixes / Needs rework — one sentence why.
**Gates:** type-check ✅/❌ · lint ✅/❌ · tests ✅/❌ (n passed)

### Critical
1. **<short title>** — `src/path/file.ts:123`
   What's wrong, the concrete failure scenario (input → bad outcome), and the fix
   (code snippet if it's short).

### High
### Medium
### Low / nits   (optional, max ~5)

### Pre-existing (not introduced here)
- `file:line` — one line each.

### Looks good
- 1–3 bullets on things done well (only if genuinely notable).
```

Severity guide:
- **Critical** — cross-user data access, money/balance corruption, secrets or internal
  errors leaked, auth bypass, migration that breaks or loses data on deploy.
- **High** — missing validation on input that reaches the DB, non-atomic multi-write,
  unhandled async error (hung request), N+1 on a hot path, breaking API contract change
  not called out.
- **Medium** — layering violation, string-matched errors, missing tests for a money
  rule, missing index for a new query, inconsistent envelope.
- **Low** — naming, duplication, `any` that could be typed, comments.

Omit empty severity sections. If there's nothing above Low, say so plainly.

## 5. If asked to fix

Only edit after the user asks (or if the review was part of your own just-finished
change). Fix Critical/High first, re-run the gates, and re-report what changed.
