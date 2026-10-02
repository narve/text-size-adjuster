# Advanced: install the extension manually

For technical users: ways to install the Firefox extension without it being listed on
[addons.mozilla.org](https://addons.mozilla.org/) — useful before it's listed, or to run your own
build. (Most people should use the [normal install](install.html) instead.) There are three ways. All three start from the built extension folder, `packages/extension/dist/`
(see [the contributor section](../dev/index.html) for how to build it), and the commands below
are run from `packages/extension/`.

| Method | Stays installed? | Works in regular Firefox? | Needs a Mozilla account? |
|---|---|---|---|
| 1. Temporary load | No — removed when Firefox closes | Yes | No |
| 2. Signed, unlisted | Yes | Yes (desktop and Android) | Yes (free) |
| 3. Unsigned | Yes | No — Developer Edition, Nightly or ESR only | No |

## 1. Temporary load (quickest, for trying it out)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `packages/extension/dist/manifest.json`.

Everything works, but Firefox removes it when it closes, so you repeat this each session.

## 2. Signed but unlisted (recommended to keep it)

Regular Firefox only keeps extensions that Mozilla has signed. "Unlisted" means Mozilla signs it,
but it is never shown in the add-ons store — it stays private to you.

1. Create API credentials at
   [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/)
   (needs a free Firefox account).
2. Sign it:
   ```bash
   npx web-ext sign --source-dir dist --channel unlisted \
     --api-key <your JWT issuer> --api-secret <your JWT secret>
   ```
   Signing is automated and usually takes a few minutes. The signed `.xpi` file lands in
   `web-ext-artifacts/`.
3. In Firefox, open `about:addons`, click the gear icon, choose **Install Add-on From File…**, and
   pick the `.xpi`. (Dragging the file onto a Firefox window also works.)

The same signed `.xpi` also installs on [Firefox for Android](install-extension-manually-android.html).

## 3. Unsigned (Firefox Developer Edition, Nightly or ESR only)

These Firefox editions can be told to accept unsigned extensions; regular Firefox ignores this
setting.

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Package the extension:
   ```bash
   npx web-ext build --source-dir dist
   ```
   This creates a `.zip` in `web-ext-artifacts/`.
3. Install it the same way as in method 2: `about:addons` → gear icon → **Install Add-on From
   File…**.

## After installing

Visit any page. The on-page **−/+** control appears, and the extension's toolbar button gives you
another way to adjust the size. Come back to that site later — your chosen size is already
applied.

Prefer not to deal with any of this? The [userscript](install-userscript.html)
needs no signing at all; it just doesn't remember a size per site.
