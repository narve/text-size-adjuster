# Test & Documentation Requirements — Text Size Adjuster

This document describes **what** must be validated and documented, and with what
priority. See `functional-requirements.md` for the requirements being validated
(referenced below as FR*) and `implementation-plan.md` for how the suite is
built.

## Priority statement

The hard requirement is **Layer 1** below: the scaling engine must work
correctly and perform well across varied, realistic page structures. Automated
testing of the packaged browser extension end-to-end (Layer 2) is best-effort
only, since Playwright has no official Firefox-extension-loading support.
Firefox-for-Android cannot be automated at all (Layer 3) and is covered by a
manual checklist instead.

## TR1. Fixture sites

Served locally for Playwright. Each fixture isolates one real-world CSS
technique and traces to functional requirements. The list, with what each
fixture exercises and which FR it traces to, is `fixtures/fixtures.json`; the
Layer 1 specs and the docs site both read it. Notes on two of them:

- `overflow-clipping` documents FR6.3 rather than "fixing" it.
- `iframe-cross-origin` is served from a second port (a genuinely different
  origin). Layer 1 confirms the bare engine (userscript-equivalent) leaves it
  alone without erroring; Layer 2 confirms the packaged extension _does_ scale
  it via `all_frames` injection.

## TR1a. Real-world site snapshots

In addition to the synthetic TR1 fixtures (which each isolate one technique), a
second fixture set is built from actual popular websites, to catch real-world
combinations the synthetic fixtures miss:

- `fixtures/real-world/download.js` loads each site listed in
  `fixtures/real-world/sites.json` on an emulated phone and saves it as a
  **static** snapshot. How (and why scripts are stripped) is described in that
  script's header comment.
- Snapshots are **not** committed to git (gitignored) — they go stale, and
  redistributing copies of third-party site markup in the repo is avoided.
  They're regenerated on demand via `npm run download -w fixtures`.
- The download script is polite: a small delay between requests, and only a
  single top-level page per site (no crawling).
- These snapshots have their own Playwright suite (`npm run test:real-world`),
  separate from Layer 1, and feed the documentation site gallery (TR5 — framed
  screenshots of the tool working on recognizable, real sites).
- Because external sites change over time and the download step requires network
  access, these checks are informative, not required to be pixel-stable
  release-to-release the way the synthetic TR1 fixtures are; a snapshot that
  fails to download (site down, network restricted) is skipped with a warning
  rather than failing the whole suite.

## TR2. Layer 1 — automated engine validation (hard requirement)

- Runs against real Firefox (and Chromium, as a cross-engine sanity check, since
  the logic is standards-based) via Playwright.
- The actual built core bundle (not hand-copied source) is injected into each
  fixture page.
- For each fixture, assert at factors `[0.5, 0.8, 1.0, 1.5, 2.0, 3.0]`:
  - size ratios between marked "small"/"large" reference elements are preserved
    within tolerance,
  - no new horizontal overflow is introduced,
  - `line-height-mixed`'s three line-height kinds behave per FR2.3.
- `large-dom-performance`: record wall-clock time for (a) initial capture+apply
  and (b) a subsequent factor change; assert (b) is at least an order of
  magnitude faster than (a), and both stay under documented thresholds.
- Capture a phone-viewport screenshot of each standard fixture at 1× and 2×
  (Chromium) into a predictable artifact path for the docs site.

## TR3. Layer 2 — extension integration (best-effort, non-blocking)

- Uses the real packaged extension loaded into Firefox via the community
  `playwright-webextext` mechanism.
- Covers: content script auto-attaches and the widget appears; adjusting the
  factor persists per-origin and reapplies after reload; the popup page (opened
  directly by URL) drives the same engine via messaging.
- Runs as a separate, explicitly non-gating test command. If
  `playwright-webextext` breaks on a Playwright/Firefox version bump, this layer
  may be skipped without blocking the project — documented as a known risk, not
  silently ignored.
- **Chrome bonus (FR8.3)**: unlike Firefox, Playwright officially supports
  loading an unpacked extension into Chromium via `launchPersistentContext`.
  If/when a Chrome manifest variant exists, the same Layer 2 scenarios can run
  against Chromium through the _official_ mechanism — this is a nice-to-have
  addition, not a requirement, and Firefox's Layer 2 stays best-effort
  regardless of whether the Chrome variant is added.

## TR4. Layer 3 — Firefox for Android (manual, not automated)

Own document: `android-manual-qa-checklist.md`. Step-by-step walkthrough
(sideload the extension or install the userscript via a mobile userscript
manager) against a representative fixture subset, with explicit pass/fail
criteria, to be checked by hand per release.

## TR5. Documentation site (end-user-facing only)

- **TR5.0**: The generated documentation site is aimed at _users_ of the
  userscript/extension — people deciding whether to install it and how. It must
  not contain build instructions, repository/package layout, or
  publishing/release process — that content belongs in TR6's separate developer
  guide instead, so a user isn't wading through contributor material to find
  "how do I install this."
- **TR5.1**: Building the documentation site is part of the standard build
  pipeline (`npm run build`, see the developer guide's command list), not a
  separate, easily-forgotten manual step. It must leave behind a complete,
  up-to-date `docs-site/dist/`.
- **TR5.2**: The site explains the functionality (what it does, the
  ratio-preserving scaling approach, the known limitations from FR6) and
  installation. The front page's install section is for end users only: one
  path, the extension (FR3.1) on Firefox desktop and Android, plus how to use
  it. The userscript (FR3.2) and manual extension installs are for technical
  users and sit under a separate "Advanced installation" heading.
- **TR5.2a**: The site briefly explains how this differs from permanently
  changing the browser's or OS's font-size/zoom accessibility settings: those
  apply everywhere, all the time, and often just zoom the whole layout (causing
  sideways scrolling) rather than reflowing text; this tool applies only to the
  sites you adjust (the extension remembers each site's size, FR5.1; the
  userscript and script tag reset on reload, FR1.4), and reflows text within the
  existing layout instead of zooming it. A couple of sentences is enough — this
  isn't a FAQ, just enough context for a reader to understand why this exists
  alongside those settings rather than instead of them.
- **TR5.2b**: The site includes a short, **non-technical** "what this can't fix"
  section translating each FR6 limitation into plain language — no "same-origin
  policy", "shadow DOM", or "specificity"
  (`docs-site/src/guides/limitations.md`). The _technical_ explanation of the
  same limitations belongs in the developer guide instead (TR6.3) — a user
  doesn't need the "why", just honest expectations.
- **TR5.3**: It includes a screenshot gallery generated from the test artifacts,
  on one page: first the TR1a real-world sites, as the most relatable
  demonstration for a reader deciding whether to install it, then the synthetic
  fixtures ("function demos"). Each entry shows the page at normal size and at
  2×.
- **TR5.4**: Gallery screenshots presented to a human reader are composited into
  a phone frame (bezel) rather than shown as bare, edge-to-edge captures. The
  raw screenshots stay bare, since tests also use them; the docs site only shows
  the framed versions.

- **TR5.5** (if feasible): each fixture's gallery page links to a **live,
  interactive demo** — not just static before/after screenshots. The docs-site
  build copies each fixture page into `docs-site/dist/demos/<fixture-id>/` with
  the built core engine and floating widget auto-attached, so a reader can click
  real +/- buttons and see the effect themselves. This is fully static (no
  backend beyond serving the docs site itself) for every fixture except
  `iframe-cross-origin`, whose live demo depends on the local two-port test
  server setup and may not work once the docs site is served/deployed elsewhere
  — document that one exception rather than silently shipping a broken demo.

- **TR5.6**: The site publishes the embeddable script (FR3.4) at
  `embed/text-size-adjuster.js`, explains how a site owner adds it, and includes
  a demo page that loads it via an actual `<script src>` tag (not inlined like
  the other demos).
- **TR5.7**: The site documents the on-page control settings (FR9, FR10) for
  each audience (site owners, extension users, userscript users).

**Acceptance**: `npm run build` produces a browsable `docs-site/dist/` with
working internal links and all gallery images present in framed form; no manual
copying or framing of screenshots. Live demo links (TR5.5) work when the site is
served via `npm run docs:serve`.

## TR6. Developer guide (separate from the docs site)

- **TR6.1**: A hand-maintained document, `docs/developer-guide.md`, lives in the
  repo (not in `docs-site/`, and not generated) and covers what the end-user
  site deliberately excludes (TR5.0): repo/workspace layout, how to build and
  run the test suite locally, and — explicitly requested — **how to publish each
  delivery mechanism**:
  - Firefox Desktop extension: AMO listed vs. unlisted submission via
    `web-ext sign` / addons.mozilla.org.
  - Firefox Android extension: the `gecko_android` manifest requirement and the
    unlisted self-distribution signing path used for the manual QA checklist,
    plus what store listing would additionally require.
  - Chrome extension (FR8, best-effort): packaging the derived Chrome manifest
    variant and the Chrome Web Store developer dashboard submission flow, kept
    brief since it's not a primary target.
  - Userscript: direct `.user.js` distribution vs. optionally publishing to
    Greasy Fork.
- **TR6.2**: `README.md` at the repo root documents the reading order across all
  of `docs/` plus the generated docs site, so a newcomer (user or contributor)
  knows where to start.
- **TR6.3**: The developer guide includes a "known problems" section covering
  each FR6 limitation (plus any other non-obvious issue hit during
  implementation) from a _technical_ angle: root cause, actual impact/frequency,
  and what workaround — if any — was considered and why it was or wasn't taken.
  This is the mirror of TR5.2b's plain-language version for the implementation
  audience.

## TR7. Publishing to GitHub Pages

- **TR7.1**: A GitHub Actions workflow builds the complete documentation — both
  the end-user site (TR5) and the developer/contributor docs (TR6) — and
  publishes it to GitHub Pages on push to the default branch.
- **TR7.2**: The published site keeps the same separation as TR5.0/TR6: the
  site's default landing experience is the end-user guide; the
  developer/contributor docs (rendered from `docs/*.md`) live in a clearly
  labeled, separate section (a `/dev/` subpath) reached via an explicit "For
  contributors" link, never the default page a first-time visitor lands on.
  Publishing both together is for convenience of having one URL, not a reason to
  blur who each part is for.
- **TR7.3**: The docs-site build renders the TR6.1 developer docs, plus the
  store listing text, into the `/dev/` section.
