# Install the file on Android

Most people should [install {{name}} from Firefox Add-ons](install.html), which
takes two taps. This page is for installing the file from this site instead.
Firefox for Android needs a hidden option turned on once before it can do that.
It takes a minute.

1. Download [{{name}}]({{signedXpi}}) on your phone. The file is signed by
   Mozilla.
2. In Firefox, open **Settings → About Firefox** and tap the Firefox logo five
   times, until it says the debug menu is enabled.
3. Go back to **Settings**. Near the bottom, under **Advanced**, tap **Install
   add-on from file** and choose the file you downloaded.
4. Tap **Add** when Firefox asks.

You need Firefox for Android {{firefoxAndroidMin}} or newer. Firefox asks for
permission to **access your data for all websites**. {{name}} needs that to
resize the text on the pages you visit, and [collects nothing](privacy.html).

Then visit any page: zoom in and the control appears. Your chosen size is
remembered for each site, the same as on a computer. See
[how to use it](install.html).

From version 1.4.0 on, Firefox keeps it up to date: it checks for new versions
and installs them itself. Earlier versions (1.1.0) don't update; if you have
one, install it once more from the link above to get updates from then on. To
see your version, open the add-on's **Options**.

## For testers

Regular Firefox for Android only installs signed add-ons. Firefox Nightly for
Android can also install the
[unsigned build](../downloads/text-size-adjuster-unsigned.xpi), after setting
`xpinstall.signatures.required` to `false` in `about:config`.
