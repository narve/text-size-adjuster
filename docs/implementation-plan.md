# Implementation Plan — Text Size Adjuster

This document describes **how and when** the project gets built. References functional
requirements as FR* and test requirements as TR* (see the other two docs) rather than restating
them.

## Repo layout

```
text-size-adjuster/
  package.json                      # npm workspaces root (no extra package manager install needed)
  tsconfig.base.json
  packages/
    core/            # engine.ts, capture.ts, style-injector.ts, mutation-observer.ts, iframe.ts, shadow-dom.ts
    stores/          # MemoryStore, LocalExtensionStore (browser.storage.local), GMValueStore
    ui-widget/       # shadow-root floating +/- widget (framework-free)
    userscript/      # vite-plugin-monkey build wiring core+widget+GMValueStore
    extension/       # manifest.json, content-script.ts, background.ts, popup/
  fixtures/          # the 11 TR1 fixture pages + server.mjs (two ports, for genuine cross-origin)
                     # + real-world/download.mjs + real-world/sites.json (TR1a, snapshots gitignored)
  e2e/               # playwright.config.ts, engine.spec.ts (Layer 1), extension-smoke.spec.ts (Layer 2)
  docs-site/         # build.mjs (custom static generator) + guides + templates
  docs/              # the three requirement/plan docs + android-manual-qa-checklist.md + developer-guide.md
  README.md          # project overview + documentation reading order (TR6.2)
  .github/workflows/docs.yml  # builds + publishes the docs site (user + dev sections) to GitHub Pages (TR7)
```

## Tooling choices

- **npm workspaces** (already available, no install needed) over pnpm — project is small enough
  that pnpm adds nothing.
- **vite-plugin-monkey** for the userscript build (current standard for Tampermonkey-targeted
  Vite output).
- **Hand-rolled Vite config(s) for the extension**, rather than a generic web-extension framework
  — keeps full control over Firefox-Android's background-script constraints. Not one multi-entry
  config: Rollup's IIFE format doesn't support multiple inputs in one build (`output.codeSplitting`
  can't be disabled with >1 entry, and IIFE requires it disabled). Three separate single-entry
  `build.lib` configs instead (`vite.content.config.ts`, `vite.background.config.ts`,
  `vite.popup.config.ts`, run in sequence, only the first clearing `dist/`), which also just makes
  sense: content script, background, and popup run in genuinely independent contexts anyway.
  Static files (`manifest.json`, `popup.html`) are copied by a plugin in the last config.
- **`webextension-polyfill`** in the extension package so `browser.*` calls work unmodified in
  Chrome too (FR8.3). The build emits two manifest variants from one template
  (`manifest.firefox.json`, `manifest.chrome.json`) differing only in the `background` key
  (Firefox: `background.scripts`, required for Android; Chrome: `background.service_worker`,
  required by Chrome MV3) and `browser_specific_settings` — all other code (content script,
  background logic, popup) is shared unchanged.
- **@playwright/test** for Layer 1/2; **web-ext** as a devDependency for manual `run`/`lint`
  only.
- **Custom Node script** (`docs-site/build.mjs`, using `markdown-it`) for the docs site instead of
  a full SSG — content volume doesn't justify a framework.
- **Screenshot framing** (TR5.4): `docs-site/build.mjs` uses `playwright` (chromium) to render each
  raw Layer 1 screenshot inside a small local HTML template (`docs-site/src/templates/frame-desktop.html`,
  `frame-mobile.html`) that draws the chrome purely in CSS (title bar/address bar/traffic lights,
  or a phone bezel) around an `<img>` of the raw screenshot, then screenshots *that* page to
  produce the framed PNG used in the gallery. No new image-processing dependency needed — it
  reuses the same engine already required for Layer 1/2.

## Engine/UI/Store contracts

```ts
// core
createEngine(options?): TextSizeEngine
interface TextSizeEngine {
  increase(step?): number; decrease(step?): number; reset(): number;
  setFactor(k): number; getFactor(): number;
  onChange(listener): () => void;
  attach(): void; detach(): void; rescan(): void;
}

// stores (core never imports these — satisfies FR4/FR5 decoupling)
interface Store {
  get(key): Promise<number|undefined>; set(key, value): Promise<void>;
  remove?(key): Promise<void>; subscribe?(key, cb): () => void;
}
function bindStore(engine, store, key): () => void   // outside the engine, wires persistence

// extension messaging (popup has zero engine logic — pure relay)
type Message =
  | { type: 'tsa:getFactor' } | { type: 'tsa:setFactor'; factor: number }
  | { type: 'tsa:increase' } | { type: 'tsa:decrease' } | { type: 'tsa:reset' }
  | { type: 'tsa:factorChanged'; factor: number; origin: string };
```

Override mechanism (FR2.5): each captured element gets its scaled font-size/line-height set as an
**inline** `calc(original * var(--tsa-k, 1)) !important` style, not a shared stylesheet rule
matched by selector. CSS gives an element's own inline `!important` the highest priority of any
stylesheet declaration regardless of specificity — this beats ID-selector `!important` page rules
without needing any specificity trick. (An earlier design tried to win via a high-specificity
injected selector, repeating an attribute selector; that failed against ID-based page rules
because CSS specificity is tiered, not additive — confirmed broken by the
`important-high-specificity` fixture before switching to this.) The one case still unbeaten is the
page's own *inline* `!important` on that element (FR6.4, accepted).

## Phased build order (one commit per phase)

0. **This plan approved** → split into real files under `docs/` (+
   `docs/android-manual-qa-checklist.md`). `git init` + first commit. *(this step)*
1. Scaffold: root `package.json`/workspaces, `tsconfig.base.json`, lint/format config, package
   stubs. Commit.
2. Core engine + **vitest** unit tests (specificity-rule generation, factor clamping,
   px-vs-unitless line-height detection) — no browser yet. Commit.
3. **Fixtures + Layer 1 Playwright harness**, all 11 synthetic fixtures green against Firefox and
   Chromium, screenshots captured. This is the load-bearing checkpoint — the hard requirement —
   get it solid before any UI work. Commit.
3a. Real-world fixtures (TR1a): `fixtures/real-world/download.mjs` + starter `sites.json`
    (ap.no, news.ycombinator.com, + a few more); wire into Layer 1 as an informative (non-gating)
    extra check. Commit.
4. UI widget (shadow-DOM, standalone) + the three Store implementations with a shared contract
   test. Commit.
5. Userscript package via `vite-plugin-monkey`; manual Tampermonkey smoke check; extend Layer 1
   to also sanity-check the built `.user.js`. Commit.
6. Extension package, desktop first: manifest (content script declared with `"all_frames": true`
   and host permissions covering embedded content, so it also injects into cross-origin iframes —
   FR6.1/FR3.3's intentional extra capability over the userscript), content script, background
   (relays factor changes to every frame via `browser.tabs.sendMessage(tabId, msg, { frameId })`
   so they move together), popup; manual `web-ext run` check. Commit.
7. Firefox-for-Android compatibility: `browser_specific_settings.gecko_android`,
   `background.scripts` (not `service_worker`) for Android, `web-ext lint` clean. Commit.
7a. (Best-effort, FR8) Chrome manifest variant + `webextension-polyfill`; manual unpacked-load
    smoke check in Chrome. Commit.
8. Layer 2 best-effort extension integration test via `playwright-webextext`, non-gating.
   Commit.
9. Docs site: guides + generated gallery (screenshots composited with browser/phone chrome per
   TR5.4) from Layer 1/8 artifacts, plus a live interactive demo per fixture (TR5.5, with the
   `iframe-cross-origin` caveat called out); wired into `npm run build` (TR5.1); `docs:serve`
   verified locally. Commit.
10. GitHub Pages publishing (TR7): extend `docs-site/build.mjs` to also render TR6.1's developer
    docs into a `/dev/` section (reusing the markdown-it rendering already used for the end-user
    guides), linked from, but not part of, the default landing page. Add
    `.github/workflows/docs.yml` (checkout, Node setup, `npx playwright install --with-deps`,
    `npm run build`, then `actions/upload-pages-artifact` + `actions/deploy-pages`) triggered on
    push to the default branch. Commit.
11. Options page and control settings (FR9, FR10): `ui-widget` gains `position` (four corners)
    and `show` (`always` | `on-zoom`) options. `on-zoom` keeps the panel hidden until
    `visualViewport.scale` or `devicePixelRatio` rises above its starting value, then reveals it
    for good; while pinch-zoomed the panel is positioned from `visualViewport` offsets and
    counter-scaled by `1/scale` so it stays visible at normal size. Settings parsing
    (`parsePosition`/`parseShow`, long and short forms) lives in `ui-widget`. Per mechanism: the
    embed reads `document.currentScript` synchronously at load (`data-*` attribute, else URL
    parameter); the userscript registers manager-menu commands (`GM_registerMenuCommand`) and
    stores settings with `GM.getValue`/`GM.setValue` (granted in the metadata block; the same
    bundle checks these exist, since as an embed it runs without them); the extension stores
    settings under one key in `browser.storage.local` (site sizes stay keyed by origin), and
    content scripts re-mount the widget when it changes. `bindStore` removes the stored value
    instead of saving the default factor, so "sites with a saved size" means sites not at 100%,
    and resets the engine when a value is removed elsewhere (options page "remove"). A fourth
    single-entry build (`vite.options.config.ts`) produces `options.js` for `options.html`,
    declared via `options_ui`. Tests: unit tests for widget placement/visibility and parsing, and
    for the `bindStore` changes; Layer 1 tests loading the built bundle through real
    `<script src>` tags with each placement form; the options page checked best-effort by loading
    the Chrome build in Chromium. Commit.

## Risks

| Risk | Mitigation |
|---|---|
| `playwright-webextext` breaks on a version bump | Layer 2 is non-gating by design (TR3); documented, not silently dropped |
| AMO Android review/signing turnaround for real sideload testing | Manual checklist (TR4) uses unlisted self-distribution, not store review |
| Firefox-for-Android MV3 background limitations | Addressed directly in phase 7, not deferred |

## Verification

- `npm test` runs unit tests + Layer 1 Playwright suite (must pass — the hard requirement).
- `npm run test:e2e:extension` runs Layer 2 (best-effort, allowed to be skipped/red without
  blocking).
- `npm run build` builds all packages, then (re)runs Layer 1 to refresh screenshots, then builds
  the documentation site (TR5.1) — `docs-site/dist/` with framed gallery images (TR5.4) is a
  build output, not a separate manual step. `npm run docs:serve` serves it locally for review.
- Manual: walk `docs/android-manual-qa-checklist.md` on a real or emulated Firefox for Android
  before calling an Android release done.
