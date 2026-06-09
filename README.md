# @studio/eleventy-preset

Shared Eleventy v3 preset for Studio-managed USWDS 11ty sites. Helps centralizes
the reusable build and configuration layer while site repos keep site metadata,
content, CMS schemas, search indexing, deployment settings, and one-off
collections local.

## Features

- 🧱 Common dependency ownership for USWDS, Decap CMS, and shared Eleventy utilities.
- 🔌 Eleventy plugins for navigation, image transforms, RSS, HTML base URL handling,
  and USWDS sprites.
- 🎨 Asset pipeline for Sass, JavaScript bundling, USWDS font/image copying,
  production minification, autoprefixing, and watch-mode rebuilds.
- 🧩 Shared shortcodes for USWDS icons, YouTube embeds, and optional responsive
  image helpers.
- 📚 Built-in YAML data support and a reusable `postsByYear` collection helper.
- 🚀 Single `studio-eleventy` CLI for build and dev server.

## Creating a New Site

<details>
<summary>Show setup instructions</summary>

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
npm install --save @studio/eleventy-preset@github:cloud-gov/eleventy-preset#v0.3.0
npm install --save-dev @11ty/eleventy
```

The site should not install `@uswds/uswds` or `decap-cms`
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

The preset admin entry automatically registers the shared USWDS Accordion and
USWDS Card Group editor components before `CMS.init()`. Sites using
`@studio/eleventy-preset/admin` do not need custom registration code or
`admin/config.yml` changes for these components.

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

</details>

## Eleventy Preset Options

Most sites can call `await studioPreset(config);` without passing options. When
a site needs to override preset behavior, pass a second argument. This example
shows the public options with their default values.

```js
module.exports = async function (config) {
  const { default: studioPreset } = await import("@studio/eleventy-preset");

  await studioPreset(config, {
    features: {
      htmlBase: true, // false skips Eleventy's HTML base plugin.
      imageShortcodes: false, // true enables image, image_with_class, and image_with_caption.
      imageTransform: true, // false skips @11ty/eleventy-img transforms.
      navigation: true, // false skips @11ty/eleventy-navigation.
      rss: false, // true enables @11ty/eleventy-plugin-rss.
    },

    passthroughCopy: [
      "admin",
      "uploads",
      "favicon.ico",
      "site.webmanifest",
      "img",
    ], // Replace for a different static-file layout.
    watchTargets: ["styles", "js"], // Replace when extra Eleventy watch paths are needed.

    markdown: {
      html: true, // false escapes HTML in Markdown content.
      breaks: false, // true converts single line breaks to <br> tags.
      linkify: true, // false disables automatic links for plain URLs.
      typographer: false, // true enables Markdown It's typographic replacements.
      namedHeadings: true, // false disables markdown-it-named-headings.
      pdfLinksNewWindow: false, // true opens Markdown PDF links in a new window.
      markdownFilterName: "markdownify", // Change to rename the Markdown rendering filter.
    },

    imageTransform: {
      failOnError: false, // true fails the build when image transforms fail.
      widths: ["auto", 600], // Change to generate a different responsive image set.
      htmlOptions: {
        imgAttributes: {
          loading: "lazy", // Change for eager images.
          decoding: "async", // Change when synchronous decoding is required.
        },
        pictureAttributes: {}, // Add attributes for generated <picture> elements.
        fallback: "largest", // Change to use a different transform plugin fallback.
      },
    },

    collections: {
      postsByYear: {
        enabled: true, // false disables this grouped archive collection.
        tag: "press-release", // Change to group a different tagged collection.
        name: "postsByYear", // Change to expose the collection under a different name.
      },
    },

    imageShortcodes: {
      outputDir: "./_site/img/", // Change where shortcode-generated images are written.
      includeCaption: false, // true also enables image_with_caption.
    },
  });
};
```

## Runtime Entry Points

The preset also exposes browser entry modules for USWDS and Decap CMS JavaScript bundles:

- `@studio/eleventy-preset/uswds`
- `@studio/eleventy-preset/uswds-init`
- `@studio/eleventy-preset/admin`

## USWDS Accordion Editor Component

Sites on `@studio/eleventy-preset` v0.3.0 or later get a Decap CMS Markdown
editor component labeled `USWDS Accordion` automatically through:

```js
import CMS from "@studio/eleventy-preset/admin";

CMS.init();
```

After updating to v0.3.0, rebuild the site admin bundle so the preset admin
entry includes the component registration.

Supported fields:

- `bordered`: boolean, default `false`
- `allow_multiple`: boolean, default `false`
- `items`: list of accordion items
- item `title`: string
- item `content`: Markdown
- item `open`: boolean, default `false`

The editor saves a re-editable Liquid paired shortcode block with YAML instead
of generated HTML:

```liquid
{% uswds_accordion bordered=false allow_multiple=false %}
items:
  - title: "First item"
    open: false
    content: |-
      Markdown body.
{% enduswds_accordion %}
```

Item content is rendered as Markdown only. Embedded Liquid tags, Liquid output,
and shortcodes inside item content are preserved as text and are not executed.

## USWDS Card Group Editor Component

Sites using `@studio/eleventy-preset/admin` get a Decap CMS Markdown editor
component labeled `USWDS Card Group` automatically:

```js
import CMS from "@studio/eleventy-preset/admin";

CMS.init();
```

Rebuild the site admin bundle after updating the preset so the preset admin
entry includes the component registration. No site-specific registration code
or `admin/config.yml` change is required.

Supported fields:

- `cards`: list of cards
- card `heading`: optional string
- card `content`: optional Markdown
- card `image.src`: optional image URL or path
- card `image.alt`: optional alt text
- card `button.label`: optional primary button label
- card `button.href`: optional primary button URL or path
- card `link.label`: optional secondary link label
- card `link.href`: optional secondary link URL or path

The editor saves a re-editable Liquid paired shortcode block with readable YAML
instead of generated HTML:

```liquid
{% uswds_card_group %}
cards:
  - heading: "Card heading"
    content: |-
      Markdown body.
    image:
      src: "/uploads/example.jpg"
      alt: "Descriptive alt text"
    button:
      label: "Primary action"
      href: "/example/"
    link:
      label: "Secondary link"
      href: "/example/details/"
{% enduswds_card_group %}
```

New cards start with empty optional fields. Empty fields are omitted from the
saved YAML; an entirely empty card is saved as `{}` and does not add placeholder
heading, body, image, button, or link text.

Card body content is rendered as Markdown only. Embedded Liquid tags, Liquid
output, shortcodes, and raw HTML inside card content are preserved as text and
are not executed.

During Eleventy rendering, missing optional fields omit their USWDS wrappers:
headers render only when a heading exists, media renders only when an image
source exists, body renders only when content exists, and footer renders only
when a button or secondary link exists. Card class controls are not exposed to
editors; every rendered card uses
`class="usa-card tablet:grid-col-6 desktop:grid-col-4"`.
