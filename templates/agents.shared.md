# Shared agent instructions for Studio Eleventy sites

## Scope and working approach

These are the shared standards for sites using `@studio/eleventy-preset`. The combined root `AGENTS.md` also includes `docs/agents.site.md`, which supplies actual paths, commands, content conventions, and explicit exceptions. Local choices supplement these standards; conflicts require clarification, not an assumed blanket override.

- Before changing code, inspect `package.json`, the lockfile, Eleventy configuration, affected layouts/includes, Sass, browser entries, and relevant tests. Confirm the installed preset version and enabled features; older releases may lack capabilities listed below.
- Prefer existing preset functionality, then reusable site includes/helpers, before new dependencies or infrastructure. Explain any necessary addition and why the existing stack cannot meet the need. Do not upgrade dependencies merely to complete unrelated work.
- Prefer static generation and platform capabilities over browser-side JavaScript. Preserve progressive enhancement: core content and navigation should remain usable without JavaScript whenever practical; provide an understandable fallback for JavaScript-dependent search.
- Preserve the site's JavaScript module style, build commands, public URLs, content, and CMS contracts. Keep changes focused; do not overwrite unrelated work or edit generated output, vendored dependencies, or compiled assets.
- Keep site metadata, content, navigation presentation, layouts, CMS schemas, search indexing, deployment settings, analytics, and one-off collections site-owned. Propose broadly reusable missing infrastructure for the preset rather than silently duplicating it across sites.

## Accessibility is a requirement

Prioritize Section 508 accessibility in every request, including content, design, and behavior. Meet applicable Revised Section 508/WCAG 2.0 AA requirements and preserve stronger existing accessibility. USWDS adoption or automated checks alone do not establish compliance.

- Use semantic landmarks, a working skip link, logical heading levels, meaningful links, native buttons for actions, and visible programmatically associated form labels. Preserve unique IDs and correct control relationships; add ARIA only where necessary.
- Preserve keyboard operation, visible focus, sensible focus order, and focus management for dynamic results or dialogs. Announce loading, results, and errors accessibly without redundant announcements; honor reduced-motion preferences.
- Maintain text contrast of at least 4.5:1, or 3:1 for qualifying large text, and distinguish controls and focus indicators. Never communicate meaning through color alone. Check hover, focus, selected, disabled, and error states, not just initial appearance.
- Verify actual foreground/background pairings; token names alone do not prove contrast. Target at least 3:1 for meaningful graphics and user-interface boundaries or states where WCAG 2.1 AA non-text contrast applies, beyond the Section 508 WCAG 2.0 baseline.
- Give meaningful images useful alt text; use `alt=""` for decorative images. Name icon-only controls with visible or screen-reader text. Provide descriptive iframe titles and accessible media alternatives, including captions and transcripts as applicable.
- Verify zoom/reflow, narrow layouts, keyboard interactions, and representative screen-reader behavior. Do not ship a known accessibility regression or claim compliance without adequate verification.

## USWDS design and implementation

USWDS is the design authority: <https://designsystem.digital.gov/>. Before creating or changing a component, consult its official HTML, variants, accessibility guidance, and behavior for the installed USWDS version. Use the exact documented HTML structure, elements, classes, and required attributes—not approximate markup wearing USWDS classes. Adapt content, unique IDs, and contextual heading levels without breaking the documented pattern. If current documentation requires a newer release, identify the mismatch rather than mixing versions.

Use an existing USWDS component when it meets the need. Reuse Eleventy includes for repeated patterns instead of copying markup across templates. Preserve required USWDS JavaScript initialization and interactions. If a preset renderer diverges from official markup or cannot meet contextual accessibility, report the gap and seek a compatible fix; do not silently fork it locally.

Extract genuinely repeated presentation using the site's existing template mechanism. Do not create highly configurable abstractions for one-off content or require editors to author USWDS implementation details that templates can supply safely. Do not replace accessible USWDS behavior for a superficial visual difference.

Customize in this order:

1. **Sass theme settings:** global colors, typography, spacing, and component decisions belong in USWDS `$theme-*` settings. Configure the existing `@use "uswds-core" as * with (...)` before loading USWDS.
2. **USWDS utilities:** use documented grid, responsive, spacing, typography, and color utilities for layout and local treatment. Verify that needed utilities and responsive variants are enabled before inventing replacements.
3. **Minimal custom Sass/CSS:** only when settings and utilities are insufficient. Use USWDS tokens, functions, variables, and mixins such as `color()`, `units()`, and `at-media()`. Scope selectors to the specific pattern; preserve component states and focus treatment. Do not solve styling conflicts by repeatedly increasing selector specificity.

Keep Sass changes in `styles/styles.scss` unless a separate partial is clearly necessary or local guidance identifies the existing equivalent. Source theme values from that configuration, not copied palette tables. Do not use raw colors when a USWDS token exists, broad component overrides without demonstrated necessity, inline styling hacks, or routine `!important`. Document each custom CSS exception beside the rule: why settings/utilities were insufficient and what accessibility behavior must remain intact. Record lasting project-level exceptions in `docs/agents.site.md`.

## Preset capabilities and options

This inventory reflects reviewed preset **0.4.1**. Verify the installed release's README and implementation before using an API. The preset currently requires Node.js 22+ and Eleventy 3.1+. It supplies USWDS, Decap CMS, Markdown/YAML/date utilities, image/navigation/RSS/sprite plugins, and the Sass/esbuild/PostCSS/autoprefixer/watch pipeline. Do not install parallel implementations of these facilities.

### Eleventy configuration

Use `await studioPreset(config, options)` from the default `@studio/eleventy-preset` export. Prefer targeted options over re-registering plugins or replacing libraries.

| Option                                     | Available configuration and defaults                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pathPrefix`, `baseUrlEnvironmentVariable` | Explicit prefix wins; otherwise read `BASEURL` or the named environment variable. Prefixes normalize to a leading slash and no trailing slash, with `/` as the fallback.                                                                                                                                              |
| `features`                                 | Enabled by default: `collections`, `filters`, `htmlBase`, `imageTransform`, `markdown`, `navigation`, `passthroughCopy`, `redirects`, `shortcodes`, `svgSprites`, `watchTargets`, `yamlData`. Opt-in: `imageShortcodes`, `rss`. Each flag accepts a boolean.                                                          |
| `directories.includes`                     | Liquid include lookup directory; defaults to `_includes`, followed by the project root and bundled preset includes. This does not configure all Eleventy directories.                                                                                                                                                 |
| `passthroughCopy`                          | Eleventy passthrough entries/mappings; defaults to `admin`, `uploads`, `favicon.ico`, `site.webmanifest`, `img`. A supplied array replaces the defaults.                                                                                                                                                              |
| `watchTargets`                             | Eleventy watch targets; defaults to `styles`, `js`. A supplied array replaces the defaults.                                                                                                                                                                                                                           |
| `markdown`                                 | `html: true`, `breaks: false`, `linkify: true`, `typographer: false`, `namedHeadings: true`, `pdfLinksNewWindow: false`, `markdownFilterName: "markdownify"`.                                                                                                                                                         |
| `imageTransform`                           | `failOnError: false`, `widths: [600, 1200]`, `responsiveImageClass: "height-auto"`; `htmlOptions.imgAttributes` default to lazy loading and async decoding; `pictureAttributes: {}`, `fallback: "largest"`. Other upstream image-transform options pass through, including formats, extensions, and image attributes. |
| `collections.postsByYear`                  | `enabled: true`, `tag: "press-release"`, `name: "postsByYear"`; produces reverse-ordered posts grouped into `[year, posts]` pairs.                                                                                                                                                                                    |
| `imageShortcodes`                          | `outputDir: "./_site/img/"`, `includeCaption: false`. Requires `features.imageShortcodes: true` and enabled shortcodes.                                                                                                                                                                                               |
| `navigation.contentDirectory`              | Defaults to `content/pages`; controls optional path-derived navigation preprocessing.                                                                                                                                                                                                                                 |
| `redirects.json`                           | Defaults to `true`; controls the generated redirect map independently of redirect documents.                                                                                                                                                                                                                          |

Nested preset options merge with defaults as implemented; replacement arrays are not appended. Do not assume arbitrary deep merging. Liquid registration is unconditional; there is no `features.liquid` flag.

### Templates, content, and runtime

- Use `markdownify` (or the configured name), `htmlDateString` for UTC `yyyy-LL-dd`, YAML `.yaml` data support, and the configured yearly collection instead of equivalent local plumbing.
- Navigation uses the official `eleventyNavigation` and breadcrumb/rendering filters. Where supported, use `studioNavigationEntries` before `eleventyNavigation` for folder-derived keys/parents, plus `studioNavigationIsCurrent` and recursive `studioNavigationHasCurrentDescendant`. Pages opt in with `eleventyNavigation: true` or nonblank metadata. Derived path keys take precedence over explicit keys; explicit parents, titles, URLs, and other metadata survive. Check hierarchy before replacing local helpers.
- Author root-relative internal and asset URLs; let HTML Base apply the configured prefix. Do not add Jekyll `relative_url`, `site.baseurl`, redundant prefix concatenation, or unnecessary Eleventy `url` filters. HTML Base does not rewrite runtime JavaScript strings; verify Pagefind imports, fetches, and dynamically generated URLs under a non-root deployment prefix.
- Use `{% uswds_icon "icon_name" "optional classes" %}` instead of direct `/assets/uswds/img/sprite.svg#...` references. Preserve `{% usa_icons_sprite %}` and `{% uswds_icons_sprite %}` in the base layout. Sprite plugins also expose `usa_icons` and `uswds_icons`; prefer the standard icon wrapper. Its SVG is decorative (`aria-hidden="true"`), so accessible control text is still required.
- Use `{% youtube "watch-or-youtu.be URL" "Descriptive title" %}` for video embeds. Optional image helpers are `image(src, alt)`, `image_with_class(src, classes, alt)`, and `image_with_caption(src, classes, alt, caption)`; the last also requires `includeCaption: true`. They are distinct from the responsive HTML image transform. Treat caption HTML as trusted input, not automatically sanitized text.
- Prefer finite image widths appropriate to the layout. Preserve aspect ratios and existing classes. Use `eleventy:ignore` for generated assets, functional/branding SVGs, or unavailable/remote images that must bypass transformation; respect explicit `eleventy:optional` behavior. A tolerated transform failure is not proof that the authored image URL works.
- Keep migrated `redirect_from` scalar/array aliases and `redirect_to` internal or HTTP(S) destinations. Alias trailing slashes affect output paths. The preset validates collisions/unsafe paths and generates redirect documents plus optional `redirects.json`; it preserves site-owned maps and does not use a local redirect layout.
- Runtime entries are `/uswds`, `/uswds-init`, and `/admin` under `@studio/eleventy-preset`. Import shared CMS runtime before site registrations and `CMS.init()`; do not register shared components again. Bundled Liquid includes include `preset/banner.html`; verify its markup against current official guidance before adoption.

### Shared CMS component contracts

Use installed preset shortcodes/editor components before building local equivalents. Preserve re-editable YAML blocks and canonical Prettier ignore ranges, including blank lines inside the markers.

- `uswds_accordion`: `bordered: false`, `allow_multiple: false`, and `items` with `title`, Markdown `content`, and `open: false`. Only parsed item content executes Liquid/shortcodes before Markdown rendering; use trusted content and `raw` for literal Liquid. Browser previews do not execute server-side Liquid.
- `uswds_card_group`: `classes` defaults to `tablet:grid-col-6 desktop:grid-col-4`; `cards` support optional `heading`, Markdown `content`, `image.src/alt`, `button.label/href`, and `link.label/href`. Nonempty classes replace default widths; `usa-card` remains. Empty optional fields omit wrappers.
- `uswds_summary_box`: `heading` defaults to `Key information`, `heading_level` accepts 2–6 (default 2), and `content` is Markdown. Card and summary bodies do not execute Liquid or raw HTML.

Verify rendered headings in context: reviewed accordion/card renderers use fixed `h4` headings. Do not assume preset output guarantees an appropriate heading hierarchy. Keep local CMS schemas aligned with actual front matter and templates; preserve field names, optional values, saved formats, and content trust boundaries. Escape dynamic text/attributes and validate URLs before inserting HTML.

### CLI and separate asset options

Reuse `studio-eleventy build`, `dev`, and `assets`. `build` defaults to production; `dev` watches development assets. Both clean output before building. `--config ./asset.config.js` selects **asset configuration**, not Eleventy configuration; pass Eleventy arguments after `--`. `assets` also supports `--watch` and `--skip-initial`.

Asset options are separate from `studioPreset(config, options)`:

| Option                                      | Available configuration and defaults                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`, `outputDir`, `production`           | Working directory, `_site/assets`, and whether `ELEVENTY_ENV` is `production`; CLI build/dev set production behavior.                                                                                                      |
| `javascript`                                | `entryPoints`: `app: "js/app.js"`, `admin: "js/admin.js"`, `uswds-init: "js/uswds-init.js"`; `outdir: "js"`, `format: "iife"`, `target: ["es2020"]`. Custom entries replace the entry map.                                 |
| `sass`                                      | `entryPoint: "styles/styles.scss"`, `outdir: "styles"`, `filename: "styles.css"`, `quietDeps: true`, `silenceDeprecations: ["import", "global-builtin", "if-function"]`; optional `loadPaths` extend supplied USWDS paths. |
| `uswds`                                     | `copyAssets: true`, `fontsOutdir: "uswds/fonts"`, `imgOutdir: "uswds/img"`.                                                                                                                                                |
| `watch`, `watchOptions`, `skipInitialBuild` | Asset watch paths default to `styles`, `js`; watcher options default to `usePolling: true`, `interval: 250`. `skipInitialBuild` controls the watch helper's initial build.                                                 |

The root export also provides `buildAll`, `buildJavaScript`, `buildSass`, `copyUswdsAssets`, and `watchAssets`. Production builds minify/compress and autoprefix CSS; development builds provide source maps. Align asset output with actual Eleventy output and Sass font/image paths; forwarding `--output` alone does not relocate asset output.

## Pagefind search, filtering, and sorting

Use Pagefind (<https://pagefind.app/>) for advanced keyword search, faceting, filtering, and sorting. It is currently **site-owned, not a preset feature**. Reuse the site's existing indexer, collection layout, adapter, and result partials; do not create a separate implementation for each collection. For new integrations, prefer documented public APIs and version-compatible UI; Component UI requires Pagefind 1.5+. Do not copy private/internal API overrides without necessity and regression coverage.

- Index rendered output after Eleventy finishes, using the actual output directory. Check indexing/write errors and release programmatic resources. Rebuild the index when indexed content changes; never edit generated `pagefind` files.
- Put `data-pagefind-body`, metadata, filters, sort values, and ignore attributes in reusable item layouts, not every content entry. Keep filter keys and collection values consistent with the UI. Site `pagefind.*` front matter is a local layout contract, not preset configuration.
- Give independent interfaces unique instances. Scope collection results with an invariant collection filter; clearing facets must not clear that boundary. Use machine-readable dates for sorting and human-readable dates for display.
- Apply configured sorting to empty-query browse views; preserve relevance ordering for keyword queries unless explicit requirements say otherwise. Ensure keyword-enabled collections actually index intended body text; an input does not override `data-pagefind-ignore`.
- Let the Pagefind integration own result pagination; do not simultaneously paginate that result set with Eleventy. Use official USWDS markup for controls, results, and pagination, with labels, accessible status/error states, keyboard operation, and appropriate focus management. Avoid competing Pagefind/USWDS styling; preserve the site's approved adapter strategy.

## Verification and local guidance

Run the site's documented build and relevant tests/format checks; do not invent scripts. For template, style, or interaction changes, inspect rendered HTML and browser behavior as well as source. Check official USWDS markup, accessibility, assets/links, root and prefixed deployments, and affected CMS previews/round trips. For search, test initial results, keywords, combined facets, clearing, ordering, pagination, empty/error states, and one item's generated index attributes.

Verify that templates and interfaces remain usable with missing optional fields, empty collections, and unavailable JavaScript, including appropriate fallbacks for JavaScript-dependent features. A successful build alone does not establish this resilience.

Report checks run, failures or unavailable checks, accessibility considerations, and necessary exceptions. Distinguish existing failures from regressions; never claim an unrun check passed.

Keep `docs/agents.site.md` concise: actual configuration/style/content paths, commands, deployment prefixes, local CMS/search contracts, and approved exceptions. Do not repeat shared rules or copy complete palettes. Exclude instruction Markdown from Eleventy input where needed. When guidance generation is adopted, edit maintained shared/local sources and regenerate root `AGENTS.md`, rather than hand-editing generated output.
