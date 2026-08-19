import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Liquid } from "liquidjs";
import markdownIt from "markdown-it";
import { registerUswdsAccordionEditorComponent } from "../src/admin/uswds-accordion-editor-component.js";
import {
  PRETTIER_IGNORE_END,
  PRETTIER_IGNORE_START,
} from "../src/editor-component-block.js";
import { registerShortcodes } from "../src/shortcodes.js";
import {
  buildAccordionBlock,
  dumpAccordionYaml,
  parseAccordionBlock,
  parseAccordionYaml,
  renderUswdsAccordion,
  USWDS_ACCORDION_PATTERN,
} from "../src/uswds-accordion.js";

function createMarkdownLibrary(options = {}) {
  return markdownIt({
    html: options.html ?? true,
    breaks: false,
    linkify: true,
    typographer: false,
  });
}

test("Decap accordion editor component registers with re-editable helpers and defaults", () => {
  let component;
  const CMS = {
    registerEditorComponent(value) {
      component = value;
    },
  };

  registerUswdsAccordionEditorComponent(CMS);

  assert.equal(component.id, "uswds-accordion");
  assert.equal(component.label, "USWDS Accordion");

  const itemsField = component.fields.find((field) => field.name === "items");
  assert.deepEqual(itemsField.default, [
    {
      title: "First item",
      content: "",
      open: false,
    },
  ]);

  const contentField = itemsField.fields.find((field) => field.name === "content");
  assert.equal(contentField.widget, "markdown");
  assert.deepEqual(contentField.editor_components, []);

  const block = component.toBlock({
    bordered: true,
    allow_multiple: true,
    items: [
      {
        title: "First item",
        content: "Markdown body.",
        open: true,
      },
    ],
  });

  assert.equal(
    block,
    `<!-- prettier-ignore-start -->

{% uswds_accordion bordered=true allow_multiple=true %}
items:
  - title: "First item"
    open: true
    content: |-
      Markdown body.
{% enduswds_accordion %}

<!-- prettier-ignore-end -->`,
  );
  assert.deepEqual(component.fromBlock(USWDS_ACCORDION_PATTERN.exec(block)), {
    bordered: true,
    allow_multiple: true,
    items: [
      {
        title: "First item",
        content: "Markdown body.",
        open: true,
      },
    ],
  });

  assert.match(component.toPreview({ items: [{ title: "Preview", content: "**Body**" }] }), /<strong>Body<\/strong>/);
});

test("accordion editor parses legacy blocks and normalizes round trips to one wrapper", () => {
  const legacyBlock = `{% uswds_accordion bordered=true allow_multiple=false %}
items:
  - title: "Legacy item"
    open: false
    content: |-
      Legacy Markdown.
{% enduswds_accordion %}`;
  const expectedData = {
    bordered: true,
    allow_multiple: false,
    items: [
      {
        title: "Legacy item",
        open: false,
        content: "Legacy Markdown.",
      },
    ],
  };

  assert.deepEqual(
    parseAccordionBlock(USWDS_ACCORDION_PATTERN.exec(legacyBlock)),
    expectedData,
  );

  const roundTrip = buildAccordionBlock(expectedData);
  const wrappedMatch = USWDS_ACCORDION_PATTERN.exec(roundTrip);

  assert.equal(wrappedMatch[0], roundTrip);
  assert.deepEqual(parseAccordionBlock(wrappedMatch), expectedData);
  assert.equal(roundTrip.split(PRETTIER_IGNORE_START).length - 1, 1);
  assert.equal(roundTrip.split(PRETTIER_IGNORE_END).length - 1, 1);
  assert.equal(
    buildAccordionBlock(parseAccordionBlock(wrappedMatch)),
    roundTrip,
  );
});

test("accordion YAML serializer keeps empty content explicit and readable", () => {
  assert.equal(
    dumpAccordionYaml({
      items: [
        {
          title: "Empty item",
          content: "",
          open: false,
        },
      ],
    }),
    'items:\n  - title: "Empty item"\n    open: false\n    content: ""\n',
  );

  assert.equal(dumpAccordionYaml({ items: [] }), "items: []\n");
});

test("accordion renderer outputs USWDS markup with markdown, escaped title, and attributes", () => {
  const html = renderUswdsAccordion(
    {
      bordered: true,
      allow_multiple: true,
      items: [
        {
          title: 'Heading <script>alert("x")</script>',
          content: "**Markdown** body",
          open: true,
        },
      ],
    },
    createMarkdownLibrary(),
    {
      accordionIndex: 3,
    },
  );

  assert.match(
    html,
    /^<div class="usa-accordion usa-accordion--bordered usa-accordion--multiselectable" data-allow-multiple="true">/,
  );
  assert.match(html, /<h4 class="usa-accordion__heading">/);
  assert.match(html, /class="usa-accordion__button" aria-expanded="true"/);
  assert.match(html, /aria-controls="uswds-accordion-3-item-1-heading-scriptalertxscript"/);
  assert.match(html, /Heading &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /<div id="uswds-accordion-3-item-1-heading-scriptalertxscript" class="usa-accordion__content usa-prose">/);
  assert.match(html, /<strong>Markdown<\/strong> body/);
});

test("accordion renderer creates unique ids for duplicate titles", () => {
  const html = renderUswdsAccordion(
    {
      items: [
        {
          title: "Duplicate",
          content: "One",
        },
        {
          title: "Duplicate",
          content: "Two",
        },
      ],
    },
    createMarkdownLibrary(),
    {
      accordionIndex: 1,
    },
  );

  assert.match(html, /id="uswds-accordion-1-item-1-duplicate"/);
  assert.match(html, /id="uswds-accordion-1-item-2-duplicate"/);
});

test("accordion shortcode captures raw YAML so item body Liquid is not evaluated", async () => {
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
      markdownLibrary: createMarkdownLibrary(),
    },
  );

  const html = await liquidEngine.parseAndRender(`{% assign secret = "evaluated" %}
{% uswds_accordion bordered=false allow_multiple=false %}
items:
  - title: First
    open: false
    content: |-
      **Bold** {{ secret }} {% assign nested = "nope" %}
{% enduswds_accordion %}`);

  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /\{\{ secret \}\}/);
  assert.match(html, /\{% assign nested = &quot;nope&quot; %\}/);
  assert.doesNotMatch(html, /evaluated/);
});

test("malformed accordion YAML fails clearly", () => {
  assert.throws(
    () => parseAccordionYaml("items: ["),
    /Unable to parse uswds_accordion YAML:/,
  );
});

test("multiple accordion blocks parse independently", () => {
  const content = `${buildAccordionBlock({
    bordered: false,
    allow_multiple: false,
    items: [{ title: "First" }],
  })}

Some Markdown between accordions.

${buildAccordionBlock({
  bordered: true,
  allow_multiple: true,
  items: [{ title: "Second", open: true }],
})}`;

  const pattern = new RegExp(USWDS_ACCORDION_PATTERN.source, "g");
  const matches = [...content.matchAll(pattern)];

  assert.equal(matches.length, 2);
  assert.equal(matches[0][0], content.slice(0, content.indexOf("\n\nSome Markdown")));
  assert.ok(matches.every((match) => match[0].startsWith(PRETTIER_IGNORE_START)));
  assert.ok(matches.every((match) => match[0].endsWith(PRETTIER_IGNORE_END)));
  assert.deepEqual(parseAccordionBlock(matches[0]), {
    bordered: false,
    allow_multiple: false,
    items: [
      {
        title: "First",
        open: false,
        content: "",
      },
    ],
  });
  assert.deepEqual(parseAccordionBlock(matches[1]), {
    bordered: true,
    allow_multiple: true,
    items: [
      {
        title: "Second",
        open: true,
        content: "",
      },
    ],
  });
});

test("admin entry registers accordion before resolving CMS proxy calls", async () => {
  const adminSource = await readFile(new URL("../src/admin.js", import.meta.url), "utf8");
  const accordionRegisterIndex = adminSource.indexOf("registerUswdsAccordionEditorComponent(CMS)");
  const returnIndex = adminSource.indexOf("return CMS");

  assert.notEqual(accordionRegisterIndex, -1);
  assert.ok(accordionRegisterIndex < returnIndex);
});
