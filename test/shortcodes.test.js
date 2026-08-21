import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Eleventy from "@11ty/eleventy";
import { Liquid } from "liquidjs";
import markdownIt from "markdown-it";
import studioEleventyPreset from "../src/index.js";
import { registerShortcodes } from "../src/shortcodes.js";

function createMarkdownLibrary() {
  return markdownIt({
    html: false,
    breaks: false,
    linkify: true,
    typographer: false,
  });
}

function createEleventyConfig() {
  const liquidTags = {};
  const shortcodes = {};

  return {
    liquidTags,
    shortcodes,
    addLiquidTag(name, callback) {
      liquidTags[name] = callback;
    },
    addLiquidShortcode() {},
    addShortcode(name, callback) {
      shortcodes[name] = callback;
    },
  };
}

function registerYouTubeShortcode() {
  const eleventyConfig = createEleventyConfig();

  registerShortcodes(eleventyConfig, {
    features: { imageShortcodes: false },
    imageShortcodes: {},
  });

  return eleventyConfig.shortcodes.youtube;
}

function getSrcdoc(html) {
  const match = html.match(/\ssrcdoc="([^"]*)"/);

  assert.ok(match, "expected the iframe to include a srcdoc attribute");

  return match[1]
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function applyLiquidTags(liquidEngine, liquidTags) {
  for (const [name, callback] of Object.entries(liquidTags)) {
    liquidEngine.registerTag(name, callback(liquidEngine));
  }
}

test("USWDS raw Liquid tags are registered through Eleventy's persistent tag registry", async () => {
  const initialLiquidEngine = new Liquid();
  const replacementLiquidEngine = new Liquid();
  const eleventyConfig = createEleventyConfig();

  registerShortcodes(
    eleventyConfig,
    {
      features: { imageShortcodes: false },
      imageShortcodes: {},
    },
    {
      liquidEngine: initialLiquidEngine,
      markdownLibrary: createMarkdownLibrary(),
    },
  );

  applyLiquidTags(replacementLiquidEngine, eleventyConfig.liquidTags);
  replacementLiquidEngine.registerTag("replacement_notice", {
    render() {
      return "Replacement engine content";
    },
  });

  const accordionHtml = await replacementLiquidEngine.parseAndRender(`
{% uswds_accordion bordered=true allow_multiple=false %}
items:
  - title: First
    content: |-
      **{% replacement_notice %}**
{% enduswds_accordion %}`);

  const cardGroupHtml = await replacementLiquidEngine.parseAndRender(`
{% uswds_card_group %}
cards:
  - heading: Card heading
    content: |-
      **Card body**
{% enduswds_card_group %}`);

  const summaryBoxHtml = await replacementLiquidEngine.parseAndRender(`
{% uswds_summary_box heading_level=3 %}
heading: Summary heading
content: |-
  **Summary body**
{% enduswds_summary_box %}`);

  assert.match(accordionHtml, /usa-accordion--bordered/);
  assert.match(accordionHtml, /<strong>Replacement engine content<\/strong>/);
  assert.match(cardGroupHtml, /usa-card__heading/);
  assert.match(cardGroupHtml, /<strong>Card body<\/strong>/);
  assert.match(summaryBoxHtml, /<h3 class="usa-summary-box__heading"/);
  assert.match(summaryBoxHtml, /<strong>Summary body<\/strong>/);
});

test("YouTube shortcode preserves watch and youtu.be URL support", () => {
  const youtube = registerYouTubeShortcode();

  for (const videoUrl of [
    "https://www.youtube.com/watch?v=8WsgIyLFqgM",
    "https://youtube.com/watch?v=8WsgIyLFqgM&feature=shared",
    "https://youtu.be/8WsgIyLFqgM?feature=shared",
  ]) {
    const html = youtube(videoUrl, "Fraud Reporting FAQ");

    assert.match(
      html,
      /<iframe class="yt-shortcode" src="https:\/\/www\.youtube\.com\/embed\/8WsgIyLFqgM"/,
    );
    assert.match(
      getSrcdoc(html),
      /href="https:\/\/www\.youtube\.com\/embed\/8WsgIyLFqgM\?autoplay=1"/,
    );
  }
});

test("YouTube shortcode escapes titles and every generated attribute boundary", () => {
  const youtube = registerYouTubeShortcode();
  const html = youtube(
    "https://www.youtube.com/watch?v=8WsgIyLFqgM",
    'A & B </title><script>alert("unsafe")</script>',
  );
  const srcdoc = getSrcdoc(html);

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(
    html,
    /title="YouTube video player for A &amp; B &lt;\/title&gt;&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;"/,
  );
  assert.match(
    srcdoc,
    /<title>A &amp; B &lt;\/title&gt;&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;<\/title>/,
  );
  assert.match(
    srcdoc,
    /<span>Play video: A &amp; B &lt;\/title&gt;&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;<\/span>/,
  );
  assert.match(
    srcdoc,
    /<img src="https:\/\/i\.ytimg\.com\/vi\/8WsgIyLFqgM\/hqdefault\.jpg" alt="">/,
  );
});

test("YouTube shortcode supplies useful default names when the title is omitted", () => {
  const youtube = registerYouTubeShortcode();
  const html = youtube("https://youtu.be/8WsgIyLFqgM");
  const srcdoc = getSrcdoc(html);

  assert.match(html, /title="YouTube video player"/);
  assert.match(srcdoc, /<title>YouTube video<\/title>/);
  assert.match(srcdoc, /<span>Play video: YouTube video<\/span>/);
});

test("YouTube shortcode rejects malformed URLs and missing or malformed video IDs", () => {
  const youtube = registerYouTubeShortcode();

  for (const videoUrl of [
    undefined,
    "not a URL",
    "https://www.youtube.com/watch?feature=shared",
    "https://youtu.be/",
    "https://youtu.be/too-short",
    "https://youtu.be/8WsgIyLFqgM/extra",
  ]) {
    assert.throws(
      () => youtube(videoUrl, "Invalid video"),
      /Unable to parse YouTube video id from/,
    );
  }
});

test("YouTube shortcode keeps stable responsive iframe output and permissions", () => {
  const youtube = registerYouTubeShortcode();
  const html = youtube(
    "https://www.youtube.com/watch?v=8WsgIyLFqgM",
    "Fraud Reporting FAQ",
  );

  assert.match(html, /^\n<iframe class="yt-shortcode"/);
  assert.match(html, / frameborder="0"/);
  assert.match(html, / loading="lazy"/);
  assert.match(
    html,
    / allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/,
  );
  assert.match(html, / allowfullscreen><\/iframe>\n$/);
  assert.doesNotMatch(html, /\s(?:width|height|style)=/);
});

test("YouTube facade uses a visibly named native link without redundant ARIA", () => {
  const youtube = registerYouTubeShortcode();
  const html = youtube(
    "https://www.youtube.com/watch?v=8WsgIyLFqgM",
    "Fraud Reporting FAQ",
  );
  const srcdoc = getSrcdoc(html);

  assert.match(
    srcdoc,
    /<a href="https:\/\/www\.youtube\.com\/embed\/8WsgIyLFqgM\?autoplay=1">/,
  );
  assert.match(srcdoc, /<span>Play video: Fraud Reporting FAQ<\/span>/);
  assert.doesNotMatch(html, /\saria-/);
  assert.doesNotMatch(srcdoc, /\saria-|\srole=/);
});

test("Eleventy renders the accessible YouTube integration fixture", async () => {
  const fixturePath = fileURLToPath(
    new URL("fixtures/youtube-accessibility.liquid", import.meta.url),
  );
  const outputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-youtube-"),
  );
  const eleventy = new Eleventy(fixturePath, outputDirectory, {
    quietMode: true,
    config: async (eleventyConfig) => {
      await studioEleventyPreset(eleventyConfig, {
        features: {
          collections: false,
          filters: false,
          htmlBase: false,
          imageShortcodes: false,
          imageTransform: false,
          navigation: false,
          passthroughCopy: false,
          rss: false,
          shortcodes: true,
          svgSprites: false,
          watchTargets: false,
          yamlData: false,
        },
      });
    },
  });

  try {
    const [result] = await eleventy.toJSON();
    const srcdoc = getSrcdoc(result.content);

    assert.match(result.content, /<iframe class="yt-shortcode"/);
    assert.match(srcdoc, /<span>Play video: Fraud Reporting FAQ<\/span>/);
    assert.match(
      srcdoc,
      /href="https:\/\/www\.youtube\.com\/embed\/8WsgIyLFqgM\?autoplay=1"/,
    );
    assert.doesNotMatch(result.content, /\saria-/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
