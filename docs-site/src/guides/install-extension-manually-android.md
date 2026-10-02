# Install on Android

Until {{name}} is on Firefox Add-ons, Firefox for Android needs a hidden option
turned on once before it can install it. It takes a minute.

1. Download [{{name}}]({{signedXpi}}) on your phone. The file is signed by
   Mozilla.
2. In Firefox, open **Settings → About Firefox** and tap the Firefox logo five
   times, until it says the debug menu is enabled.
3. Go back to **Settings**. Near the bottom, under **Advanced**, tap **Install
   add-on from file** and choose the file you downloaded.
4. Tap **Add** when Firefox asks.

Then visit any page: zoom in and the control appears. Your chosen size is
remembered for each site, the same as on a computer. See
[how to use it](install.html).

Installed this way, {{name}} doesn't update itself. To get a newer version,
download and install it again.

## For testers

Regular Firefox for Android only installs signed add-ons. Firefox Nightly for
Android can also install the
[unsigned build](../downloads/text-size-adjuster-unsigned.xpi), after setting
`xpinstall.signatures.required` to `false` in `about:config`.
