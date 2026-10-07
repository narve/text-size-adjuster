# What this can't fix (and why)

This tool works on the vast majority of web pages, but a few things are out of
its reach:

- **With the userscript, ads, embedded videos, and some comment sections might
  not resize.** These are often a small "page within the page," loaded from a
  different website, and browsers don't let a userscript reach inside that, for
  safety reasons. The Firefox add-on can: it resizes most of them along with the
  rest of the page.
- **A few sites hide extra content inside sealed, locked-down components nothing
  outside can touch.** This is rare in practice.
- **Text inside a small, fixed-size box — like a single-line title — might get
  cut off if you make it a lot bigger.** This can happen with your phone's own
  zoom too; it's a limitation of the page's own design, not something specific
  to this tool.
- **Occasionally, one specific piece of text on a page may resist resizing.**
  Some sites keep re-applying their own text size while you use the page, and
  some parts of a page that load late may stay at their normal size. This is
  uncommon.
- **If the site changes its own text size while you read** — with its own
  text-size or reading-mode button, or when you open a menu — that text may keep
  the size it had before. Going back to the normal size (**↺**) and resizing
  again fixes it. (Turning your phone or resizing the window is fine: the page
  adjusts.)
- **Text you write in a page's own editor can carry this tool's sizes with it.**
  Some editors for formatted text (webmail, blogging tools) save the styling
  along with the words, and that includes the sizes this tool sets while the
  page is resized. Go back to the normal size (**↺**) before you write there.
  Plain text boxes, like search fields and most comment forms, are not affected.
- **Boxes sized to fit their text can grow with it.** On a few pages, a very
  large size can make such a box wider than the screen.
- **The Firefox add-on can't work on Firefox's own pages** (settings, the
  add-ons page, the PDF viewer), on Mozilla's add-on site, or on sites where
  you've turned off its permission to access the site.

None of these affect the rest of the page — everything else still resizes
normally.
