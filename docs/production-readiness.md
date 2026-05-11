# Production Readiness

ArcPay's production-readiness gate is split into code checks, browser checks,
security checks, and runtime-specific checks.

## Local Checks

```bash
npm test --workspaces --if-present
npm run build -w @arcpay/frontend
npm run build -w @arcpay/agent
npm run build -w @arcpay/sdk
npm run build -w @arcpay/server
```

The Solana program workspace requires Anchor:

```bash
anchor build
anchor test
```

Run those from an environment where Anchor is installed, usually Linux or WSL.
The current Windows shell does not expose `anchor`. A Windows AVM install was
attempted and failed because Rust MSVC needs Visual Studio Build Tools
`link.exe`; the official Anchor route remains Ubuntu/WSL or native Linux with
Solana CLI + AVM installed.

## Browser / Responsive Checks

Playwright is installed in `@arcpay/frontend`.

Install the browser runtime once:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:e2e -w @arcpay/frontend
```

The current E2E suite checks:

- landing page renders on mobile, tablet, and desktop;
- dashboard renders on mobile, tablet, and desktop;
- sign-in, sign-up, password recovery, profile, and settings routes render on
  mobile, tablet, and desktop;
- no horizontal overflow at those widths;
- dashboard exposes honest track states for QVAC, LP Agent, Ika, and PUSD.

## Security Audit

Run:

```bash
npm run security:audit
```

Current known audit notes:

- Frontend runs on `next@16.2.6` and has passing build/E2E checks. `npm audit`
  still flags Next's vendored `postcss@8.4.31`; Next 16.2.6 still declares that
  dependency, so `npm audit fix --force` is not safe and currently proposes a
  nonsensical downgrade path.
- `@cloak.dev/sdk-devnet` pulls transitive crypto dependencies with advisories
  through `@solana/spl-token`, `circomlibjs`, and `ethers`. Do not force-downgrade
  Solana packages; track sponsor SDK updates instead.
- `elliptic` is already installed at `6.6.1`, but npm still flags the
  `ethers@5` dependency chain. `bigint-buffer` and `underscore` remain through
  the Cloak devnet proof dependency tree.
- Non-breaking fixes and safe updates were applied. Remaining advisories are
  sponsor/upstream dependency issues, not first-party ArcPay code.

These are not hidden. They must be called out before production deployment.

## Runtime-Specific Checks

QVAC:

```bash
bash scripts/qvac-runtime-proof.sh
```

Run only on native Linux x64. WSL is not accepted for final QVAC proof.

Solana program:

```bash
cd packages/program
anchor build
anchor test
```

Run where Anchor is installed.
