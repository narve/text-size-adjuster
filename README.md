# Text Size Adjuster

Scale a web page's text up or down, ad hoc, without the sideways-scrolling mess
native pinch/page zoom causes — as a Tampermonkey-style userscript or a Firefox
(and, best-effort, Chrome) extension, on both desktop and Android.

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
6. **The generated documentation site** (`docs-site/`, built by `npm run build`,
   served via `npm run docs:serve`) — this is the **end-user-facing** site:
   install guides and a screenshot gallery. It deliberately excludes
   build/publishing details (those live in the developer guide above instead).

Docs 1–5 are hand-maintained Markdown in this repo; doc 6 is generated output
and isn't committed (see `.gitignore`).

## Quick start (development)

```bash
npm install
npm run build   # builds every package, runs the required test suite, builds the docs site
```

See `docs/developer-guide.md` for the full command reference.
