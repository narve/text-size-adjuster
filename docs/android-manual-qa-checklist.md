# Firefox for Android — Manual QA Checklist

Playwright cannot automate Firefox for Android (Fenix) — its mobile automation targets Chrome for
Android only. This checklist is the Layer 3 substitute (see `test-and-documentation-requirements.md`
TR4) and must be walked by hand, on a real device or an Android emulator, before an Android
release is considered done.

## Setup

### Userscript variant
1. Install a userscript manager that supports Firefox for Android (e.g. Tampermonkey for Android,
   or Violentmonkey if/when it ships a Fenix build — confirm current availability on
   addons.mozilla.org at QA time, since Android add-on availability has shifted over time).
2. Install the built `.user.js` from this repo's `packages/userscript/dist/` via the manager's
   "import from file/URL" option.

### Extension variant
1. Enable Firefox for Android's hidden debug menu: Settings → About Firefox → tap the Firefox
   logo several times until "Custom Add-on collection" / debugging options appear.
2. Build the extension (`npm run build -w packages/extension`), get the self-signed/unlisted
   `.xpi` onto the device (e.g. via `adb push` or a direct download link), and install it through
   the debug menu's install-from-file option.
3. Confirm the extension's toolbar/menu entry appears under Firefox's `⋮` → extensions menu.

## Fixture walkthrough

For each fixture below, open it in Firefox for Android (point at the same local fixture server
used by the Playwright suite, reachable from the device/emulator, or a temporarily deployed copy)
and record pass/fail:

| Fixture | What to check | Pass criteria |
|---|---|---|
| `plain-px` | Increase/decrease a few steps | Text visibly grows/shrinks; no sideways scroll appears |
| `rem-em` | Increase/decrease a few steps | Heading-to-body size ratio looks preserved |
| `shadow-dom-open` | Increase/decrease | Text inside the shadow-root widget scales along with the rest |
| `important-high-specificity` | Increase/decrease | The page's own bold/forced font-size styling is overridden |
| `spa-mutation` | Trigger the fixture's "load more" action, then adjust | Newly added content scales too, without needing a reload |

For the extension variant only, also check:

- Closing and reopening the page on the same site reapplies the last-used factor automatically
  (FR5.1 per-site persistence).
- The toolbar/popup +/- controls and the in-page floating widget (if both are present) stay in
  sync with each other.

## Reporting

Record the Firefox for Android version, device/emulator model and Android version, and a
pass/fail per row above. File any failure as an issue referencing the fixture name and the FR/TR
ID it traces to.
