# Code review — 2026-10-03

A read-only review of the whole repository for the maintainer, in the order the
brief asked for: the product (extension, engine, content script) first, then
end-user documentation, security and privacy, code quality, and developer
documentation.

## Scope and method

- Reviewed at commit `da8dc26` (`Publish signed builds as GitHub releases`). The
  working tree also held uncommitted work in progress while this review ran —
  the extension version bumped to 1.2.0, `sign.js` refactored to use a new
  `amo-credentials.js`, `amo-screenshots.js` extended and a new
  `amo-upload-screenshots.js`. Those files were read but are treated as WIP, not
  as part of the reviewed release. Nothing was modified, committed, pushed,
  signed or uploaded; `private.env` was not read.
- Ran: `npm run lint` (clean), `npm run typecheck` (clean), `npm run test:unit`
  (60 tests pass), `npm run test:e2e` (Layer 1: 147 passed, 9 skipped as
  designed), `npm run test:e2e:extension` (Layer 2: 1 passed),
  `npm run lint:webext` (one expected warning), `npm audit`.
- Ran five scratch experiments outside the repo: the built core bundle in
  headless Chromium (layout, responsive sizes, late shadow roots, iframe
  navigation, 60k-element pages), the packaged extension in headless Firefox
  through `playwright-webextext` (frame sync, persistence, background lifetime,
  a diagnostic copy with logging appended), and the embed on an emulated phone
  (pages with and without a viewport meta tag). Findings marked **verified**
  were reproduced this way or confirmed in the shipped bundles; **suspected**
  ones come from reading code and platform documentation only.
- Fetched the published docs site to confirm it matches `docs-site/src`.

## Summary

The engineering is careful: one engine shared by three deliveries, inline
`!important` with a CSS variable so a factor change is a single property write
(60,000 elements: capture 326 ms, change ≈1 ms plus layout), batched reads
before writes, a widget in a shadow root the engine is told to ignore, settings
parsing shared by all deliveries, product text and paths each in one place, a
real Playwright suite in both Firefox and Chromium, and documentation that is
unusually honest about limitations. Lint, types and every test pass.

The product has one critical defect that undermines the primary target:

| #   | Severity | Finding                                                                                                                                                                                                                                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | critical | In Firefox, any iframe that was still loading when the content script ran, or that navigates later, leaves a dead child engine; every later factor change throws, so the widget, per-site persistence and frame sync silently stop working on that page. Verified. |
| H1  | high     | Each frame persists under its own origin and the relay saves relayed values too: third-party embed origins fill the "sites" list and a size can leak from one site to another through a shared embed. Code-verified; currently masked by C1.                       |
| H2  | high     | The background keeps the frame registry in a plain `Map`; Firefox's event page is unloaded after idle, so cross-frame sync dies on long-lived tabs. Suspected; masked by C1.                                                                                       |
| H3  | high     | The userscript has no `@noframes`, so it mounts a +/− control inside every iframe (ads, embeds), each scaling independently. Verified in the built header.                                                                                                         |
| M1  | medium   | `<html>` is captured, so every `rem`-sized layout dimension scales with the factor; a 20rem box grows from 320 px to 640 px at 2× on a 360 px phone and the page scrolls sideways. Verified.                                                                       |
| M2  | medium   | Captured sizes are frozen: viewport-relative sizes, media queries, class-driven changes and a site's own font-size switch no longer apply after capture (rotate the phone and the layout stays in portrait sizes). Verified.                                       |
| M3  | medium   | Open shadow roots attached after the host was scanned (a component defined after `document_idle`) are never scaled. Verified.                                                                                                                                      |
| M4  | medium   | "Show after I zoom" never triggers on pages without a viewport meta tag on a phone (initial scale ≈0.4, the check wants >1.05) — exactly the desktop-only pages the product is for. Verified.                                                                      |
| M5  | medium   | The Android manual-install guide conflates "custom add-on collection" (listed add-ons only) with "install from file"; the signed unlisted `.xpi` may not be installable the way described. Suspected.                                                              |
| M6  | medium   | The docs site republishes full copies of third-party articles (BBC, a paywalled Aftenposten piece, Norvig) as live demos; the repo's own policy avoids redistributing that markup. Verified.                                                                       |

Fix C1 first; it is small. Then H1–H3 together, since they are the same feature
(frames) and H1/H2 only become visible once C1 is fixed.

## 1. The product: engine, content script, extension

### C1 (critical, verified) — a dead child engine breaks every later change

`packages/core/src/engine.ts:98-113` attaches a child engine to any same-origin
iframe document immediately when its `readyState` is not `loading`. An iframe's
_initial_ `about:blank` document is same-origin and already `complete`, so at
`document_idle` the top frame's engine adopts the placeholder document of every
iframe whose real (often cross-origin) content has not arrived yet, and
`scannedIframes` (`engine.ts:41,78`) makes sure that frame is never looked at
again. When the frame navigates, Firefox nukes the content-script wrappers for
the old document; the next `child.setFactor(factor)` in `applyFactor`
(`engine.ts:120`) throws `TypeError: can't access dead object` before `notify()`
runs (`engine.ts:121`). The same happens for a same-origin iframe that navigates
after being scanned (the `load` listener at `engine.ts:101-109` is `once`).

Effect, reproduced with the packaged build in Firefox: the top frame's own text
still scales (the variable was written at `engine.ts:119`), but the widget keeps
showing "100%", `bindStore` never saves, the `tsa:factorChanged` broadcast is
never sent, and after a reload the page is back at normal size. On the
`iframe-cross-origin` fixture the cross-origin child never follows the parent,
which is the capability FR6.1/FR3.3 and the developer guide describe as "solved,
by design". A page with no iframe behaves correctly. Pages with late-loading or
navigating frames are the norm on news and social sites, so in practice this
hits the extension's main use case. Chromium does not throw on dead wrappers,
which is why nothing in Layer 1 (bare engine) caught it; Layer 2 only exercises
`plain-px`. Secondary effect: `packages/extension/src/content-script.ts:47-51`
sets `applyingExternal = true` without `try/finally`, so after one such throw
the frame also stops broadcasting for good.

Suggested fix:

- In `applyFactor`, isolate children:
  `try { child.setFactor(factor) } catch { children.delete(child) }` (and the
  same around `child.detach()`), so one dead frame can never take the page's
  listeners down with it.
- Do not adopt an iframe's initial `about:blank` when the element has a `src`
  that is not `about:blank`; instead listen for `load` persistently (not
  `once`), and on every load re-read `contentDocument`, detach the previous
  child for that element and attach a new one. Keep `scannedIframes` as "has a
  load listener", not "done".
- `try/finally` around `engine.setFactor` in the content script's
  `tsa:setFactor` handler.
- Add a Layer 2 test on `iframe-cross-origin` (assert the child follows), plus a
  Firefox case with a delayed iframe response, and fail Layer 2 on any
  `pageerror`/console error from `moz-extension://` — the thrown error was
  printed to the console in every run.

### H1 (high, code-verified) — per-frame persistence and the relay leak sizes

`content-script.ts:15-19` binds a store keyed by `location.origin` in _every_
frame, and `persistence.ts:24-28` saves on every engine change except those
`bindStore` itself applied. A relayed `tsa:setFactor`
(`content-script.ts:47- 51`) suppresses the content script's own re-broadcast
but not `bindStore`'s save, so a user setting 150% on site A writes `150%` under
the origin of each embedded frame (`googleads…`, `youtube.com`, a comments
widget…). Those entries then (a) appear in the options page's "Sites with a
saved size" list as sites the user never visited, (b) apply when the user later
visits that origin directly, and (c) propagate across sites: in another tab,
site B's embed of the same origin receives the storage change
(`local-extension-store.ts: 45-53`), `bindStore` applies it, the content
script's listener at `content-script.ts:68-73` sees `applyingExternal === false`
and broadcasts, the background relays to B's top frame, and B's own origin is
saved at 150%. Simply _opening_ a page whose embed has a stored size triggers
the same chain. The `iframe-cross-origin` persistence path was observed in the
diagnostic run only up to the point C1 aborts it; the chain is straightforward
to follow in code once C1 is fixed.

Suggested fix: make the top frame the only source of truth. Subframes do not
call `bindStore` at all; on `tsa:registerFrame` the background answers with the
top frame's current factor (ask frame 0 with `tsa:getFactor`), and the relay
only forwards changes that originate from frame 0. Alternatively key all frames
by the top-level origin (`sender.tab.url` in the background), but the first
option also removes the storage-change fan-out. Either way, merge the two
`applyingExternal` flags: have `bindStore` return an `applyExternal(factor)`
function that both the store subscription and the message handler use.

### H2 (high, suspected) — the frame registry lives in a terminable event page

`packages/extension/src/background.ts:11` keeps `tabFrames` in module scope.
Firefox MV3 backgrounds are event pages; MDN: "Background scripts unload after a
few seconds of inactivity … do not rely on global variables." Content-script
messages wake the page again, but with an empty map, so after the first idle
period `tsa:factorChanged` relays to nobody. The relay already uses
`tabs.sendMessage(tabId, msg, { frameId })`, which the diagnostic copy confirmed
works for the frame IDs Firefox hands out. Not reproduced because C1 prevents
any relay from being sent in the first place.

Suggested fix: drop the registry. `browser.tabs.sendMessage(tabId, relay)`
without `frameId` reaches every frame of the tab; the originating frame can
ignore it because the factor equals its own (add that equality check to the
`tsa:setFactor` handler), and no background state is needed. If a registry is
kept, put it in `browser.storage.session`.

### H3 (high, verified) — the userscript runs, and mounts a widget, in every iframe

`packages/userscript/vite.config.ts:28` declares `@match *://*/*` and no
`noframes`; the built header has no `@noframes`, so Tampermonkey/Violentmonkey
run the script in each iframe. `packages/userscript/src/main.ts:79-90` has no
`window.top` check, so each ad slot, video embed and comment widget gets its own
+/− control (bottom-right of the iframe) and scales on its own. The limitations
guide tells userscript users that embedded content "might not resize"; it will,
but separately and with a stray control. Fix: `noframes: true` in the
`userscript` block (same-origin iframes are still handled by the top engine's
child discovery; cross-origin ones become the documented FR6.1 limitation), or
guard the widget mount with `window === window.top`.

### M1 (medium, verified) — scaling `<html>` scales every `rem` layout size

`engine.ts:147` captures every element including `documentElement`, so at 2×
`html` gets `font-size: calc(16px * 2) !important` and all `rem` lengths double:
container `width`/`min-width`,
`grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr))`, `padding`,
`gap`. Experiment: a `width: 20rem` block went from 320 px to 640 px in a 360 px
viewport and introduced horizontal scrolling — the very thing FR1.3 forbids. The
`rem-em` fixture does not catch it because nothing in it has a `rem` width.
Since each element receives its own inline pixel size, `html` does not need to
be scaled for any text to scale; skip `documentElement` (keep `rem` stable) and
consider skipping `body` too (its font-size only serves as an `em` base for
direct children, which are captured individually anyway). Add a fixture with
`rem`-based widths and an `auto-fill` grid.

### M2 (medium, verified) — captured sizes are frozen pixels

Capture writes the resolved pixel value (`capture.ts:44-57`), which then
outranks everything the page does later. Verified: `h1 { font-size: 4vw }` and
`@media (min-width: 600px) { p { font-size: 24px } }` stayed at their 360 px
values after the viewport grew to 800 px (rotating a phone, resizing a window,
split-screen); adding a class with a bigger font-size after capture changed
nothing. This covers hover/open/active states, dark-mode or "comfortable
reading" toggles, and sites' own text-size buttons. FR6.4 and the developer
guide describe only the inline-style rewrite case, so users and the docs
understate it. Options: re-capture on `resize`/`orientationchange` (debounced:
set the variable to 1, remove the engine's two inline declarations, re-read,
re-apply — the `scaledAttr` makes "ours" distinguishable), and at minimum
document the rest in FR6 and the limitations guide.

### M3 (medium, verified) — shadow roots attached after the scan are missed

`discoverChildrenIn` (`engine.ts:70-82`) reads `el.shadowRoot` once, when the
element is scanned; the `MutationObserver` on the document does not see
mutations inside shadow trees. A custom element present in the DOM at
`document_idle` whose definition loads later (code-split components, lazy
widgets) attaches its shadow root after the scan and its content is never
captured; the same element inserted _after_ definition works, as does
`shadow-dom-open`, whose root exists before attach. Cheap mitigation: on each
observer batch, re-check previously scanned hosts whose tag contains `-` and
still have no child engine; or hook `customElements.whenDefined` for undefined
tags seen during the scan.

### M4 (medium, verified) — "show after I zoom" never fires on desktop-only pages

`packages/ui-widget/src/viewport.ts:17` treats `visualViewport.scale > 1.05` as
"zoomed". On a phone, a page without a viewport meta tag starts at scale ≈0.42
(980 px laid out into 412 px); the user pinches to 1.0 to read, which is a 2.4×
zoom, and the control stays hidden until they pass 1.05. Reproduced with the
embed on an emulated Pixel: hidden at 0.42, hidden at 1.0, shown at 1.5.
`norvig` was added to the gallery as exactly this kind of page, and the
extension's default is `on-zoom`, so on these pages only the toolbar button
works. Measure relative to the starting scale, as the `devicePixelRatio` branch
already does: `scale > startScale * ZOOM_THRESHOLD`. (The `followVisualViewport`
counter-scaling itself behaved: the panel stayed inside the visible area at its
normal size in the same experiment.)

### Other engine and content-script findings

- **Low, verified.** Everything in `<head>` (`meta`, `title`, `style`,
  `script`), `br`, `wbr` and every SVG node get an inline `font-size` and the
  `data-tsa-scaled` attribute (`engine.ts:147`). Harmless for rendering, but it
  doubles the attribute churn on large pages, feeds any page `MutationObserver`,
  and scales `<svg><text>` (logos, chart labels). Skip `head` and void/metadata
  elements; decide explicitly about SVG text.
- **Low, verified.** `document.write` into an `about:blank` iframe replaces its
  `documentElement`; the child engine's `styleTarget` is the old one, so new
  nodes get the attribute but the variable is never set (fallback 1). Covered by
  the C1 fix if children are re-created per document.
- **Low.** `tsa:setFactor` trusts `message.factor` (`content-script.ts:48`).
  Only extension contexts can send it, but a non-number ends up as
  `--tsa-k: NaN`, which makes every `calc()` invalid. Validate with
  `typeof === 'number' && Number.isFinite`.
- **Low.** `detach()` (`engine.ts:179-184`) leaves the inline `!important`
  declarations and the current variable in place; there is no way to restore a
  page (needed when the user removes a site while the tab is open — currently
  solved by resetting to 1, fine — and when the extension is disabled, where
  Firefox does not undo DOM edits). Consider a `restore()` that removes the two
  declarations and the attribute.
- **Low.** `autoRemember` starts as `true` (`content-script.ts:14`) until
  settings arrive, so an early change (stored value applied through a relay, or
  a quick click) is saved even when auto-remember is off. Gate on settings
  having loaded.
- **Low.** `watchSettings` re-mounts the widget on any settings change,
  including toggling auto-remember (`content-script.ts:29-32`); a revealed
  `on-zoom` control disappears again. Re-mount only when `position`/`show`
  changed.
- **Low.** "Remember this site" stores `1` when the page is at 100%
  (`popup.ts:72`), breaking the invariant "a stored key means a non-default
  size" that `bindStore` and the options page rely on (the list then shows the
  site at 100%).
- **Low.** The popup shows "100%" and does nothing on pages without a content
  script (internal pages, AMO, PDF viewer, a site where the user revoked host
  access). `send()` swallows the error (`popup.ts:19-24`); show "Can't change
  this page" and disable the buttons instead. Firefox 127+ shows the
  `<all_urls>` grant in the install prompt and lets users revoke it per site;
  `browser.permissions.contains` in the popup would explain that case.
- **Low.** `strict_min_version: "142.0"` (`manifest.json:13,21`) excludes
  Firefox ESR 140, which already supports `data_collection_permissions`. Lower
  to 140 unless something needs 142.
- **Nit.** `manifest.json` carries both `background.service_worker` and
  `background.scripts`; `web-ext lint` warns the former is ignored by Firefox.
  Expected given the single-source Chrome derivation, but the Chrome build could
  add the key instead of Firefox carrying it.
- **Nit.** `background.ts:17` returns `undefined` for messages from extension
  pages (no `sender.tab`); fine today, but the popup also uses
  `runtime.openOptionsPage()` only — document that the background intentionally
  ignores popup messages.

### Android specifics

- M4 is the main Android issue; M2 (rotation) is the second.
- The popup, `tabs.query({ currentWindow: true })` and
  `runtime.openOptionsPage()` with `open_in_tab: true` are all correct for
  Firefox for Android; `window.close()` in the popup (`popup.ts:52`) is a no-op
  there, harmless.
- The Android QA checklist does not include a page without a viewport meta tag
  (`norvig`), an iframe-heavy page, rotation, or the `on-zoom` default — the
  four cases above. Add them.

### Performance (verified, good)

15,000 elements: capture 116 ms; 60,000 elements: capture 326 ms, factor change
≈1 ms plus 425 ms of browser layout. `large-dom-performance` (600 paragraphs) is
far below real pages; raise it to a few thousand elements so the ceiling means
something, and keep the ratio assertion.

### What is done well here

Realm-safe `nodeType` check for iframe documents, reads-then-writes batching,
the `scaledAttr` guard against double capture, rounding the factor so
`1 + 0.1 − 0.1` is exactly 1, the ignore attribute as a generic mechanism
instead of widget special-casing, and the cross-origin `contentDocument`
try/catch scoped to exactly the one expression that may throw.

## 2. End-user documentation and accessibility

The site is clear, non-technical where it should be, and matches the code in the
places I checked (defaults, options, the `×`/`↺` buttons, the "not available
yet" notice, the script-tag options table). The published site is the current
source. Issues:

- **Medium, suspected (M5).** `install-extension-manually-android.md:6-8`
  describes tapping the logo to reveal a "Custom Add-on collection" option. That
  feature installs add-ons from an AMO _collection_, which can only contain
  _listed_ add-ons, so it cannot install the unlisted signed `.xpi` the guide
  links to. The separate "Install extension from file" entry (shown after
  enabling the debug menu) is what sideloads a file, and its availability
  outside Nightly/Beta has changed over releases. Walk the exact steps on a
  current release build and rewrite them with menu names; the Android QA
  checklist depends on this guide.
- **Medium.** `limitations.md:5-10` and the store description promise the
  extension handles embedded content better than the userscript. Until C1 is
  fixed it does not; until H3 is fixed the userscript scales embeds (badly).
  Update whichever side ships first.
- **Medium.** Missing from `limitations.md` (and FR6): sizes do not follow a
  rotation/resize or the site's own size switch (M2); some late-loading
  components may not resize (M3); very large factors can make `rem`-based
  layouts overflow (M1); and the control does not appear on Firefox's own pages
  or on pages where you declined "Access your data for all websites".
- **Low.** `install.md:41-43`: "Remember this site in the … button's menu" — it
  is a button in the popup, not a menu item. `install.md:25-28`: on a phone,
  "zoom in and the control appears" is only true on mobile-layout pages until M4
  is fixed.
- **Low.** `install-userscript.md:27-28` says the control appears on "every
  page"; with H3 it also appears inside frames. After the fix, say "page".
- **Low.** The front page's advanced list says the userscript "doesn't remember
  sizes per site" — correct — but nowhere says the embed's control, once hidden
  with `×`, is gone until reload. One sentence in `add-to-your-website.md`.
- **Low.** Store description (`product-description.txt`): "Works in Firefox on
  your computer and on Android" is right; consider "Firefox 140 or newer" once
  the minimum is settled, and that sideloaded installs need the "Access your
  data for all websites" permission accepted.

Accessibility:

- **Medium.** The on-page widget's targets are 26×26 px with 13–15 px text
  (`widget-styles.ts:31-42`) — fine for WCAG's 24 px minimum, small for the
  intended audience (people who cannot read small text) and for touch. 36–44 px
  buttons and a larger display would cost little; the shadow root isolates it.
- **Low.** The widget has no keyboard shortcut and, once hidden with `×`, no way
  back for userscript/embed users. Document, or make `×` a "minimize to a single
  button".
- **Low.** `docs-site/src/style.css:184-190` gives `table { display: block }`
  for horizontal scrolling, which removes table semantics for screen readers.
  Wrap tables in a scrolling `div` instead.
- Good: skip link, labelled nav, `color-scheme`, visible focus, reduced-motion,
  alt text on gallery images, the corner picker is a real radio group with
  visually-hidden labels, the sites list has per-row `aria-label`s, and the
  popup display is a live region.

## 3. Security and privacy

- **Permissions.** `<all_urls>` + `all_frames` + `storage` is the minimum for
  what the product does; the reviewer notes justify it accurately and
  `data_collection_permissions: none` is declared. Fine for AMO.
- **Message handling.** Only extension contexts can reach `runtime.onMessage`
  listeners; the popup targets `frameId: 0`; nothing uses `innerHTML` (widget,
  popup and options build DOM with `createElement` / `textContent`, origins are
  rendered with `textContent`). Validate `message.factor` as noted above.
- **Page-controlled data.** The engine only reads computed styles and writes
  attributes/inline styles; the widget's `mode: 'open'` shadow root lets page
  scripts click its buttons or read the factor — negligible impact, but note
  that `data-tsa-scaled` on every element makes the extension trivially
  fingerprintable (low; inherent to the design, worth a sentence in the privacy
  statement).
- **Per-site storage is a visited-sites list.** By design and disclosed ("your
  settings stay in your browser"); H1 would add third-party origins the user
  never visited, which is worse — another reason to fix it.
- **Script-tag embed.** The guide already tells site owners to self-host.
  Options come only through whitelisting parsers (`settings.ts:40-49`), the
  bundle does no `eval`/`innerHTML`, and `document.currentScript` is only read
  synchronously. The published `embed/text-size-adjuster.js` is unversioned and
  mutable, so SRI cannot be offered; publish versioned copies
  (`embed/text-size-adjuster-1.2.0.js`) with a hash in the guide.
- **Secrets.** `private.env` is gitignored and not tracked (checked),
  credentials go to `web-ext` via environment variables only, and the listed
  source archive is `git archive HEAD`, so it cannot include the file. The WIP
  `amo-credentials.js` keeps this; its JWT helper uses a 60 s expiry as AMO
  asks. One caution for `amo-upload-screenshots.js`: on failure it prints the
  full AMO response body — fine, but never add the request headers to that
  message. `.idea/` is untracked but not ignored; add it to `.gitignore`.
- **Supply chain.** Runtime dependency: only `webextension-polyfill`.
  `npm audit`: 6 advisories, all in dev tooling (`node-forge` via `web-ext` →
  `adbkit`, high; `vitest`/`@vitest/mocker` and `esbuild`, moderate). None
  reaches the shipped bundles; schedule the upgrades. The workflow pins actions
  by major tag, not SHA (nit).
- **Third-party content (M6, verified).** `docs.yml:36-41` downloads full copies
  of five live pages — including a paywalled Aftenposten article — and
  `docs-site/build.js:273-280` publishes them as interactive demos on GitHub
  Pages with the tool injected. `test-and-documentation-requirements.md:40-42`
  avoids committing that markup for exactly this reason, but publishing it is
  the larger exposure (copyright, site terms, GitHub Pages terms). Keep the
  before/after screenshots (short, transformative) and limit live demos to pages
  you may redistribute (Wikipedia under CC BY-SA with attribution, your own
  fixtures).
- **AMO compliance.** Source submission, reviewer notes with exact build
  commands, declared Node/npm versions, no remote code, no minification
  surprises (Vite output is reproducible from the archive). Good. The
  `BACKGROUND_SERVICE_WORKER_IGNORED` lint warning is acceptable to reviewers
  but easy to remove (see the manifest nit above).

## 4. Code quality, tests, build, CI

Done well: the single-source rule is real (`product.json`,
`product-description.txt`, `tools/paths.js`, `fixtures.json`, one Vite config
driven by `--mode`, manifest fields injected at build), the store contract test,
fake engine/browser helpers, and comments that explain _why_ (the
specificity-tier story in `capture.ts` is the kind of comment that saves the
next person a day).

- **Medium.** Layer 2 covers one scenario on one fixture. The extension's
  defining capability (frames in sync, FR6.1) and its two message paths (popup →
  content script, background relay) have no automated check; C1 would have been
  caught by a `pageerror` listener alone. Add: the `iframe-cross-origin` fixture
  to Layer 2 asserting the child scales; a delayed-iframe page;
  `expect(pageErrors).toEqual([])`; and a check of the popup's message path.
  Opening `popup.html` by URL is explicitly out of scope (the UUID is random per
  temporary install) — fine, but then exercise the `tsa:*` handlers directly,
  e.g. a test-only background listener that forwards `Message`s sent from a test
  page via `window.postMessage` to `tabs.sendMessage`.
- **Medium.** No CI for correctness: `.github/workflows/docs.yml` is the only
  workflow, runs only on push to `master`, and runs Layer 1 as a side effect of
  `npm run build`; lint, typecheck and unit tests run nowhere. Add a `ci.yml` on
  push/PR with `npm run lint`, `typecheck`, `test:unit`, `test:e2e`, and
  `test:e2e:extension` (allowed to fail, per TR3).
- **Low.** Two `applyingExternal` flags do the same job in `persistence.ts` and
  `content-script.ts` and disagree about scope — the root of H1. One mechanism,
  owned by `bindStore`.
- **Low.** `createGMValueStore` (`gm-store.ts`) is tested but unused by any
  delivery; either wire FR5.3 or move it to an "optional" note so readers do not
  look for its consumer.
- **Low.** `tools/paths.d.ts` is a hand-maintained twin of `paths.js`; drift is
  silent. Convert `tools/*.js` to TypeScript (they already run under Node 22,
  which can execute TS) or use `// @ts-check` + JSDoc and `allowJs/checkJs`.
- **Low.** `e2e/engine.spec.ts:221` asserts a factor change is at least 3×
  faster than capture, while TR2 says "an order of magnitude". Make the doc and
  the assertion agree (the measured ratio is >100×, so 10× is safe).
- **Low.** `fixtures.json` says `iframe-cross-origin` is covered by Layer 2; it
  is not.
- **Low.** `packages/extension/package.json:17` (HEAD) references
  `amo-screenshots.js`, which exists only in the uncommitted tree; the WIP
  commit should include it, `amo-credentials.js` and `amo-upload-screenshots.js`
  together with the ESLint globals change, and the developer guide's
  "Publishing" section should mention `amo:listing`, `amo:screenshots`,
  `amo:upload-screenshots` and `sign.js --listed`.
- **Low.** `sign.js:63` runs `npx` with `execFileSync`; on Windows this needs
  `npx.cmd` or `shell: true`. Note it or resolve the `web-ext` binary from
  `node_modules/.bin`.
- **Low.** `release-github.js` checks the tree is clean and pushed but not that
  the tag does not exist; `gh release create` then fails late. Check
  `git tag -l v<version>` first.
- **Nit.** `capture.ts:7-31` and `implementation-plan.md:74-86` tell the same
  specificity story in full; keep the long version in one place and link.
- **Nit.** `eslint.config.js` leaves `no-unused-vars` at `warn`; with a clean
  tree, make it `error` so CI catches it.
- **Nit.** `.gitignore` lacks `.idea/`.

Flakiness: none observed; Layer 1 ran in 27 s with `fullyParallel`. The
`reuseExistingServer: !CI` setting means a stray fixture server on port 4310
serving stale bundles would be reused locally — `requireBuilt` guards the
bundle, not the server; print the server's start time or PID in the Playwright
log if this ever confuses anyone.

## 5. Developer documentation

Accurate in most places and well cross-referenced; the reading order in
`README.md` works. Stale or wrong against the code:

- `developer-guide.md:179-201` ("Known problems", cross-origin iframes) says the
  extension case is "solved, by design, not deferred" and that Layer 2 "would
  confirm" it; neither is true today (C1, and no test). Rewrite after fixing C1
  and adding the test.
- `test-and-documentation-requirements.md:75-77` (TR3) lists "the popup page
  (opened directly by URL) drives the same engine via messaging" as covered;
  `e2e/extension.spec.ts:12-18` deliberately does not. Update TR3 to say what is
  covered.
- `test-and-documentation-requirements.md:65-67` (TR2) — "order of magnitude" vs
  the `/3` assertion (above).
- `implementation-plan.md:148-150` mentions a fourth `vite.options.config.ts`;
  there is one `vite.config.ts` selected by `--mode`.
  `implementation-plan.md: 29-34` says the Firefox manifest has
  `background.scripts` and Chrome's `service_worker`; the Firefox manifest
  carries both.
- `functional-requirements.md` FR6 should gain the limitations found above
  (M1–M3) so the plain-language page has something to mirror (TR5.2b/TR6.3
  require the pair).
- `android-manual-qa-checklist.md` should add the no-viewport-meta page,
  rotation, an iframe-heavy page, the `on-zoom` default and the popup's
  "Remember this site" flow, and point at the corrected Android install steps
  (M5).
- `developer-guide.md:111-133` documents `private.env` and `release:extension`
  correctly for HEAD; once the `amo-credentials.js` refactor lands, keep the key
  names there in sync (they are repeated in three places: guide, comment, code —
  the comment could just point at the guide).
- `README.md` says "Chrome best-effort" and the docs site says the userscript
  "also works in Chrome"; both true, consistent.

## Closing note

The architecture is sound and the fixes above are local: C1 is a few lines in
`engine.ts` plus a `try/finally`; H1–H2 are a simplification of the frame-sync
design (top frame as the source of truth, stateless broadcast); H3 is one config
flag; M1 and M4 are one-line conditions. With a Layer 2 test on the cross-origin
fixture and a `pageerror` assertion, the suite will keep them fixed.
