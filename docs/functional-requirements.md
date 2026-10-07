# Functional Requirements — Text Size Adjuster

This document describes **what** the product must do, independent of
implementation. See `implementation-plan.md` for how/when, and
`test-and-documentation-requirements.md` for how each requirement is validated.

## FR1. Ad-hoc text scaling

- **FR1.1**: The user can increase/decrease the rendered text size of the
  current page without changing browser/OS accessibility settings.
- **FR1.2**: Scaling preserves the page's existing size _ratios_ — an element
  that was visually larger than another stays proportionally larger after
  scaling.
- **FR1.3**: Scaling must not cause horizontal scrolling the way native
  pinch/page zoom does — text reflows within its existing container width.
- **FR1.4**: By default (no persistence configured), the effect lasts for the
  page's lifetime only and resets on reload — this is the "ad-hoc" mode.

**Acceptance**: on each fixture in the test suite, applying factors 0.5–3.0
keeps every element's font-size-to-its-siblings ratio within rounding error of
the unscaled page, and produces no new horizontal scrollbar.

## FR2. Scaling algorithm behavior

(Engine-level requirements — behavior, not code.)

- **FR2.1**: Each element's _original_ computed font size (and px-based
  line-height) must be captured once and reused as the scaling base, not
  re-derived from possibly-already-scaled values.
- **FR2.2**: Reading computed styles and writing new styles must be batched (all
  reads, then all writes) to avoid layout-thrashing on large pages.
- **FR2.3**: A `line-height: normal` computed value must be left alone (its
  rendered height already tracks font-size on its own). Any other line-height —
  including, somewhat counter-intuitively, a _unitless_ multiplier like `1.5`,
  which resolves to a used pixel value via `getComputedStyle` just like an
  explicit length does — must be captured and rescaled explicitly like
  font-size, which reproduces the same end result the browser would already
  produce on its own.
- **FR2.4**: Content added to the page after initial load (SPA navigation,
  infinite scroll, lazy loading) must be detected and scaled automatically,
  without manually re-triggering anything, and without double-scaling elements
  that merely inherit font-size from an already-scaled ancestor.
- **FR2.5**: The applied scale must, in realistic cases, override the page's own
  font-size styling, including pages that use `!important` with ordinary
  selectors, and inline `!important` styles. (See FR6.4 for the one case this
  does not cover.)
- **FR2.6**: At the normal size (factor 1) the page is left as its author wrote
  it. Sizes are captured, and new content is watched for, from the first change
  to another size (a remembered size counts), and on the way back to the normal
  size everything is let go of again: the inline styles, the marker attribute
  and the factor. A page nobody resizes is never modified.

## FR3. Multiple delivery mechanisms, one engine

- **FR3.1**: A Firefox WebExtension (Manifest V3) installable on both Firefox
  Desktop and Firefox for Android. This is the primary delivery mechanism, and
  the one end users are pointed to.
- **FR3.2**: A userscript installable via Tampermonkey/Violentmonkey, usable on
  Firefox Desktop and Firefox for Android — an alternative for technical users.
- **FR3.3**: All delivery mechanisms must use the same scaling engine code — no
  duplicated/forked scaling logic between them. The one deliberate exception is
  reach: the extension may use its elevated permissions to scale content the
  userscript structurally cannot reach (see FR6.1) — that's a desirable
  capability difference to lean into, not a divergence to avoid.
- **FR3.4**: A site owner can add the tool to their own website with a single
  `<script src>` tag (same engine and floating widget, no persistence). This
  only covers sites the owner controls — it's not a way for a visitor to use the
  tool on someone else's site.

## FR4. UI is decoupled from the engine

- **FR4.1**: The scaling engine exposes a UI-agnostic API
  (increase/decrease/reset/set/get-factor plus change notifications). It has no
  knowledge of any specific UI.
- **FR4.2**: An in-page floating +/- widget is one interchangeable UI, usable by
  all delivery mechanisms (and the only UI option for the userscript, since
  userscript managers have no toolbar-button API).
- **FR4.3**: The extension additionally offers a native browser-toolbar
  button/popup UI with its own +/- controls. It must control the same running
  engine instance (in the page) rather than embedding a second copy of the
  scaling logic.
- **FR4.4**: It must be possible to add a third UI later (e.g. keyboard
  shortcuts) without modifying the engine or existing UIs.

## FR5. Per-site persistence (extension)

- **FR5.1**: The extension remembers the chosen factor per site (origin) and
  reapplies it automatically on future visits, without user action.
- **FR5.2**: Persistence is implemented as a pluggable mechanism the engine is
  unaware of — the ad-hoc, no-persistence mode (FR1.4) must remain available by
  simply not wiring persistence up (this is the userscript's default).
- **FR5.3** (nice-to-have, not primary): the userscript variant may optionally
  persist per-site via the userscript manager's own storage API.

## FR6. Known, accepted limitations (explicitly out of scope for v1)

- **FR6.1**: Cross-origin iframe content (ads, embeds, third-party comment
  widgets) cannot be reached from page-injected JS — same-origin policy prevents
  it. This is a hard limitation for the **userscript**, which only runs as
  page-injected JS. The **extension** is expected to do better here: a browser
  extension can declare a content script with `"all_frames": true` plus host
  permissions covering those frames, which gets its own copy of the engine
  injected directly into each cross-origin iframe's own realm — not reaching
  across the boundary (still impossible), but running independently _inside_ it,
  the same way the top-level page's content script runs inside the top document.
  The top frame is the source of truth: it holds the controls and the size
  remembered for the site in the address bar (FR5.1), and every other frame
  follows it via runtime messaging. An embedded frame never stores a size under
  its own origin. This capability gap between the extension and the userscript
  is intentional (see FR3.3) — the extension doing more here is the point, not a
  bug to fix in the userscript.
- **FR6.2**: Closed shadow DOM content cannot be scaled; open shadow roots are
  supported. An open shadow root is found when its host element is scanned, or
  when a custom element that wasn't defined yet gets its definition; one
  attached at any other later moment is not scaled.
- **FR6.3**: Elements in fixed-height/`overflow:hidden` containers may visually
  clip when enlarged — this is a layout limitation of the host page, not fixed
  by this tool. Likewise, a box whose width is set relative to its own text size
  (`em`) grows with the text and can overflow at large factors. (Layout sized in
  `rem` keeps its size: the page's root font size is never scaled.)
- **FR6.4**: If a page's own script rewrites an element's inline style after it
  has been scaled (e.g. a framework re-rendering that element), the element
  returns to the page's size. Static styling, including `!important` rules and
  inline `!important` styles, is handled (FR2.5); this narrower dynamic case is
  not.
- **FR6.5**: Each element's size is captured as pixels from the page's styling
  at that moment (FR2.1). When the viewport's width changes (a phone rotated, a
  window resized), everything is captured again, so viewport-relative sizes and
  media queries keep applying. Other later changes driven by the page's own
  state are not followed: a class added afterwards (hover/open states, a site's
  dark or reading mode) or the site's own text-size switch leaves the affected
  elements at the size captured before, until the next capture or a reload.
- **FR6.6**: While a page is resized, the scaling is written into it as inline
  styles and a marker attribute (FR2.1, FR2.6). A page that saves or sends its
  own markup takes them along: text written in a `contenteditable` editor
  (webmail, a blogging tool) at another size than the normal one can carry them
  into what is stored or sent.

## FR8. Cross-browser compatibility (best-effort)

- **FR8.1**: Where possible, the same code should also work in Chrome, not only
  Firefox. This is best-effort, not a primary deliverable: Firefox Desktop +
  Firefox Android (FR3) remain the required targets, and nothing here should
  compromise them.
- **FR8.2**: The core engine (FR2) already only uses standard DOM/CSS APIs, so
  it is Chrome-compatible without special-casing.
- **FR8.3**: The extension (FR3.1) should avoid Firefox-only extension APIs
  where a cross-browser equivalent exists (e.g. via the `webextension-polyfill`
  library), so that a Chrome build is a thin manifest variation rather than a
  rewrite. Building and manually loading an unpacked Chrome build is enough to
  call this satisfied; publishing to the Chrome Web Store is optional (the
  developer guide describes how).
- **FR8.4**: The userscript (FR3.2) already runs under
  Tampermonkey/Violentmonkey on Chrome with no extra work, since those managers
  are cross-browser; no additional requirement beyond FR3.2.

## FR7. Performance

- **FR7.1**: Scaling a typical page (hundreds to low-thousands of elements) must
  complete its initial pass without a noticeable UI freeze. The initial pass
  runs at the first change away from the normal size (FR2.6); until then the
  tool does no work on the page.
- **FR7.2**: Changing the factor after the initial pass (e.g. clicking + again)
  must be near-instant, since it should only update one CSS custom property
  rather than re-walking the DOM.

## FR9. Extension options page

- **FR9.1**: The extension has an options page, reachable the standard way
  (Firefox's add-on manager → the extension → Options/Preferences).
- **FR9.2**: The options page shows a scrollable list of the sites the extension
  is currently active for — every site with a saved, non-default size (FR5.1) —
  with each site's size, and a way to remove a site individually, which puts it
  back to normal size (including in tabs that are already open).
- **FR9.3**: The options page holds the on-page control settings (FR10) for the
  extension. Changes apply to all sites, and to already-open pages without
  reloading them.

- **FR9.4**: The options page has a setting for whether sizes are remembered per
  site automatically (default: on, which is FR5.1's behaviour). When it's off,
  size changes are temporary (reset on reload, like FR1.4) unless the site is
  remembered explicitly.
- **FR9.5**: When automatic remembering is off, the toolbar popup offers a
  "Remember this site" button for the current tab's site (shown only if that
  site isn't remembered yet). It saves the current size; the site then appears
  in the FR9.2 list, and its later size changes are saved too, until it's
  removed from the list. At normal size (100%) there is nothing to remember: the
  button saves nothing and the popup says so for a few seconds. (The button
  lives in the popup rather than on the options page because only the popup
  knows which site is current.)
- **FR9.6**: The extension's on-page control has a gear button that opens the
  options page directly. The userscript and the script tag have no options page,
  so their control has no gear.
- **FR9.7**: While the on-page control can't be seen (hidden with `×`, or still
  waiting for a zoom), the toolbar popup offers a "Show the control on this
  page" button that brings it back in its corner, without a reload.

## FR10. On-page control settings

Settings for the floating control. As a general rule, every setting here is
available in all delivery mechanisms, not just the extension.

- **FR10.1 Placement**: the control can sit in any of the four corners of the
  viewport: top-left, top-right, bottom-left, bottom-right.
- **FR10.2 Visibility**: the control is either shown _always_, or hidden _until
  the user zooms_ (pinch-zoom, or browser page zoom above 100%). Zooming in is
  the moment someone is struggling to read, so that's when the control appears;
  once shown it stays visible on that page. While the page is pinch-zoomed, the
  control stays inside the visible area at its normal size.
- **FR10.3 Where each mechanism gets its settings**:
  - _Extension_: the options page (FR9.3). The toolbar/menu button keeps working
    regardless of visibility, so the extension always has a way to adjust the
    size.
  - _Script tag_ (FR3.4): attributes on the script tag
    (`data-position="top-left"`, `data-show="on-zoom"`) or parameters on its URL
    (`text-size-adjuster.js?position=top-left&show=on-zoom`). Short placement
    forms `tl`, `tr`, `bl`, `br` are accepted. If both are given, the attribute
    wins; unknown values fall back to the default.
  - _Userscript_ (FR3.2): commands in the userscript manager's menu
    (Tampermonkey/Violentmonkey), remembered in the manager's own storage. A
    "show" command there brings back a control hidden with ×.
- **FR10.4 Defaults**: placement bottom-right everywhere. Visibility: _until the
  user zooms_ for the extension (it always has its toolbar/menu button as well);
  _always_ for the script tag and the userscript, where the on-page control is
  the only way in.
