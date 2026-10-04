# Code review 2026-10-03 — status of the findings

What happened to each finding of `code-review-2026-10-03.md`, on the
`review-fixes` branch and in a second pass on 2026-10-04. "Fixed" names the
commit; "left" says why. What is still open is listed in `TODO.md`.

## Summary findings

| #   | Status       | Commit(s)            | Notes                                                                                                                                                                                                                                                                                                   |
| --- | ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | fixed        | `876c4ec`, `71e419b` | Child engines isolated and dropped when dead; about:blank placeholders not adopted; frames re-adopted on every load; try/finally around both applying-external flags. Layer 1 (late document, navigation, document.write) and Layer 2 (`iframe-cross-origin`, plus `delayed.html`) tests failed before. |
| H1  | fixed        | `71e419b`            | Top frame is the single source of truth: only it saves (address-bar origin), subframes only follow. Layer 2 checks the embed's origin has no stored size. Entries already stored by older versions for embed origins stay in users' storage: they can't be told apart from sites the user visited.      |
| H2  | fixed        | `71e419b`            | Background is stateless: broadcasts to all frames of the tab, subframes ask for the top frame's size on start. Layer 2 sets Firefox's background idle timeout to 1 s; an in-memory registry fails that test.                                                                                            |
| H3  | fixed        | `6a7f2e2`            | `@noframes` in the userscript header, checked by a Layer 1 test.                                                                                                                                                                                                                                        |
| M1  | fixed        | `39133d2`            | `<html>` is no longer captured; `rem` layout keeps its size (Layer 1 test on a 360 px viewport).                                                                                                                                                                                                        |
| M2  | partly fixed | `11c060b`            | Everything is captured again after a viewport width change (rotation, resize). Changes driven by page state (a class added later, a site's own size switch) are still not followed; documented as FR6.5 and in the limitations guide.                                                                   |
| M3  | mostly fixed | `d6baf18`, `11c060b` | Custom elements defined after the scan are picked up (`customElements.whenDefined`, works from Firefox content scripts too). Shadow roots attached at other later moments are documented in FR6.2.                                                                                                      |
| M4  | fixed        | `c005b35`            | Pinch-zoom measured from the lowest scale seen. Unit test and an emulated-phone Chromium test.                                                                                                                                                                                                          |
| M5  | left         | —                    | Android install-guide wording needs walking on a real device.                                                                                                                                                                                                                                           |
| M6  | accepted     | —                    | Maintainer's decision (2026-10-04): the live demos of third-party articles stay as they are.                                                                                                                                                                                                            |

## Other engine and content-script findings

| Finding                                         | Status | Commit(s) | Notes                                                                                                                                                      |
| ----------------------------------------------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<head>` contents, `br`, `wbr`, SVG captured    | fixed  | `39133d2` | Skipped; SVG treated as a picture and left at its size.                                                                                                    |
| `document.write` replaces the root element      | fixed  | `876c4ec` | The factor variable goes on the document's current root element.                                                                                           |
| `message.factor` not validated                  | fixed  | `876c4ec` | `isFactor` in the content script and the background relay.                                                                                                 |
| `detach()` leaves styles; no `restore()`        | left   | —         | No caller: Firefox runs no content-script code when an add-on is disabled. `releaseElements` (`11c060b`) is the building block if one is needed.           |
| `autoRemember` true until settings load         | fixed  | `71e419b` | The gated store waits for the setting.                                                                                                                     |
| Settings change re-mounts the control           | fixed  | `71e419b` | Only position/visibility changes re-create it.                                                                                                             |
| "Remember this site" stores 1 at 100%           | fixed  | `4a1f5b5` | Maintainer's decision (2026-10-04): at 100% the button saves nothing and the popup says so.                                                                |
| Popup silent on pages without a content script  | fixed  | `18f6a54` | Buttons disabled, one-sentence explanation; unit tests. It doesn't tell a revoked permission apart from Firefox's own pages.                               |
| `strict_min_version` 142 excludes ESR 140       | fixed  | `f718057` | Desktop lowered to 140; Android stays at 142, the first version there with `data_collection_permissions` (MDN). Takes effect with the next signed release. |
| Both `service_worker` and `scripts` in manifest | fixed  | `494f849` | The Chrome variant derives the worker; `web-ext lint` is clean.                                                                                            |
| Background ignores extension-page messages      | fixed  | `71e419b` | Stated in `background.ts`.                                                                                                                                 |
| Android QA cases missing                        | fixed  | `b2955c4` | No-viewport page, rotation, iframes, `on-zoom` default, Remember flow, popup on Firefox pages.                                                             |
| `large-dom-performance` too small               | fixed  | `e97e001` | 2,500 items, two elements each.                                                                                                                            |

## End-user documentation and accessibility

| Finding                                        | Status   | Commit(s) | Notes                                                                                                                           |
| ---------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Limitations: embedded content promise          | fixed    | `6a7f2e2` | True now that C1/H1–H3 are fixed.                                                                                               |
| Limitations missing M1–M3 and restricted pages | fixed    | `11c060b` |                                                                                                                                 |
| "Remember this site … in the button's menu"    | fixed    | `b2955c4` |                                                                                                                                 |
| "Zoom in and the control appears" on phones    | fixed    | `c005b35` | True after M4.                                                                                                                  |
| Userscript control on "every page"             | fixed    | `6a7f2e2` | Accurate after H3; no wording change needed.                                                                                    |
| Embed: hidden control returns on reload        | fixed    | `b2955c4` |                                                                                                                                 |
| Store description: minimum version, permission | fixed    | `f718057` | Maintainer's decision (2026-10-04): in the install guides instead of the store text. The version is read from the manifest.     |
| Control's targets 26 px, 13–15 px text         | fixed    | `dc9c4a2` | 40 px buttons, 22 px symbols, 16 px display.                                                                                    |
| No keyboard shortcut; `×` is final             | accepted | —         | Maintainer's decision (2026-10-04): acceptable as is. The userscript got a "show" menu command; one more proposal in `TODO.md`. |
| Docs-site `table { display: block }`           | fixed    | `902529d` | Tables wrapped in a scrolling `div`.                                                                                            |

## Security and privacy

| Finding                                       | Status       | Commit(s) | Notes                                                                                                                                    |
| --------------------------------------------- | ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `data-tsa-scaled` makes the add-on detectable | fixed        | `f274e36` | Maintainer's decision (2026-10-04): one sentence on the privacy page.                                                                    |
| Embed not versioned, so no SRI                | accepted     | —         | Maintainer's decision (2026-10-04): left for now; the embed guide says the copy on the docs site doesn't support SRI.                    |
| `.idea/` not ignored                          | fixed        | `9456038` |                                                                                                                                          |
| `npm audit` advisories in dev tooling         | partly fixed | `5e43f12` | vitest upgraded to 5. No fix to install yet for `esbuild` (held at 0.27 by `tsup`) or `node-forge` (comes with every current `web-ext`). |
| Actions pinned by tag, not SHA                | fixed        | `266aae1` |                                                                                                                                          |

## Code quality, tests, build, CI

| Finding                                         | Status | Commit(s)            | Notes                                                                                                                                                                                             |
| ----------------------------------------------- | ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layer 2 covers one scenario                     | fixed  | `71e419b`, `d6baf18` | Cross-origin frames, late frame, embed origin, idle background, late custom element; every test fails on page/console errors. The popup is unit-tested (`18f6a54`), not driven in a real browser. |
| No CI for lint, types, unit tests               | fixed  | `9456038`            | `ci.yml`; browser suites opt-in there.                                                                                                                                                            |
| Two `applyingExternal` flags                    | fixed  | `71e419b`            | The content script no longer needs one.                                                                                                                                                           |
| `createGMValueStore` unused                     | fixed  | `b2955c4`            | Documented as ready for FR5.3.                                                                                                                                                                    |
| `tools/paths.d.ts` hand-maintained twin         | fixed  | `c2f2300`            | Types are JSDoc in `paths.js`, checked by the new e2e typecheck.                                                                                                                                  |
| TR2 "order of magnitude" vs `/3`                | fixed  | `b2955c4`            | Assertion is `/10` now.                                                                                                                                                                           |
| `fixtures.json` claims Layer 2 coverage         | fixed  | `71e419b`            | True now.                                                                                                                                                                                         |
| `amo-screenshots.js` referenced but uncommitted | n/a    | —                    | Already committed before this branch; the guide covers the `amo:*` scripts.                                                                                                                       |
| `sign.js` runs `npx` (Windows)                  | fixed  | `6c474b7`            | `web-ext` is started with Node directly (`tools/web-ext.js`). Checked through the Chrome build; signing itself was not run.                                                                       |
| `release-github.js` doesn't check the tag       | fixed  | `a035905`            | Syntax-checked only; not run.                                                                                                                                                                     |
| Specificity story told twice                    | fixed  | `b2955c4`            | Kept in `capture.ts`.                                                                                                                                                                             |
| `no-unused-vars` only a warning                 | fixed  | `9456038`            |                                                                                                                                                                                                   |
| Stray fixture server could be reused            | left   | —                    | Not observed.                                                                                                                                                                                     |

## Developer documentation

| Finding                                        | Status | Commit(s)            | Notes                                      |
| ---------------------------------------------- | ------ | -------------------- | ------------------------------------------ |
| Developer guide: cross-origin "solved"         | fixed  | `71e419b`            | Describes the new design and its tests.    |
| TR3 claims popup coverage                      | fixed  | `71e419b`            |                                            |
| Implementation plan: options config, manifests | fixed  | `b2955c4`, `494f849` |                                            |
| FR6 lacks M1–M3                                | fixed  | `11c060b`            | FR6.2, FR6.3, FR6.5.                       |
| Android QA checklist                           | fixed  | `b2955c4`            | Install steps themselves left with M5.     |
| `private.env` key names in three places        | fixed  | `9bd953a`            | The comment points at the developer guide. |
| Dangling `npm run dev -w packages/extension`   | fixed  | `b2955c4`            | Removed from the command list.             |
