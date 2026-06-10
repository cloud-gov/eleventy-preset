# AGENTS.md

## Scope

These instructions apply to the entire `cloud-gov/eleventy-preset` repository.

This repository is the shared Eleventy preset for Studio-managed USWDS 11ty sites. Treat it as shared infrastructure. Changes here can affect multiple consuming sites.

## Required Workflow

- Always create a branch before making changes.
- Use a clear branch name, such as `feature/<short-description>`, `fix/<short-description>`, or `docs/<short-description>`.
- Do not commit directly to `main`.
- Keep changes focused. Do not mix unrelated cleanup, formatting, dependency updates, or refactors into feature work.
- Before changing behavior, inspect the existing source, README, package exports, and relevant tests or examples.
- Preserve existing public APIs unless the task explicitly requires a breaking change and the breaking change has been approved.

## Compatibility Requirements

Backward compatibility is mandatory.

Do not introduce breaking changes to:

- Published package entry points.
- Existing exports.
- CLI command names or flags.
- Preset option names or default behavior.
- Feature flag behavior.
- Liquid shortcode names, arguments, or paired shortcode structure.
- Saved Decap CMS editor-component block formats.
- Generated markup expected by consuming sites.
- Default asset output paths.
- Existing Sass, JavaScript, USWDS, or Decap runtime assumptions.

When adding behavior, prefer additive options and feature flags over replacing existing behavior.

If a change could affect consuming sites, document the risk and preserve the old behavior by default.

## JavaScript Standards

- Use plain JavaScript only.
- Do not introduce TypeScript.
- Preserve the package’s ES module style.
- Prefer small, focused modules under `src/`.
- Keep functions explicit and readable.
- Avoid clever abstractions unless they clearly reduce repeated logic.
- Prefer named helper functions for parsing, normalization, escaping, rendering, and registration logic.
- Use Node built-ins with `node:` imports.
- Keep browser/admin code separate from Eleventy/server-side code when practical.

## Dependency Policy

Do not add dependencies unless clearly justified.

A new dependency must have a specific, necessary purpose and must not duplicate existing functionality in the repo.

Before adding a dependency, consider whether the existing stack already covers the need:

- Eleventy
- USWDS
- Decap CMS
- LiquidJS
- markdown-it
- js-yaml
- Luxon
- Sass
- esbuild
- PostCSS/autoprefixer
- chokidar

If a dependency is added, document why it is necessary.

## Testing Requirements

Always run:

```sh
npm test
```

Do not say work is complete unless `npm test` has been run successfully, or unless you explicitly state that you could not run it and explain why.

When touching build, CLI, asset, admin, shortcode, or rendering behavior, also perform the most relevant manual verification possible and document what was checked.

## Preset Boundaries

Keep the preset reusable.

Do not add site-specific content, navigation, CMS collections, search indexing, deployment configuration, analytics, one-off collections, or site metadata to this repository unless the change is intentionally reusable across Studio-managed sites.

The preset may own reusable build, asset, shortcode, CMS runtime, USWDS, Markdown, data-extension, and Eleventy configuration behavior.

Consuming sites should continue to own:

- Site metadata.
- Content.
- Local layouts and includes.
- Local CMS collection schemas.
- Search indexing.
- Deployment settings.
- One-off collections.
- Site-specific data files.
- Site-specific navigation.
- Site-specific custom CMS registrations.

## Eleventy Preset Conventions

Follow the existing registration pattern.

The preset should resolve options first, then register features through focused modules such as:

- collections
- data extensions
- filters
- Liquid
- Markdown
- passthrough copy
- plugins
- shortcodes
- asset handling
- admin/CMS behavior

Use `src/defaults.js` as the source of truth for default options and feature flags.

New optional behavior should be controlled through `features` or another clearly named options object.

Do not make a feature mandatory unless it is already part of the preset’s core contract.

## CLI and Asset Pipeline

Preserve the `studio-eleventy` CLI contract.

Do not rename or remove existing commands:

- `studio-eleventy build`
- `studio-eleventy dev`
- `studio-eleventy assets`

Preserve the existing separation between Studio CLI args and Eleventy args.

Preserve production/development behavior unless the task explicitly requires changing it.

When changing asset behavior, consider Sass, JavaScript bundling, USWDS font/image copying, source maps, minification, autoprefixing, and watch mode.

## Decap CMS Admin Conventions

The preset owns shared Decap CMS runtime behavior.

Shared editor components must be registered by the preset admin entry before `CMS.init()` is called by consuming sites.

Consuming sites using:

```js
import CMS from "@studio/eleventy-preset/admin";

CMS.init();
```

must not need extra registration code or `admin/config.yml` changes for shared preset components.

Do not move shared component registration into consuming sites.

## Shared Editor Component Standards

Shared CMS editor components must save re-editable source content, not generated HTML.

For Markdown editor components that represent USWDS patterns:

- Save readable YAML inside a Liquid paired shortcode block.
- Keep the block stable and re-editable.
- Keep editor fields minimal.
- Do not expose unnecessary USWDS implementation details to editors.
- Preserve existing saved block formats.
- Parse existing blocks defensively.
- Normalize input before rendering.
- Escape user-controlled text and attributes.
- Render Markdown only where intended.
- Do not execute embedded Liquid, shortcodes, or raw HTML inside editor-authored Markdown unless explicitly approved.

Preferred pattern:

```liquid
{% component_name option=false %}
items:
  - title: "Example"
    content: |-
      Markdown body.
{% endcomponent_name %}
```

## USWDS and Accessibility Requirements

Strictly follow USWDS patterns for generated components.

Generated component markup must be semantic, accessible, and Section 508 compliant.

Requirements:

- Use USWDS classes and documented USWDS structure.
- Preserve keyboard accessibility.
- Use semantic HTML.
- Use appropriate ARIA attributes only when needed.
- Ensure buttons, links, headings, lists, images, and regions have correct meaning.
- Require useful alt text fields for meaningful images.
- Allow empty alt text only for decorative images when the component design explicitly supports that.
- Do not create inaccessible custom interactions when USWDS already provides a pattern.
- Do not use inline style hacks for generated components.
- Escape rendered text and attributes.
- Avoid exposing layout controls to editors unless there is a clear reusable need.
- Prefer predictable, consistent heading levels and component structure.

If a generated component cannot be made accessible with the proposed fields or markup, stop and redesign the component rather than shipping inaccessible output.

## Markdown and Rendering Rules

Respect the existing Markdown configuration.

Do not casually change Markdown defaults such as HTML support, linkification, named headings, PDF link behavior, or filter names.

When rendering editor-authored Markdown inside generated components, be explicit about whether HTML should be allowed.

Use escaping helpers for text and attributes.

Normalize unknown, missing, or malformed data before rendering.

Invalid YAML should fail with a useful error message.

## README and Documentation

Update documentation when changing:

- Public options.
- Feature flags.
- CLI behavior.
- Package exports.
- Shortcodes.
- CMS editor components.
- Saved block formats.
- Asset output behavior.
- Required setup for consuming sites.

Documentation must make clear whether behavior belongs in the preset or in consuming sites.

Examples should be minimal, reusable, and consistent with existing README style.

## Versioning

If package behavior changes in a way consumers need to receive, update versioning only when the task explicitly asks for it or when release work is part of the task.

Do not bump versions as incidental cleanup.

When a version bump is requested, update both `package.json` and `package-lock.json`.

## Pull Request Expectations

A good PR should include:

- A focused summary of what changed.
- A compatibility note.
- Testing performed, including `npm test`.
- Any manual verification performed.
- Documentation updates when relevant.
- A clear explanation of any new dependency.
- A clear explanation of any behavior that could affect consuming sites.

## Prohibited Changes Without Explicit Approval

Do not do the following without explicit approval:

- Introduce TypeScript.
- Rename public exports.
- Remove package entry points.
- Rename CLI commands.
- Change default feature behavior.
- Change saved CMS block formats.
- Move site-specific responsibilities into the preset.
- Add site-specific content or config.
- Replace USWDS markup with custom component markup.
- Add dependencies without clear justification.
- Make broad formatting-only changes.
- Reorganize the repo structure without a specific need.
- Introduce breaking changes for consuming sites.
