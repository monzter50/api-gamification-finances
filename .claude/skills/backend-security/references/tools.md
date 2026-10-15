# Security tooling

What to run, when, and how. Everything here is free/open-source unless noted. Prefer
running a tool locally first; add it to CI once it's quiet (no unreviewed noise).

## Contents
1. Summary table
2. Dependency scanning
3. Secret scanning
4. Static analysis (SAST)
5. Container & IaC scanning
6. Dynamic testing (DAST)
7. Security tests in Vitest
8. Suggested CI pipeline (GitHub Actions)

---

## 1. Summary

| Layer | Tool | When | Already in repo? |
|---|---|---|---|
| Type safety | `yarn type-check` (tsc strict) | every change | ✅ |
| Lint | `yarn lint` (ESLint) | every change | ✅ |
| Security lint | `eslint-plugin-security` | every change | ❌ add |
| Dependencies | `yarn audit` (Yarn 1) | every PR | ✅ CI (`--groups dependencies --level high`) |
| Dependency updates | Dependabot or Renovate | continuous | ❌ add |
| Secrets in git | gitleaks | pre-commit + CI | ✅ CI |
| SAST | Semgrep (`p/owasp-top-ten`, `p/nodejs`, `p/typescript`) | CI | ❌ add |
| Container image | Trivy (`trivy image`) or Docker Scout | on image build | ❌ add |
| DAST | OWASP ZAP API scan against `/api-docs.json` | staging, before release | ❌ optional |
| Security unit/integration tests | Vitest + supertest | every change | partial (supertest installed, unused) |

## 2. Dependency scanning

```bash
yarn audit --level high          # Yarn 1; non-zero exit on high/critical
yarn audit --groups dependencies # runtime deps only (what ships in the image)
yarn outdated                    # see what's behind
```

Policy: fix High/Critical in runtime deps before release. For a dev-only or
not-reachable advisory, note the reasoning in the PR. Enable Dependabot
(`.github/dependabot.yml`, `package-ecosystem: npm`, weekly) or Renovate to get
update PRs automatically.

## 3. Secret scanning

```bash
brew install gitleaks
gitleaks detect --source . --verbose        # scan full history
gitleaks protect --staged                   # pre-commit: scan staged changes
```

Also enable GitHub secret scanning + push protection in the repo settings (free for
public repos and available on many plans). If a real secret is found: rotate it in
Railway/the provider **first**, then purge history.

## 4. Static analysis (SAST)

```bash
# one-off, no install
docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan \
  --config p/owasp-top-ten --config p/nodejs --config p/typescript --error
```

ESLint security rules (cheap, in the editor):

```bash
yarn add -D eslint-plugin-security
```

```js
// eslint.config.mjs — add to the exported array
import security from 'eslint-plugin-security';
// ...
security.configs.recommended,
```

Expect some noise from `detect-object-injection`; disable that single rule if it
fires mostly on safe bracket access.

Custom Semgrep rules worth adding for this repo (`.semgrep.yml`):
- Prisma `findUnique|update|delete` with `where: { id }` only, in `src/repositories/` → flag for ownership review.
- `data: req.body` or `...req.body` passed to Prisma → mass assignment.
- `res.status(500).json(... error.message ...)` → leakage.
- `process.env.JWT_SECRET ??` / `||` → fail-open secret.

## 5. Container & IaC scanning

```bash
docker build -t gfa:scan --target production .
trivy image --severity HIGH,CRITICAL --ignore-unfixed gfa:scan
trivy config .        # Dockerfile / compose misconfigurations
```

Keep: non-root `USER`, slim base, pruned dev deps, no secrets in build args.

## 6. Dynamic testing (DAST)

Against **staging only** (never prod), using the OpenAPI spec:

```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://<staging-host>/api-docs.json -f openapi -r zap-report.html
```

For authenticated scans, pass a staging test user's token via ZAP's `-z` replacer
config. Manual follow-up with Insomnia: try every `:id` route with another user's ID
(BOLA), send extra fields like `userId`/`balanceCents` (mass assignment), oversized
bodies, and wrong content types.

## 7. Security tests in Vitest

`supertest` is already a dev dependency. Valuable tests, in priority order:

1. **BOLA:** user B requesting/updating/deleting user A's resource → 404, and A's row unchanged.
2. **Mass assignment:** `PUT /accounts/:id` with `{ balanceCents: 999999, userId: 'other' }` → those fields ignored.
3. **Auth:** missing/garbled/expired/blacklisted token → 401; superseded `sid` → 440.
4. **Leakage:** forced service error in production mode → 500 body is `'Internal server error'`, no stack.
5. **Validation:** non-UUID `:id` → 400, `limit=10000` → 400.

Service-level ownership tests can run with mocked repositories now (pattern in
`tests/financeRules/transactionService.test.ts`); HTTP-level tests need either mocks for
`authenticateJWT`'s DB calls or a dedicated test database.

## 8. Suggested CI pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: ci
on: [pull_request, push]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: yarn }
      - run: yarn install --frozen-lockfile
      - run: yarn prisma generate
      - run: yarn type-check
      - run: yarn lint
      - run: yarn test --run
      - run: yarn audit --level high --groups dependencies
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
  sast:
    runs-on: ubuntu-latest
    container: semgrep/semgrep
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan --config p/owasp-top-ten --config p/nodejs --config p/typescript --error
```

Pin action versions to what's current when you add this, and start `semgrep` and
`yarn audit` as non-blocking (`continue-on-error: true`) until the baseline is clean.
