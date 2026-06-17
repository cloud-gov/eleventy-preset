import assert from "node:assert/strict";
import test from "node:test";
import { Liquid } from "liquidjs";
import markdownIt from "markdown-it";
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

  return {
    liquidTags,
    addLiquidTag(name, callback) {
      liquidTags[name] = callback;
    },
    addLiquidShortcode() {},
    addShortcode() {},
  };
}

function createRecordingEleventyConfig() {
  const registrations = {
    liquidTag: {},
    liquidShortcode: {},
    shortcode: {},
  };

  return {
    registrations,
    addLiquidTag(name, callback) {
      registrations.liquidTag[name] = callback;
    },
    addLiquidShortcode(name, callback) {
      registrations.liquidShortcode[name] = callback;
    },
    addShortcode(name, callback) {
      registrations.shortcode[name] = callback;
    },
  };
}

function registerWithRecording(overrides = {}) {
  const eleventyConfig = createRecordingEleventyConfig();

  registerShortcodes(
    eleventyConfig,
    {
      features: { imageShortcodes: true, ...overrides.features },
      imageShortcodes: { includeCaption: true, ...overrides.imageShortcodes },
    },
    {
      liquidEngine: new Liquid(),
      markdownLibrary: createMarkdownLibrary(),
      ...overrides.context,
    },
  );

  return eleventyConfig.registrations;
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

  const accordionHtml = await replacementLiquidEngine.parseAndRender(`
{% uswds_accordion bordered=true allow_multiple=false %}
items:
  - title: First
    content: |-
      **Accordion body**
{% enduswds_accordion %}`);

  const cardGroupHtml = await replacementLiquidEngine.parseAndRender(`
{% uswds_card_group %}
cards:
  - heading: Card heading
    content: |-
      **Card body**
{% enduswds_card_group %}`);

  assert.match(accordionHtml, /usa-accordion--bordered/);
  assert.match(accordionHtml, /<strong>Accordion body<\/strong>/);
  assert.match(cardGroupHtml, /usa-card__heading/);
  assert.match(cardGroupHtml, /<strong>Card body<\/strong>/);
});

test("registers the USWDS paired Liquid tags", () => {
  const registrations = registerWithRecording();

  assert.ok(
    registrations.liquidTag.uswds_accordion,
    "uswds_accordion should be registered as a Liquid tag",
  );
  assert.ok(
    registrations.liquidTag.uswds_card_group,
    "uswds_card_group should be registered as a Liquid tag",
  );
});

test("registers the uswds_icon and youtube shortcodes", () => {
  const registrations = registerWithRecording();

  assert.equal(
    typeof registrations.liquidShortcode.uswds_icon,
    "function",
    "uswds_icon should be registered as a Liquid shortcode",
  );
  assert.equal(
    typeof registrations.shortcode.youtube,
    "function",
    "youtube should be registered as a shortcode",
  );
});

test("registers image shortcodes as async callbacks when enabled", () => {
  const registrations = registerWithRecording();

  for (const name of ["image", "image_with_class", "image_with_caption"]) {
    const callback = registrations.liquidShortcode[name];
    assert.equal(
      typeof callback,
      "function",
      `${name} should be registered as a Liquid shortcode`,
    );
    assert.equal(
      callback.constructor.name,
      "AsyncFunction",
      `${name} should be registered as an async callback`,
    );
  }
});

test("omits image_with_caption when includeCaption is disabled", () => {
  const registrations = registerWithRecording({
    imageShortcodes: { includeCaption: false },
  });

  assert.ok(registrations.liquidShortcode.image);
  assert.ok(registrations.liquidShortcode.image_with_class);
  assert.equal(registrations.liquidShortcode.image_with_caption, undefined);
});

test("omits all image shortcodes when the feature is disabled", () => {
  const registrations = registerWithRecording({
    features: { imageShortcodes: false },
  });

  assert.equal(registrations.liquidShortcode.image, undefined);
  assert.equal(registrations.liquidShortcode.image_with_class, undefined);
  assert.equal(registrations.liquidShortcode.image_with_caption, undefined);
});

test("throws when a raw Liquid tag cannot be registered through any API", () => {
  const eleventyConfig = {
    addLiquidShortcode() {},
    addShortcode() {},
  };

  assert.throws(
    () =>
      registerShortcodes(
        eleventyConfig,
        {
          features: { imageShortcodes: false },
          imageShortcodes: {},
        },
        { markdownLibrary: createMarkdownLibrary() },
      ),
    /Unable to register Liquid tag "uswds_accordion"/,
  );
});
