# Advanced: install as a userscript

A userscript runs inside a userscript manager add-on instead of being its own
add-on. It needs no signing and also works in Chrome, but it does **not**
remember your chosen size per site and has no toolbar button — just the on-page
control.

## Firefox on a computer (or Chrome)

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/)
   or [Violentmonkey](https://violentmonkey.github.io/).
2. Download
   [`text-size-adjuster.user.js`](../downloads/text-size-adjuster.user.js) —
   most userscript managers offer to install it as soon as you open that link.
   (Or build it from source: `npm run build -w packages/userscript`, see
   [the contributor section](../dev/index.html).)
3. Drag the file into a browser tab, or use the manager's **Utilities → Import
   from file**, and confirm the installation.

## Firefox for Android

1. Install a userscript manager that supports Firefox for Android — Tampermonkey
   has an Android build; check [addons.mozilla.org](https://addons.mozilla.org/)
   from your phone for current availability.
2. Open [the `.user.js` link](../downloads/text-size-adjuster.user.js) in
   Firefox for Android (or use the manager's import option), and confirm the
   installation.

After installing, the round **−/+** control appears in the bottom-right corner
of every page.

## Settings

Open your userscript manager's menu (its toolbar icon) while on any page: Text
Size Adjuster adds commands there to place the control in a different corner, or
to show it only after you zoom in. Your choice is remembered.
