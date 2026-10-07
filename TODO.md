# TODO

Open work. The review items come from `docs/code-review-2026-10-03.md`;
`docs/code-review-2026-10-03-fixes.md` has the status of every finding,
including the ones already fixed.

## Releases

- [ ] addons.mozilla.org: 1.7.0 was submitted on 2026-10-07 and is waiting for
      review; the listing serves 1.5.0 until then. Until it is approved, the
      install guide describes a gear and a "Show the control on this page"
      button that the listed version doesn't have.
- GitHub: 1.8.0 was released on 2026-10-07, the same code as 1.7.0 (Mozilla
  takes each version number on one channel only). Copies installed from the site
  update to it. 1.6.0 was signed but never published.
- Both carry the changes of 2026-10-07. Fixes: sizes going back to an earlier
  one or a reset being undone while a size is being saved, and text scaled twice
  (added to a shadow host's own children, or with a font-size transition on the
  page, when added or after a rotation). New: the gear, pages left untouched at
  100% (FR2.6), and the popup's "Show the control on this page" (FR9.7).
- [ ] Try on a real phone, with 1.8.0: the first tap on a large page (it now
      does the capture), and **↺** on a page with a lot of text.
- [ ] Try the gear once in Firefox, on desktop and Android: the automated tests
      only follow it to the options page in Chromium.
- [ ] Chrome Web Store: submitted by the maintainer on 2026-10-04.

## Seen on Android

Reported by the maintainer on 2026-10-04, with the builds of that time (1.1.0 to
1.4.0).

Tried on 2026-10-07 on a Galaxy Z Flip (SM-F766B, Android 16, Firefox 157) with
the 1.8.0 build, driven over adb. `norvig.com/spell-correct.html` (no viewport
tag) and a Wikipedia article (mobile layout).

- [ ] On a page without a viewport tag, a bigger size can make the text smaller.
      Firefox enlarges such a page's body text itself, and shows the page zoomed
      out to fit its width. Seen on the norvig page: at 140% the body text is
      hardly bigger than at 100% (the code block, which Firefox doesn't enlarge,
      grows as asked), and at 200% it is clearly smaller, because the code block
      has become wider than the page and Firefox zooms out further to fit it.
      This is likely what "the text ends up a lot smaller" was. Reset puts the
      page back exactly (1.8.0 lets go of everything at 100%); what earlier
      builds did after reset here was not tried. Not solved: needs a decision on
      what to do on such pages (for example keeping wide blocks from growing
      past the page, or taking over from Firefox's own enlarging).
- [ ] The control does not always appear when zooming. Not reproduced: after a
      double-tap zoom on the norvig page it appeared, in its corner and at its
      normal size. A pinch could not be sent over adb, and a page with a mobile
      layout was not tried. Two earlier fixes may cover it: M4 (`c005b35`), and
      `45957c6` (a control added after the page had loaded was placed almost
      entirely outside the visible area on a page shown zoomed out to fit).
- [ ] The control does not always update its number. Not reproduced: the number
      followed every one of some twenty taps on the two pages, ten of them in
      quick succession. Candidates fixed earlier: C1 (`876c4ec`, `71e419b`), and
      on 2026-10-07 the number going back to an earlier size when storage
      reported the engine's own write late.
- Fixed on 2026-10-07, found in the same session: the toolbar popup, which
  Android opens as a full page, had no viewport tag and was shown at a fraction
  of its size. Not in 1.7.0 or 1.8.0.

## Waiting for a fix upstream

- [ ] `npm audit`: `node-forge` (through `web-ext`), with no fixed version to
      install. Dev tooling; it doesn't reach the shipped bundles.
- [ ] The `overrides` in the root `package.json` lift `esbuild` (held at 0.27 by
      `tsup`) and `shell-quote` (pinned by `web-ext`'s `fx-runner`) past their
      advisories. Remove each once its parent asks for a fixed version itself.

## The × button

`×` hides the control until the next page load. The extension's popup has a
"Show the control on this page" button for the way back (FR9.7), and the
userscript a "show" command in its manager's menu.

- Rejected: `×` collapsing the control to one small button. Something would
  still cover the page, which is what `×` is pressed to get rid of.
- Rejected: keyboard shortcuts. Desktop only, they can clash with a site's or
  the browser's own shortcuts, and they don't help userscript or embed users.
- Embed: nothing proposed. The site owner decides how the control is shown, and
  a reload brings it back (documented in the embed guide).

## Code review: needs a real device

- [ ] M5: the Android manual-install guide may describe steps that can't install
      the unlisted `.xpi`. Walk the steps on a current release build of Firefox
      for Android and rewrite them with the menu names.
- [ ] The desktop minimum is Firefox 140 from 1.4.0 on. Not tried on a real
      Firefox 140.

## Code review: not planned

- A versioned embed file that never changes, so the guide could offer a
  Subresource Integrity hash. Left for now (maintainer, 2026-10-04); the embed
  guide says that the copy on the docs site doesn't support one.
- `detach()` leaves the scaled styles in place and there is no `restore()`.
  Nothing would call it: Firefox runs no content-script code when an add-on is
  disabled. `releaseElements` is the building block if it's ever needed.
- A stray fixture server on port 4310 would be reused by local Playwright runs.
  Not observed.
- Embed origins stored by versions before 1.4.0 (H1) stay in users' storage:
  they can't be told apart from sites the user visited.
- The popup doesn't tell a revoked site permission apart from Firefox's own
  pages; both get the same "can't change this page" message.

## Known limitations

Documented in FR6 and the limitations guide, no fix planned:

- M2: sizes don't follow changes driven by page state (a class added later, a
  site's own text-size switch).
- M3: shadow roots attached at a later moment, other than through a late custom
  element definition, are not scaled.
