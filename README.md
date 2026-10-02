# Text Size Adjuster

Make a page's text bigger or smaller with one tap — without zooming the whole
page or scrolling sideways.

<!-- The sentence above is the summary in product.json; keep them identical. -->

It's a Firefox extension (desktop and Android; Chrome best-effort), a
userscript, and a script tag site owners can add to their own pages.

## Documentation

Read in this order:

1. **[`docs/functional-requirements.md`](docs/functional-requirements.md)** —
   what the product does, and its explicit, accepted limitations. Start here to
   understand the problem and scope.
2. **[`docs/test-and-documentation-requirements.md`](docs/test-and-documentation-requirements.md)**
   — what's validated, how, and at what priority (the engine's
   correctness/performance is the hard requirement; packaged-extension and
   Android automation are explicitly best-effort/manual).
3. **[`docs/implementation-plan.md`](docs/implementation-plan.md)** — the
   architecture, API contracts, repo layout, and the phased build order, for
   understanding _how_ it's built.
4. **[`docs/developer-guide.md`](docs/developer-guide.md)** — for contributors:
   building, testing, and publishing each delivery mechanism (AMO, Chrome Web
   Store, Greasy Fork).
5. **[`docs/android-manual-qa-checklist.md`](docs/android-manual-qa-checklist.md)**
   — the manual walkthrough that substitutes for automated testing on Firefox
   for Android.
6. **The generated documentation site** (`docs-site/`, published at
   <https://narve.github.io/text-size-adjuster/>) — this is the
   **end-user-facing** site: install guides and a screenshot gallery. It
   deliberately excludes build/publishing details (those live in the developer
   guide above instead).

Docs 1–5 are hand-maintained Markdown in this repo; doc 6 is generated output
and isn't committed (see `.gitignore`).

## Development

See [`docs/developer-guide.md`](docs/developer-guide.md) for the commands (start
with `npm install` and `npm run build`).

## License

[MIT](LICENSE) — free to use, modify and redistribute, as long as the copyright
notice and license text are kept with the code.
