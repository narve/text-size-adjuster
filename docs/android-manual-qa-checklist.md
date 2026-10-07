# Firefox for Android — Manual QA Checklist

Playwright cannot automate Firefox for Android (Fenix) — its mobile automation
targets Chrome for Android only. This checklist is the Layer 3 substitute (see
`test-and-documentation-requirements.md` TR4) and must be walked by hand, on a
real device or an Android emulator, before an Android release is considered
done.

## Setup

### Userscript variant

1. Install a userscript manager that supports Firefox for Android (e.g.
   Tampermonkey for Android, or Violentmonkey if/when it ships a Fenix build —
   confirm current availability on addons.mozilla.org at QA time, since Android
   add-on availability has shifted over time).
2. Install the built `.user.js` (`packages/userscript/dist/`) via the manager's
   "import from file/URL" option.

### Extension variant

1. Produce the Mozilla-signed, unlisted `.xpi` with `npm run release:extension`
   (see the developer guide), and get it onto the device (e.g. via `adb push` or
   a direct download link).
2. Install it as described in
   `docs-site/src/guides/install-extension-manually-android.md`.
3. Confirm the extension's toolbar/menu entry appears under Firefox's `⋮` →
   extensions menu.

## Fixture walkthrough

For each fixture below, open it in Firefox for Android (point at the same local
fixture server used by the Playwright suite, reachable from the device/emulator,
or a temporarily deployed copy) and record pass/fail:

| Fixture                      | What to check                                         | Pass criteria                                                 |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `plain-px`                   | Increase/decrease a few steps                         | Text visibly grows/shrinks; no sideways scroll appears        |
| `rem-em`                     | Increase/decrease a few steps                         | Heading-to-body size ratio looks preserved                    |
| `shadow-dom-open`            | Increase/decrease                                     | Text inside the shadow-root widget scales along with the rest |
| `important-high-specificity` | Increase/decrease                                     | The page's own bold/forced font-size styling is overridden    |
| `spa-mutation`               | Trigger the fixture's "load more" action, then adjust | Newly added content scales too, without needing a reload      |

For both variants, also check:

- **A page without a viewport meta tag** (a desktop-only page, e.g. the `norvig`
  real-world site, or the `script-tag/on-zoom.html` fixture for the embed): it
  opens zoomed out to fit; with "show after zooming", pinching it up to a
  readable size reveals the control (FR10.2).
- **Back to normal**: set a larger size, then tap **↺**; the page looks exactly
  as it did before the first change (FR2.6).
- **Rotation**: set a larger size, rotate the phone to landscape and back; the
  text keeps the chosen size relative to the page's own layout, with no sideways
  scrolling (FR6.5).
- **An iframe-heavy page** (a news article with embedded videos or social
  posts): text inside the embeds follows the size (extension), or the page has
  exactly one control and no extra controls appear inside the embeds
  (userscript).

For the extension variant only, also check:

- **Default visibility**: right after installing, the control is hidden until
  you zoom in (FR10.4); the `⋮` → extensions menu entry works without zooming.
- Closing and reopening the page on the same site reapplies the last-used factor
  automatically (FR5.1 per-site persistence).
- The toolbar/popup +/- controls and the in-page floating widget (if both are
  present) stay in sync with each other.
- **Remember this site**: with "remember sizes automatically" turned off in the
  options, change the size, open the popup and tap **Remember this site**; the
  site appears in the options page's list, and reopening it reapplies the size
  (FR9.5).
- **Gear**: the **⚙** on the on-page control opens the options page (FR9.6).
  Automated tests only follow this to the options page in Chromium.
- **Show the control**: hide the on-page control with **×**, open the popup and
  tap **Show the control on this page**; the control is back in its corner and
  the button is gone from the popup (FR9.7). With "show after zooming", the
  button is also there before the first zoom.
- **Firefox's own pages** (e.g. `about:addons`): the popup says it can't change
  the page and its buttons are disabled.

## Reporting

Record the Firefox for Android version, device/emulator model and Android
version, and a pass/fail per row above. File any failure as an issue referencing
the fixture name and the FR/TR ID it traces to.
