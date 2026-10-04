# Add it to your own website

If you run a website, you can give every visitor the same **−/+** text-size
control without them installing anything. Add one line to your pages, anywhere
in `<head>` or before `</body>`:

```html
<script src="{{homepage}}embed/text-size-adjuster.js"></script>
```

That's all. The control appears in the bottom-right corner, scales your page's
text while keeping headings bigger than body text, and doesn't change your
layout's width. [See it on a demo page](../demos/script-tag/index.html).

## Options

Set them as attributes on the script tag:

```html
<script
  src="{{homepage}}embed/text-size-adjuster.js"
  data-position="top-left"
  data-show="on-zoom"
></script>
```

…or as parameters on the script's address, if attributes are awkward in your
setup:

```html
<script src="{{homepage}}embed/text-size-adjuster.js?position=tl&show=on-zoom"></script>
```

| Option     | Values                 | Default        |
| ---------- | ---------------------- | -------------- |
| `position` | `tl`, `tr`, `bl`, `br` | `bottom-right` |
| `show`     | `always`, `on-zoom`    | `always`       |

`position` also accepts the long forms `top-left`, `top-right`, `bottom-left`
and `bottom-right`. `on-zoom` keeps the control hidden until the visitor zooms
in (pinch, or browser zoom). If an option is set both ways, the attribute wins.
Unknown values are ignored.

**Good to know:**

- For a production site, download that file and serve it from your own server
  instead of linking to this documentation site — that way it can't change or
  disappear underneath you.
- The copy on this site is replaced whenever a new version is published, so an
  `integrity` attribute (Subresource Integrity) on a script tag pointing at it
  would stop working at the next update. With your own copy you can add one.
- The chosen size is not remembered between page loads; each visit starts at
  normal size. (The browser extension is the version that remembers a size per
  site.)
- A visitor who hides the control with **×** gets it back when the page is
  loaded again.
- This only works on sites you control. To use the control on _other people's_
  sites, install the [Firefox add-on](install.html) instead.
