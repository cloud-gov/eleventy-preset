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
  assert.match(
    accordionHtml,
    /<strong>Replacement engine content<\/strong>/,
  );
  assert.match(cardGroupHtml, /usa-card__heading/);
  assert.match(cardGroupHtml, /<strong>Card body<\/strong>/);
  assert.match(summaryBoxHtml, /<h3 class="usa-summary-box__heading"/);
  assert.match(summaryBoxHtml, /<strong>Summary body<\/strong>/);
});
