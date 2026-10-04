# TODO

Open work. The review items come from `docs/code-review-2026-10-03.md`;
`docs/code-review-2026-10-03-fixes.md` has the status of every finding,
including the ones already fixed.

## Seen on Android

Reported by the maintainer on 2026-10-04. Still to do for each: check it on a
real device with the current build, and note the page, whether the on-page
control or the toolbar popup was used, and the installed version (the review
fixes are in 1.3.0).

- [ ] The control does not always appear when zooming. Two fixes may cover it:
      M4 (`c005b35`), and `45957c6`: a control added after the page had loaded
      was placed almost entirely outside the visible area on a page shown zoomed
      out to fit.
- [ ] The control does not always update its number: adjusting the text size
      works, but the display stays at 100%. This matches the symptom of C1 (text
      scales, the display keeps showing "100%"), fixed in `876c4ec` and
      `71e419b`. Not reproduced on an emulated phone in Chromium.
- [ ] Sometimes, after adjusting up a few notches and then pressing the reset
      button, the text ends up a lot smaller than it originally was. Could be
      tied to the previous item. Not reproduced on an emulated phone in Chromium
      (four fixtures; increase, rotate, rotate back, reset).

## Waiting for a fix upstream

- [ ] `npm audit`: `esbuild` (held at 0.27 by `tsup`) and `node-forge` (through
      `web-ext`). Both are dev tooling and don't reach the shipped bundles.

## The × button

`×` hides the control until the next page load. That is acceptable as it is
(maintainer, 2026-10-04); change it only for a solution that is good and has no
drawbacks of its own. Proposals:

- [ ] Userscript: a "Text size control: show" command in the userscript
      manager's menu. The menu already exists and its other commands already
      bring the control back as a side effect of changing a setting; this one
      would do it without changing anything. No drawback found.
- [ ] Extension: a "Show the control on this page" button in the popup, shown
      only while the control is hidden. Small gain, since the popup's own
      buttons already change the size; costs one more message type.
- Rejected: `×` collapsing the control to one small button. Something would
  still cover the page, which is what `×` is pressed to get rid of.
- Rejected: keyboard shortcuts. Desktop only, they can clash with a site's or
  the browser's own shortcuts, and they don't help userscript or embed users.
- Embed: nothing proposed. The site owner decides how the control is shown, and
  a reload brings it back (documented in the embed guide).

## Code review: needs a decision

- [ ] `strict_min_version` is 142, which excludes Firefox ESR 140. Lowering it
      changes what a release supports; check which Firefox for Android version
      first supports `data_collection_permissions`.
- [ ] Store description: say which Firefox version is needed, and that the
      "Access your data for all websites" permission has to be accepted. Waits
      for the `strict_min_version` decision.
- [ ] Privacy statement: `data-tsa-scaled` on every element lets a page detect
      the add-on. Worth a sentence?
- [ ] The embed file is not versioned, so the guide can't offer a Subresource
      Integrity hash. Needs a release rule: a versioned file must never change
      once published, while the docs workflow republishes on every push.

## Code review: needs a real device or a real release

- [ ] M5: the Android manual-install guide may describe steps that can't install
      the unlisted `.xpi`. Walk the steps on a current release build of Firefox
      for Android and rewrite them with the menu names.
- [ ] `release-github.js`: the check for an existing tag (`a035905`) was only
      syntax-checked; watch it on the next release.

## Code review: not planned

- `detach()` leaves the scaled styles in place and there is no `restore()`.
  Nothing would call it: Firefox runs no content-script code when an add-on is
  disabled. `releaseElements` is the building block if it's ever needed.
- A stray fixture server on port 4310 would be reused by local Playwright runs.
  Not observed.
- Embed origins stored by versions before 1.3.0 (H1) stay in users' storage:
  they can't be told apart from sites the user visited.
- The popup doesn't tell a revoked site permission apart from Firefox's own
  pages; both get the same "can't change this page" message.

## Known limitations

Documented in FR6 and the limitations guide, no fix planned:

- M2: sizes don't follow changes driven by page state (a class added later, a
  site's own text-size switch).
- M3: shadow roots attached at a later moment, other than through a late custom
  element definition, are not scaled.
