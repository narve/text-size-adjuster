# Advanced: install the extension manually on Android

Firefox for Android can install extensions that aren't on addons.mozilla.org,
but it takes one extra one-time step to turn on the option.

1. In Firefox for Android, go to **Settings → About Firefox** and tap the
   Firefox logo several times until a "Custom Add-on collection" / debugging
   option appears.
2. Get the [signed `.xpi`](../downloads/text-size-adjuster.xpi) onto your phone
   (downloaded directly, or transferred another way) and install it through that
   new debug option. It's the same file as method 2, "Signed but unlisted", in
   the [manual install guide](install-extension-manually.html), and it's only
   there once a signed release has been published. Regular Firefox for Android
   won't install the
   [unsigned download](../downloads/text-size-adjuster-unsigned.xpi); only
   Firefox Nightly for Android can, after setting
   `xpinstall.signatures.required` to `false` in `about:config`.
3. Confirm the install when prompted.
4. Visit any page — the on-page control appears, and the extension remembers
   your chosen size per site automatically, the same as on desktop.

If a listed, one-tap install becomes available on addons.mozilla.org, that's
simpler and is the recommended route once it exists — this manual path is the
fallback.
