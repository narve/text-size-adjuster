# Install: Firefox Desktop (extension)

The extension additionally remembers your chosen size *per site* and reapplies it automatically
next time you visit, and adds a toolbar button alongside the on-page control.

1. Install from [addons.mozilla.org](https://addons.mozilla.org/) once listed there (link added
   when available), **or** load it temporarily yourself:
   - Download/build the extension (see [the contributor section](../dev/index.html)).
   - Open `about:debugging#/runtime/this-firefox` in Firefox.
   - Click **Load Temporary Add-on…** and select the extension's `manifest.json`.
2. Visit any page. The same on-page **−/+** control appears, and the extension's toolbar icon
   gives you another way to adjust the size.
3. Come back to that site later — your chosen size is already applied, automatically.

A temporary add-on is removed when Firefox closes; for something that stays installed, use a
signed build (self-distributed or from addons.mozilla.org once available).
