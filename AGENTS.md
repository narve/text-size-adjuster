# Agent instructions

## Markdown style

- Wrap prose at **80 characters per line**. Exceptions: tables, and lines that
  only run long because of code (fenced blocks, inline code), URLs or links, or
  embedded scripts — don't break those to fit.
- Write tables as **fixed-width**: pad cells so every column's pipes line up and
  the table reads as a grid in plain text, e.g.

  ```markdown
  | Option     | Values              | Default        |
  | ---------- | ------------------- | -------------- |
  | `position` | `tl`, `tr`, ...     | `bottom-right` |
  | `show`     | `always`, `on-zoom` | `always`       |
  ```

  Tables may be wider than 80 characters. Don't wrap text inside cells across
  extra rows; keep each row on one line.

Both rules are enforced by Prettier's Markdown settings (`.prettierrc.json`):
run `npx prettier --write "**/*.md"` after editing Markdown.
