# Functional Requirements — Text Size Adjuster

This document describes **what** the product must do, independent of implementation. See
`implementation-plan.md` for how/when, and `test-and-documentation-requirements.md` for how
each requirement is validated.

## FR1. Ad-hoc text scaling

- **FR1.1**: The user can increase/decrease the rendered text size of the current page without
  changing browser/OS accessibility settings.
- **FR1.2**: Scaling preserves the page's existing size *ratios* — an element that was visually
  larger than another stays proportionally larger after scaling.
- **FR1.3**: Scaling must not cause horizontal scrolling the way native pinch/page zoom does —
  text reflows within its existing container width.
- **FR1.4**: By default (no persistence configured), the effect lasts for the page's lifetime
  only and resets on reload — this is the "ad-hoc" mode.

**Acceptance**: on each fixture in the test suite, applying factors 0.5–3.0 keeps every element's
font-size-to-its-siblings ratio within rounding error of the unscaled page, and produces no new
horizontal scrollbar.

## FR2. Scaling algorithm behavior

(Engine-level requirements — behavior, not code.)

- **FR2.1**: Each element's *original* computed font size (and px-based line-height) must be
  captured once and reused as the scaling base, not re-derived from possibly-already-scaled
  values.
- **FR2.2**: Reading computed styles and writing new styles must be batched (all reads, then all
  writes) to avoid layout-thrashing on large pages.
- **FR2.3**: A `line-height: normal` computed value must be left alone (its rendered height
  already tracks font-size on its own). Any other line-height — including, somewhat
  counter-intuitively, a *unitless* multiplier like `1.5`, which resolves to a used pixel value
  via `getComputedStyle` just like an explicit length does — must be captured and rescaled
  explicitly like font-size, which reproduces the same end result the browser would already
  produce on its own.
- **FR2.4**: Content added to the page after initial load (SPA navigation, infinite scroll, lazy
  loading) must be detected and scaled automatically, without manually re-triggering anything,
  and without double-scaling elements that merely inherit font-size from an already-scaled
  ancestor.
- **FR2.5**: The applied scale must, in realistic cases, override the page's own font-size
  styling, including pages that use `!important` with ordinary selectors. (See FR6.4 for the
  one case this does not cover.)

## FR3. Two delivery mechanisms, one engine

- **FR3.1**: A userscript installable via Tampermonkey/Violentmonkey, usable on Firefox Desktop
  and Firefox for Android.
- **FR3.2**: A Firefox WebExtension (Manifest V3) installable on both Firefox Desktop and
  Firefox for Android.
- **FR3.3**: Both mechanisms must use the same scaling engine code — no duplicated/forked
  scaling logic between them. The one deliberate exception is reach: the extension may use its
  elevated permissions to scale content the userscript structurally cannot reach (see FR6.1) —
  that's a desirable capability difference to lean into, not a divergence to avoid.

## FR4. UI is decoupled from the engine

- **FR4.1**: The scaling engine exposes a UI-agnostic API (increase/decrease/reset/set/get-factor
  plus change notifications). It has no knowledge of any specific UI.
- **FR4.2**: An in-page floating +/- widget is one interchangeable UI, usable by both delivery
  mechanisms (and the only UI option for the userscript, since userscript managers have no
  toolbar-button API).
- **FR4.3**: The extension additionally offers a native browser-toolbar button/popup UI with its
  own +/- controls. It must control the same running engine instance (in the page) rather than
  embedding a second copy of the scaling logic.
- **FR4.4**: It must be possible to add a third UI later (e.g. keyboard shortcuts) without
  modifying the engine or existing UIs.

## FR5. Per-site persistence (extension)

- **FR5.1**: The extension remembers the chosen factor per site (origin) and reapplies it
  automatically on future visits, without user action.
- **FR5.2**: Persistence is implemented as a pluggable mechanism the engine is unaware of — the
  ad-hoc, no-persistence mode (FR1.4) must remain available by simply not wiring persistence up
  (this is the userscript's default).
- **FR5.3** (nice-to-have, not primary): the userscript variant may optionally persist per-site
  via the userscript manager's own storage API.

## FR6. Known, accepted limitations (explicitly out of scope for v1)

- **FR6.1**: Cross-origin iframe content (ads, embeds, third-party comment widgets) cannot be
  reached from page-injected JS — same-origin policy prevents it. This is a hard limitation for
  the **userscript**, which only runs as page-injected JS. The **extension** is expected to do
  better here: a browser extension can declare a content script with `"all_frames": true` plus
  host permissions covering those frames, which gets its own copy of the engine injected directly
  into each cross-origin iframe's own realm — not reaching across the boundary (still
  impossible), but running independently *inside* it, the same way the top-level page's content
  script runs inside the top document. The extension's background script keeps all frames' factors
  in sync via runtime messaging. This capability gap between the two delivery mechanisms is
  intentional (see FR3.3) — the extension doing more here is the point, not a bug to fix in the
  userscript.
- **FR6.2**: Closed shadow DOM content cannot be scaled; open shadow roots are supported.
- **FR6.3**: Elements in fixed-height/`overflow:hidden` containers may visually clip when
  enlarged — this is a layout limitation of the host page, not fixed by this tool.
- **FR6.4**: A page's literal inline `style="font-size: ... !important"` attribute cannot be
  overridden (CSS gives inline `!important` the highest possible priority). High-specificity
  *stylesheet* rules with `!important` are handled (FR2.5); this narrower inline case is not.

## FR8. Cross-browser compatibility (best-effort)

- **FR8.1**: Where possible, the same code should also work in Chrome, not only Firefox. This is
  best-effort, not a primary deliverable: Firefox Desktop + Firefox Android (FR3) remain the
  required targets, and nothing here should compromise them.
- **FR8.2**: The core engine (FR2) already only uses standard DOM/CSS APIs, so it is
  Chrome-compatible without special-casing.
- **FR8.3**: The extension (FR3.2) should avoid Firefox-only extension APIs where a
  cross-browser equivalent exists (e.g. via the `webextension-polyfill` library), so that a
  Chrome build is a thin manifest variation rather than a rewrite. Publishing to the Chrome Web
  Store is out of scope; building and manually loading an unpacked Chrome build is enough to call
  this satisfied.
- **FR8.4**: The userscript (FR3.1) already runs under Tampermonkey/Violentmonkey on Chrome with
  no extra work, since those managers are cross-browser; no additional requirement beyond FR3.1.

## FR7. Performance

- **FR7.1**: Scaling a typical page (hundreds to low-thousands of elements) must complete its
  initial pass without a noticeable UI freeze.
- **FR7.2**: Changing the factor after the initial pass (e.g. clicking + again) must be
  near-instant, since it should only update one CSS custom property rather than re-walking the
  DOM.
