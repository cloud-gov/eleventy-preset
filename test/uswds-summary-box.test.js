import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Liquid } from "liquidjs";
import markdownIt from "markdown-it";
import { registerUswdsSummaryBoxEditorComponent } from "../src/admin/uswds-summary-box-editor-component.js";
import { registerShortcodes } from "../src/shortcodes.js";
import {
  buildSummaryBoxBlock,
  dumpSummaryBoxYaml,
  normalizeSummaryBoxHeadingLevel,
  parseSummaryBoxBlock,
  parseSummaryBoxYaml,
  renderUswdsSummaryBox,
  USWDS_SUMMARY_BOX_PATTERN,
} from "../src/uswds-summary-box.js";

function createMarkdownLibrary(options = {}) {
  return markdownIt({
    html: options.html ?? true,
    breaks: false,
    linkify: true,
    typographer: false,
  });
}

test("Decap summary box component registers with re-editable fields and defaults", () => {
  let component;
  const CMS = {
    registerEditorComponent(value) {
      component = value;
    },
  };

  registerUswdsSummaryBoxEditorComponent(CMS);

  assert.equal(component.id, "uswds-summary-box");
  assert.equal(component.label, "USWDS Summary Box");

  const headingField = component.fields.find(
    (field) => field.name === "heading",
  );
  const headingLevelField = component.fields.find(
    (field) => field.name === "heading_level",
  );
  const contentField = component.fields.find(
    (field) => field.name === "content",
  );

  assert.equal(headingField.default, "Key information");
  assert.equal(headingLevelField.widget, "select");
  assert.deepEqual(
    headingLevelField.options.map((option) => option.value),
    [2, 3, 4, 5, 6],
  );
  assert.equal(headingLevelField.default, 2);
  assert.equal(contentField.widget, "markdown");
  assert.deepEqual(contentField.editor_components, []);

  const block = component.toBlock({
    heading: "What to know",
    heading_level: 3,
    content: "Read the **details**.",
  });

  assert.match(block, /\{% uswds_summary_box heading_level=3 %\}/);
  assert.match(block, /content: \|-/);
  assert.deepEqual(
    component.fromBlock(USWDS_SUMMARY_BOX_PATTERN.exec(block)),
    {
      heading: "What to know",
      heading_level: 3,
      content: "Read the **details**.",
    },
  );
  assert.match(component.toPreview({ content: "**Preview**" }), /<strong>Preview<\/strong>/);
});

test("summary box YAML is readable and keeps empty content explicit", () => {
  assert.equal(
    dumpSummaryBoxYaml({
      heading: "Privacy notice",
      content: "First line\nSecond line",
    }),
    'heading: "Privacy notice"\ncontent: |-\n  First line\n  Second line\n',
  );
  assert.equal(
    dumpSummaryBoxYaml({}),
    'heading: "Key information"\ncontent: ""\n',
  );
});

test("malformed summary box YAML fails clearly", () => {
  assert.throws(
    () => parseSummaryBoxYaml("content: ["),
    /Unable to parse uswds_summary_box YAML:/,
  );
});

test("summary box heading levels are constrained to h2 through h6", () => {
  assert.equal(normalizeSummaryBoxHeadingLevel(2), 2);
  assert.equal(normalizeSummaryBoxHeadingLevel("6"), 6);
  assert.equal(normalizeSummaryBoxHeadingLevel(1), 2);
  assert.equal(normalizeSummaryBoxHeadingLevel(7), 2);
  assert.equal(normalizeSummaryBoxHeadingLevel("invalid"), 2);

  assert.deepEqual(
    parseSummaryBoxBlock(`{% uswds_summary_box heading_level=9 %}
heading: Invalid level
content: Body
{% enduswds_summary_box %}`),
    {
      heading: "Invalid level",
      heading_level: 2,
      content: "Body",
    },
  );
});

test("summary box renderer outputs accessible USWDS markup and escaped values", () => {
  const markdownLibrary = createMarkdownLibrary({ html: true });
  const html = renderUswdsSummaryBox(
    {
      heading: 'Privacy <script>alert("x")</script>',
      heading_level: 3,
      content:
        '**Important.** Read [privacy details](https://example.gov/?a=1&b=2). <em>Raw HTML</em>',
    },
    markdownLibrary,
    { summaryBoxIndex: 7 },
  );

  assert.match(
    html,
    /^<div class="usa-summary-box" role="region" aria-labelledby="uswds-summary-box-7-privacy-scriptalertxscript">/,
  );
  assert.match(html, /<div class="usa-summary-box__body">/);
  assert.match(
    html,
    /<h3 class="usa-summary-box__heading" id="uswds-summary-box-7-privacy-scriptalertxscript">Privacy &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<\/h3>/,
  );
  assert.match(html, /<div class="usa-summary-box__text">/);
  assert.match(html, /<strong>Important\.<\/strong>/);
  assert.match(
    html,
    /<a href="https:\/\/example\.gov\/\?a=1&amp;b=2" class="usa-summary-box__link">privacy details<\/a>/,
  );
  assert.match(html, /&lt;em&gt;Raw HTML&lt;\/em&gt;/);
  assert.equal(markdownLibrary.options.html, true);
  assert.equal(markdownLibrary.renderer.rules.link_open, undefined);
});

test("summary box Liquid tag captures raw YAML without evaluating nested Liquid", async () => {
  const liquidEngine = new Liquid();
  const eleventyConfig = {
    addLiquidShortcode() {},
    addShortcode() {},
  };

  registerShortcodes(
    eleventyConfig,
    {
      features: { imageShortcodes: false },
      imageShortcodes: {},
    },
    {
      liquidEngine,
      markdownLibrary: createMarkdownLibrary({ html: true }),
    },
  );

  const html = await liquidEngine.parseAndRender(`{% assign secret = "evaluated" %}
{% uswds_summary_box heading_level=4 %}
heading: Safe heading
content: |-
  **Bold** {{ secret }} {% assign nested = "nope" %} <strong>HTML</strong>
{% enduswds_summary_box %}`);

  assert.match(html, /<h4 class="usa-summary-box__heading"/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /\{\{ secret \}\}/);
  assert.match(html, /\{% assign nested = &quot;nope&quot; %\}/);
  assert.match(html, /&lt;strong&gt;HTML&lt;\/strong&gt;/);
  assert.doesNotMatch(html, />evaluated</);
});

test("multiple summary box blocks parse and render with distinct stable ids", async () => {
  const firstBlock = buildSummaryBoxBlock({
    heading: "Same heading",
    content: "First",
  });
  const secondBlock = buildSummaryBoxBlock({
    heading: "Same heading",
    content: "Second",
  });
  const content = `${firstBlock}\n\n${secondBlock}`;
  const pattern = new RegExp(USWDS_SUMMARY_BOX_PATTERN.source, "g");
  const matches = [...content.matchAll(pattern)];

  assert.equal(matches.length, 2);
  assert.equal(parseSummaryBoxBlock(matches[0]).content, "First");
  assert.equal(parseSummaryBoxBlock(matches[1]).content, "Second");

  const liquidEngine = new Liquid();
  registerShortcodes(
    {
      addLiquidShortcode() {},
      addShortcode() {},
    },
    {
      features: { imageShortcodes: false },
      imageShortcodes: {},
    },
    {
      liquidEngine,
      markdownLibrary: createMarkdownLibrary(),
    },
  );

  const firstRender = await liquidEngine.parseAndRender(content);
  const secondRender = await liquidEngine.parseAndRender(content);
  const firstIds = [
    ...firstRender.matchAll(/id="(uswds-summary-box-[^"]+)"/g),
  ].map((match) => match[1]);
  const secondIds = [
    ...secondRender.matchAll(/id="(uswds-summary-box-[^"]+)"/g),
  ].map((match) => match[1]);

  assert.equal(new Set(firstIds).size, 2);
  assert.deepEqual(secondIds, firstIds);
});

test("admin entry registers summary box before resolving CMS proxy calls", async () => {
  const adminSource = await readFile(
    new URL("../src/admin.js", import.meta.url),
    "utf8",
  );
  const registerIndex = adminSource.indexOf(
    "registerUswdsSummaryBoxEditorComponent(CMS)",
  );
  const returnIndex = adminSource.indexOf("return CMS");

  assert.notEqual(registerIndex, -1);
  assert.ok(registerIndex < returnIndex);
});
