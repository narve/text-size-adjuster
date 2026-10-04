# TODO

Open work. The review items come from `docs/code-review-2026-10-03.md`;
`docs/code-review-2026-10-03-fixes.md` has the status of every finding,
including the ones already fixed.

## Seen on Android

Reported by the maintainer on 2026-10-04. Check each against 1.3.0 on a real
device first: the review fixes may already cover some of them.

- [ ] The control does not always appear when zooming. Could be fixed by M4
      (`c005b35`).
- [ ] The control does not always update its number: adjusting the text size
      works, but the display stays at 100%. This matches the symptom of C1 (text
      scales, the display keeps showing "100%"), fixed in `876c4ec` and
      `71e419b`.
- [ ] Sometimes, after adjusting up a few notches and then pressing the reset
      button, the text ends up a lot smaller than it originally was. Could be
      tied to the previous item.

## Code review: clear fix

- [ ] `npm audit` advisories in dev tooling (`esbuild`, `vitest`, `node-forge`
      through `web-ext`).
- [ ] GitHub Actions are pinned by tag, not by commit.
- [ ] `sign.js` runs `npx`, which needs `npx.cmd` or a shell on Windows.
- [ ] `tools/paths.d.ts` is a hand-maintained twin of `tools/paths.js`.
- [ ] The `private.env` key names are written out in three places (developer
      guide, a comment, the code).

## Code review: needs a decision

- [ ] "Remember this site" stores `1` when the page is at 100%, so the options
      page lists the site at 100%. Hide the button at 100%, or let it mean
      "remember normal size"?
- [ ] The control has no keyboard shortcut, and `×` hides it until the next page
      load. Make `×` minimise to a single button?
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
