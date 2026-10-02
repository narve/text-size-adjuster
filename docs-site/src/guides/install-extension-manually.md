# Advanced: install the extension manually

For technical users: ways to install the Firefox extension without it being
listed on [addons.mozilla.org](https://addons.mozilla.org/) — useful before it's
listed. (Most people should use the [normal install](install.html) instead.)
There are three ways.

| Method              | Permanent? | Regular Firefox?      | File                                                               |
| ------------------- | ---------- | --------------------- | ------------------------------------------------------------------ |
| 1. Temporary load   | No         | Yes                   | [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi)    |
| 2. Signed, unlisted | Yes        | Yes, incl. Android    | [signed `.xpi`](../downloads/text-size-adjuster.xpi), if published |
| 3. Unsigned         | Yes        | No: Dev, Nightly, ESR | [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi)    |

The unsigned file is the current build, packaged but _not signed by Mozilla_.
Building it yourself is described in
[the contributor section](../dev/developer-guide.html).

## 1. Temporary load (quickest, for trying it out)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick the downloaded unsigned `.xpi`.

Everything works, but Firefox removes it when it closes, so you repeat this each
session.

## 2. Signed but unlisted (recommended to keep it)

Regular Firefox only keeps extensions that Mozilla has signed. "Unlisted" means
Mozilla has signed it, but it is not shown in the add-ons store.

1. Download the [signed `.xpi`](../downloads/text-size-adjuster.xpi). It's only
   there once a signed release has been published; until then, use one of the
   other two methods.
2. In Firefox, open `about:addons`, click the gear icon, choose **Install Add-on
   From File…**, and pick the `.xpi`. (Dragging the file onto a Firefox window
   also works.)

The same signed `.xpi` also installs on
[Firefox for Android](install-extension-manually-android.html).

## 3. Unsigned (Firefox Developer Edition, Nightly or ESR only)

These Firefox editions can be told to accept unsigned extensions; regular
Firefox ignores this setting.

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Download the [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi).
3. Install it the same way as in method 2: `about:addons` → gear icon →
   **Install Add-on From File…**.

## After installing

Visit any page. The on-page **−/+** control appears, and the extension's toolbar
button gives you another way to adjust the size. Come back to that site later —
your chosen size is already applied.

Prefer not to deal with any of this? The [userscript](install-userscript.html)
needs no signing at all; it just doesn't remember a size per site.
