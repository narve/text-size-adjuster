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
| `line-height-mixed` | `normal`, unitless, and explicit px line-heights side by side | FR2.3 |
| `large-dom-performance` | a few thousand text nodes (simulated feed/article) | FR7.1, FR7.2 |

## TR1a. Real-world site snapshots

In addition to the synthetic TR1 fixtures (which each isolate one technique), a second fixture
set is built from actual popular websites, to catch real-world combinations the synthetic
fixtures miss:

- A script (`fixtures/real-world/download.mjs`) takes a configurable list of `{ id, url }`
  entries — starting with `ap.no` and `news.ycombinator.com`, plus a handful of other popular,
  internationally-known sites with varied styling approaches (final list finalized during
  implementation; aim for a mix of news, reference/wiki-style, and app-like/SPA sites) — loads
  each with Playwright, waits for network idle, and saves the rendered HTML with relative
  asset URLs rewritten to absolute ones (so the snapshot keeps the live site's real CSS/images
  without fully mirroring every asset).
- Snapshots are written to `fixtures/real-world/snapshots/<id>/index.html` and are **not**
  committed to git (gitignored) — they go stale and redistributing copies of third-party site
  markup in the repo is avoided; they're regenerated on demand via `npm run fixtures:download`
  before a test run that needs them.
- The download script is polite: a small delay between requests, one request per site, and it
  only ever fetches a single top-level page per site (no crawling).
- These snapshots feed into both Layer 1 (TR2 — ratio-preservation and performance checks apply
  here too, alongside the synthetic fixtures) and the documentation site gallery (TR5 — framed
  screenshots of the tool working on recognizable, real sites).
- Because external sites change over time and the download step requires network access, these
  checks are informative, not required to be pixel-stable release-to-release the way the
  synthetic TR1 fixtures are; a snapshot that fails to download (site down, network restricted)
  is skipped with a warning rather than failing the whole suite.

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
- **Chrome bonus (FR8.3)**: unlike Firefox, Playwright officially supports loading an unpacked
  extension into Chromium via `launchPersistentContext`. If/when a Chrome manifest variant
  exists, the same Layer 2 scenarios can run against Chromium through the *official* mechanism —
  this is a nice-to-have addition, not a requirement, and Firefox's Layer 2 stays best-effort
  regardless of whether the Chrome variant is added.

## TR4. Layer 3 — Firefox for Android (manual, not automated)

Own document: `android-manual-qa-checklist.md`. Step-by-step walkthrough (sideload the extension
or install the userscript via a mobile userscript manager) against a representative fixture
subset, with explicit pass/fail criteria, to be checked by hand per release.

## TR5. Documentation site (end-user-facing only)

- **TR5.0**: The generated documentation site is aimed at *users* of the userscript/extension —
  people deciding whether to install it and how. It must not contain build instructions,
  repository/package layout, or publishing/release process — that content belongs in TR6's
  separate developer guide instead, so a user isn't wading through contributor material to find
  "how do I install this."
- **TR5.1**: Building the documentation site is part of the standard build pipeline
  (`npm run build`), not a separate, easily-forgotten manual step. `npm run build` must leave
  behind a complete, up-to-date `docs-site/dist/`.
- **TR5.2**: The site explains the functionality (what it does, the ratio-preserving scaling
  approach, the known limitations from FR6) and installation for all four combinations: Firefox
  Desktop userscript, Firefox Desktop extension, Firefox Android userscript, Firefox Android
  extension (sideloading).
- **TR5.2a**: The site briefly explains how this differs from permanently changing the browser's
  or OS's font-size/zoom accessibility settings (FR1.4): those apply everywhere, all the time,
  and often just zoom the whole layout (causing sideways scrolling) rather than reflowing text;
  this tool is per-page, resets on reload unless persistence is explicitly enabled for that site
  (FR5), and reflows text within the existing layout instead of zooming it. A couple of sentences
  is enough — this isn't a FAQ, just enough context for a reader to understand why this exists
  alongside those settings rather than instead of them.
- **TR5.2b**: The site includes a short, **non-technical** "what this can't fix" section
  translating FR6's limitations into plain language — no "same-origin policy", "shadow DOM", or
  "specificity." E.g.: ads/embeds/some comment sections may not resize (they're loaded from
  another website embedded in the page, which browsers don't let any tool reach into); a few
  sites hide content in sealed components nothing outside can touch (rare); text in a small
  fixed-size box may get cut off if enlarged a lot (the same thing can happen with a phone's own
  zoom); and occasionally one specific piece of text on a site may resist resizing. The
  *technical* explanation of the same limitations (root cause, impact, why no workaround was
  taken) belongs in the developer guide instead (TR6.3) — a user doesn't need the "why", just
  honest expectations.
- **TR5.3**: It includes a screenshot gallery generated from Layer 1's artifacts: one page per
  fixture, before/after image pairs per factor — including the TR1a real-world site snapshots,
  as the most relatable demonstration of the tool for a reader deciding whether to install it.
- **TR5.4**: Gallery screenshots presented to a human reader must be composited with browser
  "chrome" — a desktop browser frame (title bar, address bar showing the fixture's URL,
  traffic-light buttons) or a mobile phone frame (bezel), as appropriate — rather than bare,
  edge-to-edge page captures. This is distinct from Layer 1's plain/unframed screenshots, which
  stay bare because they're also used for internal pixel/ratio measurement (TR2); the docs site
  only ever shows the framed versions.

- **TR5.5** (if feasible): each fixture's gallery page links to a **live, interactive demo** —
  not just static before/after screenshots. The docs-site build copies each fixture page into
  `docs-site/dist/demos/<fixture-id>/` with the built core engine and floating widget
  auto-attached, so a reader can click real +/- buttons and see the effect themselves. This is
  fully static (no backend beyond serving the docs site itself) for every fixture except
  `iframe-cross-origin`, whose live demo depends on the local two-port test server setup and may
  not work once the docs site is served/deployed elsewhere — document that one exception rather
  than silently shipping a broken demo.

**Acceptance**: `npm run build` produces a browsable `docs-site/dist/` with working internal
links and all gallery images present in framed form; no manual copying or framing of
screenshots. Live demo links (TR5.5) work when the site is served via `npm run docs:serve`.

## TR6. Developer guide (separate from the docs site)

- **TR6.1**: A hand-maintained document, `docs/developer-guide.md`, lives in the repo (not in
  `docs-site/`, and not generated) and covers what the end-user site deliberately excludes
  (TR5.0): repo/workspace layout, how to build and run the test suite locally, and — explicitly
  requested — **how to publish each delivery mechanism**:
  - Firefox Desktop extension: AMO listed vs. unlisted submission via `web-ext sign` /
    addons.mozilla.org.
  - Firefox Android extension: the `gecko_android` manifest requirement and the unlisted
    self-distribution signing path used for the manual QA checklist, plus what store listing
    would additionally require.
  - Chrome extension (FR8, best-effort): packaging the `manifest.chrome.json` variant and the
    Chrome Web Store developer dashboard submission flow, kept brief since it's not a primary
    target.
  - Userscript: direct `.user.js` distribution vs. optionally publishing to Greasy Fork.
- **TR6.2**: `README.md` at the repo root documents the reading order across all of `docs/` plus
  the generated docs site, so a newcomer (user or contributor) knows where to start.
- **TR6.3**: The developer guide includes a "known problems" section covering each FR6
  limitation (plus any other non-obvious issue hit during implementation) from a *technical*
  angle: root cause, actual impact/frequency, and what workaround — if any — was considered and
  why it was or wasn't taken. This is the mirror of TR5.2b's plain-language version for the
  implementation audience.
