# Test & Documentation Requirements — Text Size Adjuster

This document describes **what** must be validated and documented, and with what priority. See
`functional-requirements.md` for the requirements being validated (referenced below as FR*) and
`implementation-plan.md` for how the suite is built.

## Priority statement

The hard requirement is **Layer 1** below: the scaling engine must work correctly and perform
well across varied, realistic page structures. Automated testing of the packaged browser
extension end-to-end (Layer 2) is best-effort only, since Playwright has no official
Firefox-extension-loading support. Firefox-for-Android cannot be automated at all (Layer 3) and
is covered by a manual checklist instead.

## TR1. Fixture sites

Served locally for Playwright. Each fixture isolates one real-world CSS technique and traces to
functional requirements:

| Fixture | Exercises | Traces to |
|---|---|---|
| `plain-px` | hardcoded px sizes everywhere | FR1.2, FR2.1 |
| `rem-em` | root-relative sizing | FR1.2, FR2.1 |
| `nested-em` | deeply nested relative inheritance | FR2.1, FR2.4 |
| `shadow-dom-open` | open shadow root content | FR4, FR6.2 boundary |
| `iframe-same-origin` | same-origin embedded frame | engine reach boundary |
| `iframe-cross-origin` | genuinely different origin (second host:port) | FR6.1 (must not break, just not scale) |
| `overflow-clipping` | fixed-height/overflow containers | FR6.3 (documented, not "fixed") |
| `important-high-specificity` | page CSS with `!important` + ID/class selectors | FR2.5 |
| `spa-mutation` | content injected after load via JS | FR2.4 |
| `line-height-mixed` | unitless, `normal`, and px line-heights side by side | FR2.3 |
| `large-dom-performance` | a few thousand text nodes (simulated feed/article) | FR7.1, FR7.2 |

## TR2. Layer 1 — automated engine validation (hard requirement)

- Runs against real Firefox (and Chromium, as a cross-engine sanity check, since the logic is
  standards-based) via Playwright.
- The actual built core bundle (not hand-copied source) is injected into each fixture page.
- For each fixture, assert at factors `[0.5, 0.8, 1.0, 1.5, 2.0, 3.0]`:
  - size ratios between marked "small"/"large" reference elements are preserved within
    tolerance,
  - no new horizontal overflow is introduced,
  - `line-height-mixed`'s three line-height kinds behave per FR2.3.
- `large-dom-performance`: record wall-clock time for (a) initial capture+apply and (b) a
  subsequent factor change; assert (b) is at least an order of magnitude faster than (a), and
  both stay under documented thresholds.
- Capture a full-page screenshot per fixture per factor (before/after) into a predictable
  artifact path for the docs site.

## TR3. Layer 2 — extension integration (best-effort, non-blocking)

- Uses the real packaged extension loaded into Firefox via the community `playwright-webextext`
  mechanism.
- Covers: content script auto-attaches and the widget appears; adjusting the factor persists
  per-origin and reapplies after reload; the popup page (opened directly by URL) drives the same
  engine via messaging.
- Runs as a separate, explicitly non-gating test command. If `playwright-webextext` breaks on a
  Playwright/Firefox version bump, this layer may be skipped without blocking the project —
  documented as a known risk, not silently ignored.

## TR4. Layer 3 — Firefox for Android (manual, not automated)

Own document: `android-manual-qa-checklist.md`. Step-by-step walkthrough (sideload the extension
or install the userscript via a mobile userscript manager) against a representative fixture
subset, with explicit pass/fail criteria, to be checked by hand per release.

## TR5. Documentation site

A static, locally-buildable site containing:

- Install guides: Firefox Desktop userscript, Firefox Desktop extension, Firefox Android
  userscript, Firefox Android extension (sideloading).
- A screenshot gallery generated from Layer 1's artifacts: one page per fixture, before/after
  image pairs per factor.

**Acceptance**: `npm run docs:build` produces a browsable `docs-site/dist/` with working internal
links and all gallery images present; no manual copying of screenshots.
