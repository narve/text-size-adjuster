# Developer Guide — Text Size Adjuster

This document is for contributors/maintainers. End-user install instructions live in the
generated documentation site instead (`docs-site/`, built via `npm run build`) — see
`test-and-documentation-requirements.md` TR5.0 for why the split exists.

## Repo layout

```
text-size-adjuster/
  packages/
    core/          # the scaling engine — framework/UI/storage-agnostic
    stores/        # MemoryStore, LocalExtensionStore, GMValueStore
    ui-widget/     # shadow-DOM floating +/- widget
    userscript/    # Tampermonkey build (vite-plugin-monkey)
    extension/     # Firefox/Chrome WebExtension build
  fixtures/        # synthetic + real-world (TR1a) test pages, served locally
  e2e/             # Playwright suites (Layer 1 required, Layer 2 best-effort)
  docs-site/       # generator for the end-user documentation site
  docs/            # this file + the requirements/plan/checklist docs
```

See `implementation-plan.md` for the full architecture, API contracts, and phased build order.

## Building and testing locally

```bash
npm install                 # installs all workspaces
npm run build                # builds every package, runs Layer 1, builds the docs site
npm run test:unit            # core engine unit tests (vitest)
npm run test:e2e             # Layer 1 Playwright suite (the hard requirement)
npm run test:e2e:extension   # Layer 2, best-effort — allowed to fail/skip
npm run docs:serve           # serve docs-site/dist/ locally for review
```

Download fresh real-world fixture snapshots (TR1a) before a Layer 1 run that should include them:

```bash
npm run download -w fixtures
```

## Publishing

### Firefox Desktop extension

1. `npm run build -w packages/extension` produces `packages/extension/dist/` with
   `manifest.firefox.json` copied in as `manifest.json`.
2. For a public listing: submit via <https://addons.mozilla.org/developers/> (AMO), "listed"
   distribution — goes through Mozilla review.
3. For self-distribution without a public listing: submit as **unlisted** on AMO. You still get a
   Mozilla-signed `.xpi` (required for Firefox to install it at all outside of temporary
   `about:debugging` loading), but it isn't published to the public catalog.
4. `web-ext sign` (from the `web-ext` devDependency) can drive the unlisted-signing API call from
   the command line instead of the web UI, given an AMO API key/secret.

### Firefox Android extension

- Requires the `browser_specific_settings.gecko_android` block in the manifest (already part of
  the build, see `implementation-plan.md`) for AMO to consider the build Android-compatible.
- The manual QA checklist (`android-manual-qa-checklist.md`) uses the same **unlisted** AMO
  signing path as desktop — sideload the signed `.xpi` via Firefox for Android's hidden debug
  menu (Settings → About Firefox → tap the logo repeatedly).
- A public Android listing goes through the same AMO review as desktop but is reviewed against
  Android-specific constraints (e.g. `web-ext lint` flags APIs unavailable on Android) — run
  `npm run lint:webext -w packages/extension` before submitting.

### Chrome extension (best-effort, FR8)

- `manifest.chrome.json` (service-worker background, no `gecko_android`/`gecko` keys) is the
  Chrome-targeted manifest variant produced by the same build.
- Zip `dist/` (with `manifest.chrome.json` renamed to `manifest.json`) and upload via the
  [Chrome Web Store Developer Dashboard](https://chromewebstore.google.com/devconsole) — requires
  a one-time developer registration fee and goes through Google's review.
- This is not a primary target (Firefox Desktop + Android are); treat Chrome publishing as
  optional/best-effort, matching FR8's priority.

### Userscript

- The simplest distribution is just sharing the built `.user.js` file directly (from
  `packages/userscript/dist/`) — Tampermonkey/Violentmonkey can install it from a local file or a
  raw URL.
- Optionally publish to [Greasy Fork](https://greasyfork.org/) for discoverability; follow their
  submission guidelines (metadata block requirements, update URL).

## Known problems (technical detail; see FR6 for the plain statement)

- **Cross-origin iframes** (ads, embeds, third-party comment widgets): the same-origin policy
  means `iframe.contentDocument` throws/returns `null` across origins from page-injected JS —
  there is no workaround available there, not even via `postMessage` (you can't inject a
  stylesheet into a document you can't touch). *Impact on the userscript*: permanent limitation —
  it only ever runs as page-injected JS, so that iframe's content stays at its original size.
  *Impact on the extension*: **solved, by design, not deferred** (per FR3.3/FR6.1 — the user
  explicitly signed off on the two delivery mechanisms differing in capability here). The
  extension's content script is declared with `"all_frames": true` plus host permissions broad
  enough to cover embedded content (e.g. `<all_urls>`), which gets the engine injected directly
  into *every* frame's own realm, cross-origin or not — each frame runs its own independent
  engine instance over its own document (still never reaching *across* a frame boundary, which
  stays impossible regardless of permissions; the trick is running inside each frame instead of
  reaching into it from outside). The background script relays factor changes to every frame in
  the tab via `browser.tabs.sendMessage(tabId, msg, { frameId })` so they move together. This is
  why `iframe-cross-origin` is a useful Layer 2 (best-effort) fixture too, not just a Layer 1 one:
  Layer 1 confirms the userscript-equivalent (bare core engine) correctly leaves it alone; Layer 2
  would confirm the packaged extension actually scales it.
- **Closed shadow DOM**: deliberately inaccessible to *any* outside script by platform design —
  not a bug, not something an extension's elevated permissions can bypass either. *Impact*: rare
  in practice; closed roots are mostly used for strict third-party widget isolation (e.g. some
  payment widgets), and most shadow-DOM usage in the wild uses open roots.
- **Fixed-height/`overflow:hidden` containers**: enlarging text can make it taller than its
  container, causing visual clipping. A generic tool can't "fix" this without guessing page
  intent (grow the container? scroll it? cap the font?) — any guess risks breaking the page's
  actual design. *Impact*: occasional clipping in specific components (a fixed-height card, a
  single-line title truncated with `text-overflow: ellipsis`). Native browser zoom has the same
  failure mode, for the same reason.
- **Inline `style="...!important"`**: CSS gives an element's own inline style the highest
  possible cascade priority — higher than any stylesheet `!important`, including ours. The only
  way around it is surgically rewriting the element's `style` attribute (parsing out just the
  conflicting declaration without disturbing the rest of that attribute's content), which is
  real complexity for a case that's rare in practice. Flagged as a possible future enhancement,
  not attempted in v1.

## Documentation publishing (GitHub Pages)

`.github/workflows/docs.yml` builds and publishes the complete documentation site — both the
end-user guide and this developer section — to GitHub Pages on every push to `master`. One-time
setup required on GitHub (not something a workflow run can do for you): repo **Settings → Pages →
Build and deployment → Source**, set to **GitHub Actions**.

This workflow depends on `docs-site/build.mjs` existing and rendering both sections (see
`implementation-plan.md`'s phase 10) — until that build step is implemented, expect this workflow
to fail at the `npm run build` step. That's expected, not a regression to chase down early.

## Release checklist

1. `npm run build` passes (includes the hard-requirement Layer 1 suite).
2. `npm run test:e2e:extension` — note the result but don't block on it (best-effort, TR3).
3. Walk `android-manual-qa-checklist.md` by hand before calling an Android release done.
4. Bump versions in the relevant `packages/*/package.json` and manifest files.
5. Publish per the section above for whichever target(s) changed.
