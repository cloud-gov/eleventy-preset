# @studio/eleventy-preset

Shared Eleventy v3 preset for Studio-managed USWDS 11ty sites. It centralizes
the reusable build and configuration layer while site repos keep site metadata,
content, CMS schemas, search indexing, deployment settings, and one-off
collections local.

## Features

🧱 Common dependency ownership for USWDS, Decap CMS, Sass, esbuild, PostCSS,
markdown-it, and shared Eleventy utilities.
🔌 Preset-managed Eleventy plugins for navigation, image transforms, optional
RSS/render support, HTML base URL handling, and USWDS SVG sprites.
🎨 Asset pipeline for Sass, JavaScript bundling, USWDS font/image copying,
production minification, autoprefixing, and watch-mode rebuilds.
🧩 Shared shortcodes for USWDS icons, YouTube embeds, and optional responsive
image helpers.
📚 Built-in YAML data support and a reusable `postsByYear` collection helper.
🚀 Single `studio-eleventy` CLI for build, dev server, and asset-only tasks.

## Creating a New Site

These steps create a small Eleventy site that uses the preset for Eleventy
configuration, USWDS assets, Sass and JavaScript builds, shared shortcodes, and
Decap CMS runtime ownership.

### 1. Create the Site Folder

```sh
mkdir new-site
cd new-site
npm init -y
```

### 2. Install the Site Dependencies

Install the preset from the tagged GitHub release:

```sh
npm install --save @studio/eleventy-preset@github:cloud-gov/eleventy-preset#v0.1.0
npm install --save-dev @11ty/eleventy
```

The site should not install `@uswds/uswds` or `decap-cms-app`
directly unless it has a proven site-specific direct import. The preset owns
those runtime packages.

### 3. Add Package Scripts

Add scripts like these to the site's `package.json`:

```json
{
  "scripts": {
    "build": "studio-eleventy build",
    "dev": "studio-eleventy dev",
    "pages": "studio-eleventy build"
  }
}
```

`npm run dev` is the local development command. The deployed Pages build should
run `npm run pages`, which runs the same preset-owned production build.

### 4. Add Eleventy Configuration

Create `.eleventy.js`:

```js
module.exports = async function (config) {
  const { default: studioPreset } = await import("@studio/eleventy-preset");

  await studioPreset(config, {
    // Example: enable optional Eleventy RSS support.
    // features: { rss: true },
    // Example: override the default passthrough copy list.
    // passthroughCopy: ["admin", "favicon.ico", "img"],
    // Example: disable the default posts-by-year collection helper.
    // collections: { postsByYear: { enabled: false } },
  });
};
```

### 5. Add the Minimum File Structure

Create these folders and files:

```text
_data/site.yaml
_includes/layouts/base.html
admin/index.html
index.md
js/admin.js
js/app.js
js/uswds-init.js
styles/styles.scss
```

### 6. Add Site Data

Create `_data/site.yaml`:

```yaml
title: New Site
description: A new Eleventy and USWDS site.
```

Site metadata stays local to the site. Add navigation, contact data, CMS
settings, and content-specific data here or in other local `_data` files.

### 7. Add a Base Layout

Create `_includes/layouts/base.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ title | default: site.title }}</title>
    <link rel="stylesheet" href="{{ '/assets/styles/styles.css' | url }}" />
    <script src="{{ '/assets/js/uswds-init.js' | url }}"></script>
  </head>
  <body>
    <a class="usa-skipnav" href="#main-content">Skip to main content</a>
    <main id="main-content" class="grid-container usa-section">
      {{ content }}
    </main>
    <div style="display: none">
      {% usa_icons_sprite %} {% uswds_icons_sprite %}
    </div>
    <script src="{{ '/assets/js/app.js' | url }}"></script>
  </body>
</html>
```

### 8. Add a Home Page

Create `index.md`:

```md
---
layout: layouts/base.html
title: New Site
---

# New Site

This site is using Eleventy, USWDS, and `@studio/eleventy-preset`.
```

### 9. Add JavaScript Entry Points

Create `js/app.js`:

```js
require("@studio/eleventy-preset/uswds");
```

Create `js/uswds-init.js`:

```js
require("@studio/eleventy-preset/uswds-init");
```

Create `js/admin.js`:

```js
import CMS from "@studio/eleventy-preset/admin";

CMS.init();
```

### 10. Add Admin HTML

Create `admin/index.html` if the site will use Decap CMS:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Content Manager</title>
  </head>
  <body>
    <script src="/assets/js/admin.js"></script>
  </body>
</html>
```

Keep `admin/config.yml`, collections, media folders, editorial workflow
settings, and custom CMS registrations local to the site.

### 11. Add Sass

Create `styles/styles.scss`:

```scss
@use "uswds-core" as * with (
  $theme-show-compile-warnings: false,
  $theme-show-notifications: false,
  $theme-font-path: "../uswds/fonts",
  $theme-image-path: "../uswds/img"
);

@forward "uswds";
```

The preset automatically adds the preset-owned USWDS Sass load paths and copies
USWDS fonts and images to `/assets/uswds/...`.

### 12. Build the Site

Run:

```sh
npm run build
```

Expected output includes:

```text
_site/assets/js/app.js
_site/assets/js/admin.js
_site/assets/js/uswds-init.js
_site/assets/styles/styles.css
_site/assets/uswds/fonts/
_site/assets/uswds/img/
```

Use `npm run dev` for local development.

## Eleventy Preset Options

Every option is optional. Nested option objects are merged with the defaults
unless noted otherwise.

### Top-Level Options

- `pathPrefix`
  - Default: `undefined`, then resolved from the configured environment variable, then normalized to `/`.
  - Sets the base href used by Eleventy's HTML base plugin.
  - The `studio-eleventy` CLI also passes Eleventy's `--pathprefix` from `BASEURL` when the environment variable is set, so site configs usually do not need to return `pathPrefix`.
  - Values are normalized to start with `/` and not end with `/`, except `/` itself.

- `baseUrlEnvironmentVariable`
  - Default: `"BASEURL"`.
  - Names the environment variable used as the fallback path prefix when `pathPrefix` is not provided.

- `features`
  - Default: see the feature list below.
  - Enables or disables groups of preset behavior.

- `passthroughCopy`
  - Default: `["admin", "uploads", "favicon.ico", "site.webmanifest", "img"]`.
  - Replaces the full list of paths passed to `eleventyConfig.addPassthroughCopy`.
  - Set this to a site-specific array when a site has a different static-file layout.

- `watchTargets`
  - Default: `["styles", "js"]`.
  - Replaces the full list of paths passed to `eleventyConfig.addWatchTarget`.

- `markdown`
  - Default: see the Markdown options below.
  - Configures the shared Markdown library and Markdown rendering filter.

- `imageTransform`
  - Default: see the image transform options below.
  - Passed to `@11ty/eleventy-img`'s image transform plugin when `features.imageTransform` is enabled.

- `collections`
  - Default: see the collection options below.
  - Configures the shared collection helpers.

- `imageShortcodes`
  - Default: see the image shortcode options below.
  - Configures optional image shortcodes when `features.imageShortcodes` is enabled.

### Feature Flags

Feature flags live under `features`.

- `collections`
  - Default: `true`.
  - Registers shared collection helpers, currently `postsByYear`.

- `filters`
  - Default: `true`.
  - Registers shared filters: `htmlDateString`.

- `htmlBase`
  - Default: `true`.
  - Registers Eleventy's HTML base plugin with `baseHref` set to `pathPrefix`.

- `imageShortcodes`
  - Default: `false`.
  - Enables the optional `image`, `image_with_class`, and optionally `image_with_caption` Liquid shortcodes.

- `imageTransform`
  - Default: `true`.
  - Registers `@11ty/eleventy-img`'s image transform plugin.

- `markdown`
  - Default: `true`.
  - Registers the shared Markdown library and Markdown rendering filter.

- `navigation`
  - Default: `true`.
  - Registers `@11ty/eleventy-navigation`.

- `passthroughCopy`
  - Default: `true`.
  - Enables copying the paths listed in `passthroughCopy`.

- `renderPlugin`
  - Default: `false`.
  - Registers Eleventy's render plugin when a site needs render shortcodes or render helpers.

- `rss`
  - Default: `false`.
  - Registers `@11ty/eleventy-plugin-rss`.

- `shortcodes`
  - Default: `true`.
  - Registers shared shortcodes, including `uswds_icon` and `youtube`.

- `svgSprites`
  - Default: `true`.
  - Registers USWDS SVG sprite shortcodes from the preset-owned USWDS package:
    `usa_icons_sprite`, `usa_icons`, `uswds_icons_sprite`, and `uswds_icons`.

- `watchTargets`
  - Default: `true`.
  - Enables watching the paths listed in `watchTargets`.

- `yamlData`
  - Default: `true`.
  - Registers `.yaml` data file support using `js-yaml`.

### Markdown Options

Markdown options live under `markdown`.

- `html`
  - Default: `true`.
  - Allows HTML inside Markdown content.

- `breaks`
  - Default: `false`.
  - Converts single line breaks in Markdown to `<br>` tags.

- `linkify`
  - Default: `true`.
  - Converts plain URLs into links.

- `typographer`
  - Default: `false`.
  - Enables Markdown It's typographic replacements.

- `namedHeadings`
  - Default: `true`.
  - Enables `markdown-it-named-headings`.

- `pdfLinksNewWindow`
  - Default: `false`.
  - Adds `target="_blank"` to Markdown links whose URL ends with `pdf`.

- `markdownFilterName`
  - Default: `"markdownify"`.
  - Names the Markdown rendering filter added by the preset.
  - If this is set to another name, the preset still also registers `markdownify`.

### Image Transform Options

Image transform options live under `imageTransform`.

- `failOnError`
  - Default: `false`.
  - Passed through to `@11ty/eleventy-img`'s transform plugin.

- `widths`
  - Default: `["auto", 600]`.
  - Sets the generated image widths for the transform plugin.

- `htmlOptions.imgAttributes.loading`
  - Default: `"lazy"`.
  - Sets the generated image loading attribute.

- `htmlOptions.imgAttributes.decoding`
  - Default: `"async"`.
  - Sets the generated image decoding attribute.

- `htmlOptions.pictureAttributes`
  - Default: `{}`.
  - Sets attributes for generated `<picture>` elements.

- `htmlOptions.fallback`
  - Default: `"largest"`.
  - Selects the fallback image behavior used by the transform plugin.

Other `imageTransform` options are passed through to the underlying image
transform plugin.

### Collection Options

Collection options live under `collections`.

- `collections.postsByYear.enabled`
  - Default: `true`.
  - Enables a grouped archive collection.

- `collections.postsByYear.tag`
  - Default: `"press-release"`.
  - Selects the tag used to find posts for the archive collection.

- `collections.postsByYear.name`
  - Default: `"postsByYear"`.
  - Names the generated collection.
  - The collection returns `[year, posts]` pairs, newest source posts first.

### Image Shortcode Options

Image shortcode options live under `imageShortcodes`. These only matter when
`features.imageShortcodes` is `true`.

- `outputDir`
  - Default: `"./_site/img/"`.
  - Sets the output directory used by the shortcode-generated images.

- `includeCaption`
  - Default: `false`.
  - Enables the `image_with_caption` shortcode.
  - Without this option, only `image` and `image_with_class` are registered.

## Asset Builder Options

The `studio-eleventy assets` command uses the defaults below. To override them,
create a JavaScript config file and pass it with `--config`:

```js
export default {
  outputDir: "_site/assets",
  javascript: {
    entryPoints: {
      app: "js/app.js",
    },
  },
};
```

```sh
studio-eleventy assets --config ./asset.config.js
```

The config file may export either `default` or `assetOptions`.

The `build` and `dev` commands run asset processing automatically and accept the
same asset config flag:

```sh
studio-eleventy build --config ./asset.config.js
studio-eleventy dev --config ./asset.config.js
```

Pass extra Eleventy arguments after `--`:

```sh
studio-eleventy dev -- --incremental
```

### Top-Level Asset Options

- `root`
  - Default: `process.cwd()`.
  - Base directory used to resolve relative input paths.

- `outputDir`
  - Default: `"_site/assets"`.
  - Base output directory for built assets.

- `production`
  - Default: `process.env.ELEVENTY_ENV === "production"`.
  - Enables minified JavaScript, compressed Sass output, and production CSS autoprefixing.

- `watch`
  - Default: `["styles", "js"]`.
  - Directories watched by `studio-eleventy assets --watch`.

- `watchOptions`
  - Default: `{ usePolling: true, interval: 250 }`.
  - Chokidar options used by the asset watcher.
  - Polling is the default because it avoids local `fs.watch` file-handle limits on macOS.

- `skipInitialBuild`
  - Default: not set.
  - Only used with `--watch`; `--skip-initial` starts watching without first running a full build.

### JavaScript Asset Options

JavaScript options live under `javascript`.

- `entryPoints`
  - Default:
    ```js
    {
      app: "js/app.js",
      admin: "js/admin.js",
      "uswds-init": "js/uswds-init.js"
    }
    ```
  - Maps output names to source entry files.
  - With the default `outdir`, these become `/assets/js/app.js`, `/assets/js/admin.js`, and `/assets/js/uswds-init.js`.
  - This object replaces the default entry point object when provided.

- `outdir`
  - Default: `"js"`.
  - Subdirectory under `outputDir` for JavaScript output.

- `format`
  - Default: `"iife"`.
  - esbuild output format.

- `target`
  - Default: `["es2020"]`.
  - esbuild browser target list.

### Sass Asset Options

Sass options live under `sass`.

- `entryPoint`
  - Default: `"styles/styles.scss"`.
  - Main Sass file to compile.

- `outdir`
  - Default: `"styles"`.
  - Subdirectory under `outputDir` for CSS output.

- `filename`
  - Default: `"styles.css"`.
  - Output CSS filename.

- `quietDeps`
  - Default: `true`.
  - Passed to Sass to quiet dependency warnings.

- `silenceDeprecations`
  - Default: `["import", "global-builtin", "if-function"]`.
  - Sass deprecation warnings to silence.

- `loadPaths`
  - Default: not set.
  - Additional Sass load paths, resolved from `root`.
  - The preset always adds the preset-owned USWDS package paths.

### USWDS Asset Options

USWDS asset options live under `uswds`.

- `copyAssets`
  - Default: `true`.
  - Copies USWDS fonts and images from the preset-owned USWDS package.

- `fontsOutdir`
  - Default: `"uswds/fonts"`.
  - Output subdirectory for USWDS fonts.

- `imgOutdir`
  - Default: `"uswds/img"`.
  - Output subdirectory for USWDS images.

## Runtime Entry Points

The preset also exposes browser entry modules for site JavaScript bundles:

- `@studio/eleventy-preset/uswds`
  - Imports the preset-owned USWDS JavaScript runtime.

- `@studio/eleventy-preset/uswds-init`
  - Adds the USWDS loading class and removes it when USWDS is ready or after the fallback timeout.

- `@studio/eleventy-preset/admin`
  - Exports the preset-owned Decap CMS app object. Site admin bundles should call `CMS.init()` after any custom CMS registrations.
