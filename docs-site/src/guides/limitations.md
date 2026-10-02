# What this can't fix (and why)

This tool works on the vast majority of web pages, but a few things are out of
its reach:

- **Ads, embedded videos, and some comment sections might not resize.** These
  are often a small "page within the page," loaded from a different website —
  browsers don't let any tool, this one included, reach inside that for safety
  reasons. The Firefox extension handles more of these cases than the userscript
  version does, by design; the userscript is more limited here.
- **A few sites hide extra content inside sealed, locked-down components nothing
  outside can touch.** This is rare in practice.
- **Text inside a small, fixed-size box — like a single-line title — might get
  cut off if you make it a lot bigger.** This can happen with your phone's own
  zoom too; it's a limitation of the page's own design, not something specific
  to this tool.
- **Occasionally, one specific piece of text on a page may resist resizing.**
  Some sites keep re-applying their own text size while you use the page. This
  is uncommon.

None of these affect the rest of the page — everything else still resizes
normally.
