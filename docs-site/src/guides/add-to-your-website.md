# Add it to your own website

If you run a website, you can give every visitor the same **−/+** text-size control without them
installing anything. Add one line to your pages, anywhere in `<head>` or before `</body>`:

```html
<script src="https://narve.github.io/text-size-adjuster/embed/text-size-adjuster.js"></script>
```

That's all. The control appears in the bottom-right corner, scales your page's text while keeping
headings bigger than body text, and doesn't change your layout's width. [See it on a demo
page](../demos/script-tag/index.html).

**Good to know:**

- For a production site, download that file and serve it from your own server instead of linking
  to this documentation site — that way it can't change or disappear underneath you.
- The chosen size is not remembered between page loads; each visit starts at normal size. (The
  browser extension is the version that remembers a size per site.)
- This only works on sites you control. To use the control on *other people's* sites, install the
  [Firefox add-on](install.html) instead.
