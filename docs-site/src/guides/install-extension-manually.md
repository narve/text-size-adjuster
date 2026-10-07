# Advanced: install the extension manually

For technical users: ways to install an _unsigned_ build of the extension, for
testing. Most people should use the [normal install](install.html), which
installs the version signed by Mozilla.

| Method            | Permanent? | Which Firefox?         | File                                                            |
| ----------------- | ---------- | ---------------------- | --------------------------------------------------------------- |
| 1. Temporary load | No         | Any                    | [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi) |
| 2. Unsigned       | Yes        | Dev, Nightly, ESR only | [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi) |

The unsigned file is the current build, packaged but _not signed by Mozilla_.
Building it yourself is described in
[the contributor section](../dev/developer-guide.html).

Both need Firefox {{firefoxMin}} or newer. Firefox asks for permission to
**access your data for all websites**. {{name}} needs that to resize the text on
the pages you visit, and [collects nothing](privacy.html).

## 1. Temporary load (quickest, for trying it out)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick the downloaded unsigned `.xpi`.

Everything works, but Firefox removes it when it closes, so you repeat this each
session.

## 2. Unsigned (Firefox Developer Edition, Nightly or ESR only)

These Firefox editions can be told to accept unsigned extensions; regular
Firefox ignores this setting.

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Download the [unsigned `.xpi`](../downloads/text-size-adjuster-unsigned.xpi).
3. Open `about:addons`, click the gear icon, choose **Install Add-on From
   File…**, and pick the `.xpi`. (Dragging the file onto a Firefox window also
   works.)

## After installing

Visit any page and zoom in: the on-page **−/+** control appears. The extension's
toolbar button adjusts the size at any time, without zooming. Come back to that
site later — your chosen size is already applied.

Prefer not to deal with any of this? The [userscript](install-userscript.html)
needs no signing at all; it just doesn't remember a size per site.
