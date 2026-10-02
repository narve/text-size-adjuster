# Developer Guide — Text Size Adjuster

This document is for contributors/maintainers. End-user install instructions
live in the generated documentation site instead (`docs-site/`, built via
`npm run build`) — see `test-and-documentation-requirements.md` TR5.0 for why
the split exists.

## Repo layout

```
text-size-adjuster/
  product.json             # name, summary, homepage, text-length limits
  product-description.txt  # long store description
  tools/                   # shared Node helpers: product.js (reads the two
                           #   files above), paths.js (artifact paths, ports,
                           #   fixture lists), render-image.js
  packages/
    core/          # the scaling engine — framework/UI/storage-agnostic
    stores/        # createMemoryStore, createLocalExtensionStore,
                   #   createGatedStore; createGMValueStore is ready for
                   #   FR5.3 (optional) but no delivery uses it yet
    ui-widget/     # shadow-DOM floating +/- widget and its settings parsing
    theme/         # shared CSS (colours, buttons, panels) for the docs site and
                   #   the extension's options page and popup
    userscript/    # userscript + script-tag embed build (vite-plugin-monkey)
    extension/     # Firefox/Chrome WebExtension build, signing scripts
  fixtures/        # test pages served locally: fixtures.json lists the
                   #   synthetic ones, real-world/sites.json the real sites
  e2e/             # Playwright suites (Layer 1 required, Layer 2 best-effort,
                   #   real-world informative)
  docs-site/       # generator for the documentation site
  docs/            # this file + the requirements/plan/checklist docs
```

See `implementation-plan.md` for the architecture, API contracts, and phased
build order.

## Commands

This is the one command reference; other docs link here. All commands run from
the repo root.

```bash
npm install                  # installs all workspaces
npm run build                # builds packages/*, runs Layer 1, builds the docs site
npm test                     # test:unit + Layer 1
npm run test:unit            # unit tests (vitest) of every package in packages/
npm run test:e2e             # Layer 1 Playwright suite (the hard requirement)
npm run test:e2e:extension   # Layer 2, best-effort — allowed to fail/skip
npm run test:real-world      # real-world snapshots (TR1a), informative only
npm run screenshots          # only the gallery screenshots (Chromium)
npm run lint                 # ESLint
npm run typecheck            # tsc in every package
npm run format               # Prettier on everything (Markdown style: AGENTS.md)
npm run docs:build           # build docs-site/dist/ from existing screenshots
npm run docs:serve           # serve docs-site/dist/ on port 8080
npm run release:extension    # bump version, build and sign the extension
npm run release:github       # publish the signed .xpi as a GitHub release
npm run submit:amo           # submit for the public listing on AMO (reviewed)
```

Per workspace (`-w <workspace>`):

```bash
npm run build -w packages/core               # likewise userscript, extension
npm run build:chrome -w packages/extension   # derive dist-chrome/ after build
npm run lint:webext -w packages/extension    # web-ext lint, incl. Android APIs
npm run run:desktop -w packages/extension    # try it in a fresh Firefox
npm run run:android -w packages/extension    # same, on a connected Android device
npm run icons -w packages/extension          # re-render PNG icons from icon.svg
npm run start -w fixtures                    # fixture server on ports 4310/4311
npm run download -w fixtures                 # refresh real-world snapshots (TR1a)
```

Real-world snapshots are not part of Layer 1. Download them with
`npm run download -w fixtures`, then run `npm run test:real-world`; the docs
build shows them in the gallery when their screenshots exist.

## Single sources of truth

- **Name and one-line summary:** `product.json` in the repo root (summary at
  most 132 characters, Chrome's limit).
- **Long store description:** `product-description.txt` in the repo root. Lines
  starting with `#` are comments and are stripped by the build.
- **Extension version:** `packages/extension/package.json`.
- **Extension manifest:** `packages/extension/manifest.json`, without name,
  description or version — the build injects those. The Chrome manifest is
  derived from the built Firefox one (Firefox-only keys dropped).

- **Synthetic test fixtures:** `fixtures/fixtures.json` (id, what each one
  exercises, which requirement it traces to). Real sites:
  `fixtures/real-world/sites.json`.
- **Paths, file names and ports** shared by build scripts, tests and the docs
  build: `tools/paths.js`.

`tools/product.js` reads the name, summary and description for the manifests,
the userscript header and the docs site (front page, guides via `{{name}}` and
`{{homepage}}` placeholders, and the "Store listing text" page in the
contributor section). Edit the sources, not generated files.

## Publishing

### Firefox Desktop extension

1. `npm run build -w packages/extension` produces `packages/extension/dist/`
   with `manifest.json` copied in as `manifest.json`.
2. For a public listing on <https://addons.mozilla.org/> (AMO): every upload
   needs a new version number, across both channels, so first
   `npm run version:bump -w packages/extension`, then commit and push. Then
   `npm run submit:amo` builds the extension and submits it as **listed**
   (`sign.js --listed`), together with:
   - the listing metadata (`packages/extension/amo-listing.js`): name, summary
     and description from `product.json` and `product-description.txt`, the
     category (Appearance; AMO's categories are shared by desktop and Android),
     homepage, GitHub Issues as the support site, the license, and the notes for
     Mozilla's reviewers from `packages/extension/amo-reviewer-notes.txt`;
   - the source code: the repository at `HEAD` as a zip, since the bundles are
     minified. The reviewer notes give the build steps; a clean checkout builds
     a byte-identical `dist/`.

   It doesn't wait for Mozilla's review, which can take days.
   `npm run amo:listing -w packages/extension` writes the metadata and source
   archive to `web-ext-artifacts/` without submitting, to check them first.
   Store screenshots can't be uploaded by `web-ext`:
   `npm run amo:screenshots -w packages/extension` renders them (1280×800, after
   `npm run docs:build`) into `web-ext-artifacts/amo-screenshots/` for uploading
   on the add-on's page in the developer hub.

3. For self-distribution without a public listing: submit as **unlisted** on
   AMO. You still get a Mozilla-signed `.xpi` (required for Firefox to install
   it at all outside of temporary `about:debugging` loading), but it isn't
   published to the public catalog.
4. Signing is scripted: `npm run release:extension` bumps the extension's minor
   version (in `packages/extension/package.json`), builds the extension and
   signs it as an unlisted add-on (`packages/extension/sign.js`, wrapping
   `web-ext sign --channel unlisted`). The signed file ends up at
   `packages/extension/web-ext-artifacts/text-size-adjuster-signed.xpi`. Commit
   and push the version bump, then `npm run release:github` attaches that file
   to a GitHub release tagged `v<version>`
   (`packages/extension/release-github.js`, using the `gh` CLI). The install
   guides link to the latest release's `text-size-adjuster.xpi`, so that's what
   makes a new version downloadable.

   Updates: unlisted builds get an `update_url` in their manifest (added by
   `sign.js`; AMO doesn't allow it in listed builds), pointing at the docs
   site's `updates.json`. The docs build generates that file from the GitHub
   releases that have a signed `.xpi`, and `release:github` starts the docs
   workflow afterwards, so installed copies update to the new release.

   Credentials come from the gitignored `private.env` in the repo root (or the
   `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` environment variables, e.g. in CI):

   ```
   firefox_jwt_issuer=user:12345678:123
   firefox_auth_key=<64-character JWT secret>
   ```

   Both come from https://addons.mozilla.org/developers/addon/api/key/. They're
   passed to `web-ext` as environment variables, never on the command line.
   Mozilla signs each version number only once, which is why the release step
   always bumps the version first. Commit the bumped version files afterwards.

The ways to install _without_ an AMO listing are documented for technical users
in `docs-site/src/guides/install-extension-manually.md`. To try a local build,
load `packages/extension/dist/manifest.json` temporarily in `about:debugging`,
or package it with `npx web-ext build --source-dir dist` from
`packages/extension/`. The userscript builds to
`packages/userscript/dist/text-size-adjuster.user.js`.

### Firefox Android extension

- Requires the `browser_specific_settings.gecko_android` block in the manifest
  (already part of the build, see `implementation-plan.md`) for AMO to consider
  the build Android-compatible.
- The manual QA checklist (`android-manual-qa-checklist.md`) uses the same
  **unlisted** signed `.xpi` as desktop (`npm run release:extension`),
  sideloaded as described in
  `docs-site/src/guides/install-extension-manually-android.md`.
- A public Android listing goes through the same AMO review as desktop but is
  reviewed against Android-specific constraints (e.g. `web-ext lint` flags APIs
  unavailable on Android) — run `npm run lint:webext -w packages/extension`
  before submitting.

### Chrome extension (best-effort, FR8)

- `npm run build:chrome -w packages/extension` (after the normal `build`) reuses
  the already-built JS bundles as-is — cross-browser already via
  `webextension-polyfill`'s `browser` global — and writes `dist-chrome/` with
  the derived Chrome manifest (service-worker background only, no
  `browser_specific_settings`) already named `manifest.json`.
- Zip `dist-chrome/` and upload via the
  [Chrome Web Store Developer Dashboard](https://chromewebstore.google.com/devconsole)
  — requires a one-time developer registration fee and goes through Google's
  review.
- This is not a primary target (Firefox Desktop + Android are); treat Chrome
  publishing as optional/best-effort, matching FR8's priority.

### Userscript

- The simplest distribution is just sharing the built `.user.js` file directly
  (from `packages/userscript/dist/`) — Tampermonkey/Violentmonkey can install it
  from a local file or a raw URL.
- Optionally publish to [Greasy Fork](https://greasyfork.org/) for
  discoverability; follow their submission guidelines (metadata block
  requirements, update URL).

## Known problems (technical detail; see FR6 for the plain statement)

- **Cross-origin iframes** (ads, embeds, third-party comment widgets): the
  same-origin policy means `iframe.contentDocument` throws/returns `null` across
  origins from page-injected JS — there is no workaround available there, not
  even via `postMessage` (you can't inject a stylesheet into a document you
  can't touch). _Impact on the userscript_: permanent limitation — it only ever
  runs as page-injected JS, so that iframe's content stays at its original size.
  _Impact on the extension_: **handled by design** (per FR3.3/FR6.1 — the user
  explicitly signed off on the extension and the userscript differing in
  capability here). The extension's content script is declared with
  `"all_frames": true` plus host permissions broad enough to cover embedded
  content (e.g. `<all_urls>`), which gets the engine injected directly into
  _every_ frame's own realm, cross-origin or not — each frame runs its own
  independent engine instance over its own document (still never reaching
  _across_ a frame boundary, which stays impossible regardless of permissions;
  the trick is running inside each frame instead of reaching into it from
  outside). The top frame is the single source of truth: only it has the on-page
  control, answers the popup and remembers the size (keyed by the address-bar
  origin, so embeds never appear as sites of their own). It reports every change
  to the background, which broadcasts it to all frames of the tab
  (`browser.tabs.sendMessage(tabId, msg)` without a `frameId`); a subframe asks
  for the top frame's size when it starts (`tsa:getTopFactor`). The background
  keeps no state, because Firefox unloads an idle MV3 background and starts it
  again with empty globals. Layer 1 confirms the userscript-equivalent (bare
  core engine) leaves the `iframe-cross-origin` fixture alone; Layer 2 confirms
  the packaged extension scales it, also when the frame loads late
  (`delayed.html`) and after the background was unloaded while idle.
- **Iframes that load or navigate later**: an iframe starts with a same-origin
  `about:blank` placeholder that its real document replaces. The engine doesn't
  adopt that placeholder when the iframe has a `src`, and re-examines the frame
  on every `load`, replacing its child engine. Calls into a child engine are
  isolated: in Firefox's content scripts a navigated-away document becomes a
  "dead object" that throws on any use, and one such child must never stop the
  parent from applying a change, notifying listeners or saving.
- **Closed shadow DOM**: deliberately inaccessible to _any_ outside script by
  platform design — not a bug, not something an extension's elevated permissions
  can bypass either. _Impact_: rare in practice; closed roots are mostly used
  for strict third-party widget isolation (e.g. some payment widgets), and most
  shadow-DOM usage in the wild uses open roots.
- **Fixed-height/`overflow:hidden` containers**: enlarging text can make it
  taller than its container, causing visual clipping. A generic tool can't "fix"
  this without guessing page intent (grow the container? scroll it? cap the
  font?) — any guess risks breaking the page's actual design. _Impact_:
  occasional clipping in specific components (a fixed-height card, a single-line
  title truncated with `text-overflow: ellipsis`). Native browser zoom has the
  same failure mode, for the same reason.
- **Page scripts rewriting inline styles**: the engine writes its scaled sizes
  as inline `!important` styles on each element
  (`packages/core/src/capture.ts`), which beats every stylesheet rule and
  replaces a page's own static inline `!important` font-size on that element.
  What it doesn't handle is a page script that later rewrites the element's
  `style` attribute (e.g. a framework re-render): the engine's
  `MutationObserver` watches added nodes, not attribute changes, so that element
  drops back to the page's size (until the next capture, after a viewport width
  change, picks it up again). Watching `style` attributes would mean
  re-capturing on every attribute write the engine itself also triggers — real
  complexity for a case that's rare in practice. Flagged as a possible future
  enhancement, not attempted in v1.

## Continuous integration

`.github/workflows/ci.yml` runs `npm run lint`, `npm run typecheck` and
`npm run test:unit` on every push and pull request — fast, no browsers. To also
run Layer 1 (Firefox and Chromium) and Layer 2 (non-gating), start it by hand
(**Actions → Checks → Run workflow**) with **run_browser_tests** checked.

## Documentation publishing (GitHub Pages)

`.github/workflows/docs.yml` builds and publishes the complete documentation
site — both the end-user guide and this developer section — to GitHub Pages on
every push to `master`. By default it only takes the gallery screenshots
(`npm run screenshots`, Chromium only) instead of running the test suites, and
installs Chromium without `--with-deps`: installing system packages from the
Ubuntu mirror can take over ten minutes. To also run the full Layer 1 and
real-world suites in Firefox and Chromium, start it by hand (**Actions → Publish
documentation → Run workflow**) with **run_tests** checked. One-time setup
required on GitHub (not something a workflow run can do for you): repo
**Settings → Pages → Build and deployment → Source**, set to **GitHub Actions**.

## Release checklist

1. `npm run build` passes (includes the hard-requirement Layer 1 suite).
2. `npm run test:e2e:extension` — note the result but don't block on it
   (best-effort, TR3).
3. Walk `android-manual-qa-checklist.md` by hand before calling an Android
   release done.
4. Publish per the section above for whichever target(s) changed. For the
   extension, `npm run release:extension` bumps the version (it lives only in
   `packages/extension/package.json`); commit and push that change, then run
   `npm run release:github`.
