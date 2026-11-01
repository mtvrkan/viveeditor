# Contributing to viveEditor

Thank you for helping. A few rules keep the editor solid:
1. **Open an issue first** for anything larger than a small fix, so the design can be agreed before code is written.
2. **Run `pnpm verify` before every pull request.** It runs lint, type checks, unit tests, the build, the size budget, the API report, the package checks and end-to-end tests in Chromium, Firefox and WebKit.
   If you change a public type on purpose, run `pnpm api:update` and commit the `api/` difference with the change.
3. **Every behaviour change ships with tests** — a unit test for the logic and an end-to-end test for anything a user can see or type.
4. **Respect the size budget.** If a change grows a package past its limit in `package.json`, explain why in the pull request.
   For changes that touch typing, loading, paste or export, also run the runtime budgets: `PERF=1 pnpm exec playwright test tests/e2e/perf.spec.ts --project=chromium` (add `PERF_CPU=6` to simulate a slower phone).
5. **Add a changeset** with `pnpm changeset` for any change to a published package.
6. **No code comments.** Prefer clear names and small functions; put the reasoning in the pull request description.
7. **English identifiers**, user-facing strings go through the i18n package.

## Security issues

Do not open a public issue for a vulnerability — see [SECURITY.md](./SECURITY.md).
