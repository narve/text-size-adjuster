# TODO

Open work. The review items come from `docs/code-review-2026-10-03.md`;
`docs/code-review-2026-10-03-fixes.md` has the status of every finding,
including the ones already fixed.

## Releases

- addons.mozilla.org: 1.7.0 was submitted on 2026-10-07 and approved the same
  day; it is the version the listing serves.
- GitHub: 1.8.0 was released on 2026-10-07, the same code as 1.7.0 (Mozilla
  takes each version number on one channel only). Copies installed from the site
  update to it. 1.6.0 was signed but never published.
- Both carry the changes of 2026-10-07. Fixes: sizes going back to an earlier
  one or a reset being undone while a size is being saved, and text scaled twice
  (added to a shadow host's own children, or with a font-size transition on the
  page, when added or after a rotation). New: the gear, pages left untouched at
  100% (FR2.6), and the popup's "Show the control on this page" (FR9.7).
- [ ] Try the gear once in Firefox on desktop. On Android it opens the options
      page (tried 2026-10-07, Firefox 157); the automated tests only follow it
      there in Chromium.
- [ ] In no published version yet, all of 2026-10-07: the popup shown at a
      fraction of its size on Android (`ce40426`), the control off-screen on a
      page wider than the screen (`84f6087`), the options page wider than the
      screen (`1f1ac50`), the message when a page opens at a remembered size
      (FR9.8, `ec4de83`), and taking over the browser's enlarging (FR2.7,
      `9ea267e`). 1.9.0 has them all: signed as unlisted for trying on the
      phone, not published anywhere.
- [ ] Next: 2.1.0 on addons.mozilla.org, then 2.1.1 on GitHub (the numbering
      agreed on 2026-10-08, see the developer guide's "Version numbers"). Set
      2.1.0 by hand in `packages/extension/package.json`; `version:bump` takes
      it from there.
- [ ] Chrome Web Store: submitted by the maintainer on 2026-10-04.

## Bugs

- [ ] Sometimes, when increasing the text size makes the page reflow, the
      on-page control moves along with the reflow, some pixels up. Reported by
      the maintainer on 2026-10-07. Not seen on the phone on 2026-10-07 (norvig,
      Wikipedia, scottaaronson.blog). A candidate, fixed that day (`84f6087`):
      when the bigger text makes something wider than the screen, the layout
      viewport grows and the control's corner moves with it. Still to note if it
      shows again: the page and the installed version.
- On a Samsung Galaxy Z Flip7, opening the add-on from the browser's menu shows
  an extremely small popup. Reported by the maintainer on 2026-10-07. Fixed the
  same day (`ce40426`) and checked on that phone with Firefox 157: the popup had
  no viewport tag.
- On the same phone the options page ran past the edge of the screen. Reported
  by the maintainer on 2026-10-07. Fixed the same day (`1f1ac50`) and checked on
  that phone: a long site name in the list made the page's grid column wider
  than the screen.
- [ ] Options page, list of sites, on a phone: the size and "Remove" leave room
      for about ten characters of the site's name. Let the name wrap.

## Feature requests

- Done on 2026-10-07 (FR9.8, `ec4de83`): when a page opens at a size remembered
  for its site, a message says "Text size: x%" for about three seconds. Seen on
  the phone and in Firefox 140.
- [ ] The message should also say when the page was fitted to the screen for
      that site, if "Fit to screen" below is built.

## Pages without a viewport tag

The first item under "Seen on Android": on such a page a bigger size hardly
changes the main text, and a much bigger one makes it smaller. Firefox for
Android lays the page out about 980 px wide, enlarges its main text itself, and
zooms out to fit the widest thing on the page.

Two ways were tried on 2026-10-07 on the Galaxy Z Flip (Firefox 157), as
prototypes on the `fit-to-screen` branch (not for release), on
norvig.com/spell-correct.html and scottaaronson.blog/?p=10169.

**Taking over Firefox's enlarging**: built (FR2.7, `9ea267e`), automatic, in
1.9.0. While the text is scaled, Firefox's own enlarging is switched off
(`text-size-adjust: none` on the root element) and each element starts from the
size Firefox had given it: its line's height with the enlarging on, against the
same line with it off. Nothing for the user to do, no setting, no button.

- Prototype, both pages: 140% is 1.4 times as big and 200% twice (measured on
  the screenshots), the text wraps in its column, no sideways scrolling, and
  reset gives back the page exactly. The page's own layout is kept.
- The signed 1.9.0 on the phone, norvig.com at 140%: the same.
- Preformatted blocks get a sideways scroll of their own while scaled, so they
  don't widen the page.
- Left as it was: a header of fixed height overflows at 200% on the blog
  (FR6.3). Margins set in `em` grow with the text. Text Firefox doesn't enlarge
  (code, small print) starts from its small size (limitations guide).
- [ ] Tables wider than the page are not handled.
- The measuring can only be checked on a phone: Firefox's enlarging could not be
  switched on in desktop Firefox (the `font.size.inflation.*` preferences had no
  effect). The automated tests stand in for it by faking the line heights.

**Fitting the page to the screen** (works, but not recommended as the answer). A
button inserts a viewport tag, so the page is laid out at the screen's width.

- Inserting the tag works at once. Taking it out does nothing; changing it to
  `width=980` is the way back. `screen.width` is 360, the layout width 980
  before and 360 after.
- On its own it is not enough: the blog's text column has a fixed width of about
  760 px, so every line ran past the screen. With every element capped
  (`max-width: 100%`) and code scrolling inside its own box, both pages read
  well, at 100% and at 140%.
- Against it: the cap on every element is a blunt tool that will break some
  layouts; it needs a button, a setting, a choice remembered per site and a way
  back; the page jumps when it is fitted after load; and a reload undoes it
  unless that is remembered too.
- For it: everything on the page is laid out at its real size, also the text
  Firefox doesn't enlarge. Worth keeping as a possible button later.
- If built later: the choice per site next to the size (follow the general
  setting, fitted, not fitted), a setting on the options page that is off by
  default, the button shown only where the page has no viewport tag and is laid
  out wider than the screen, only for the page in the address bar, and in the
  userscript but not the embed.

## Seen on Android

Reported by the maintainer on 2026-10-04, with the builds of that time (1.1.0 to
1.4.0).

Tried on 2026-10-07 on a Galaxy Z Flip (SM-F766B, Firefox 157) with the 1.8.0
build, and on 2026-10-08 with the signed 1.9.0, driven over adb.
`norvig.com/spell-correct.html` (no viewport tag) and a Wikipedia article
(mobile layout).

- Not reproduced, 2026-10-08, 1.9.0: aftenposten.no, remembered at 110%, opening
  at 100%. It opened at 110% with the message saying so, and the popup showed
  110%. On 2026-10-07 a prototype build had shown it at 100% once.
- Not a bug: the add-on does nothing on its own page on addons.mozilla.org.
  Firefox lets no add-on run on Mozilla's add-ons site; the limitations guide
  says so, and from 2026-10-08 the popup's message names that site.
- [ ] Installing a signed file through Firefox's debug menu did not last once:
      after 1.9.0 was installed over the 1.8.0 that had been installed the same
      way, the add-on showed as switched off, and after Firefox restarted it was
      gone. Installing 1.9.0 again worked and stayed for the rest of the
      session. Not understood; it may have to do with the earlier build loaded
      through `web-ext`. Check that it is still there after the next restart.
      The debug menu itself goes away when Firefox restarts (the guide could say
      so).
- [ ] On a page without a viewport tag, a bigger size can make the text smaller.
      Seen on norvig.com: at 140% the main text is hardly bigger than at 100%,
      and at 200% it is clearly smaller. This is likely what "the text ends up a
      lot smaller" was. Reset puts the page back exactly. Cause and the way out:
      "Pages without a viewport tag" above.
- [ ] The control does not always appear when zooming. A likely cause found and
      fixed on 2026-10-07 (`84f6087`): on a page with something wider than the
      screen, the control's corner was off-screen (seen with the layout viewport
      at 766 by 1387 around a visible 360 by 652). After the fix it showed on
      that page. A pinch could not be sent over adb. Earlier fixes in the same
      area: M4 (`c005b35`) and `45957c6`.
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

- Done on 2026-10-07. M5: the Android manual-install guide was walked on the
  Galaxy Z Flip with Firefox 157 and installs the signed file; the guide now has
  the menu names and the step for finding the file.
- Done on 2026-10-07. Firefox 140.0 ESR on Linux, driven through WebDriver: the
  signed 1.4.0, 1.6.0 and 1.8.0 load, and the current build passes 21 checks
  (control, sizes, remembered size and its message, options page, popup page, a
  cross-origin frame, reset).

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
