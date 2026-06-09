import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Liquid } from "liquidjs";
import markdownIt from "markdown-it";
import { registerUswdsCardGroupEditorComponent } from "../src/admin/uswds-card-group-editor-component.js";
import { registerShortcodes } from "../src/shortcodes.js";
import {
  buildCardGroupBlock,
  dumpCardGroupYaml,
  parseCardGroupBlock,
  parseCardGroupYaml,
  renderUswdsCardGroup,
  USWDS_CARD_GROUP_PATTERN,
} from "../src/uswds-card-group.js";

function createMarkdownLibrary(options = {}) {
  return markdownIt({
    html: options.html ?? true,
    breaks: false,
    linkify: true,
    typographer: false,
  });
}

test("Decap editor component registers with re-editable helpers and empty defaults", () => {
  let component;
  const CMS = {
    registerEditorComponent(value) {
      component = value;
    },
  };

  registerUswdsCardGroupEditorComponent(CMS);

  assert.equal(component.id, "uswds-card-group");
  assert.equal(component.label, "USWDS Card Group");

  const cardsField = component.fields.find((field) => field.name === "cards");
  assert.deepEqual(cardsField.default, [{}]);

  const contentField = cardsField.fields.find(
    (field) => field.name === "content",
  );
  assert.equal(contentField.widget, "markdown");
  assert.deepEqual(contentField.editor_components, []);

  const block = component.toBlock({
    cards: [
      {
        heading: "Card heading",
        content: "Markdown body.",
      },
    ],
  });

  assert.match(block, /content: \|-/);
  assert.deepEqual(
    component.fromBlock(USWDS_CARD_GROUP_PATTERN.exec(block)).cards[0],
    {
      heading: "Card heading",
      content: "Markdown body.",
      image: { src: "", alt: "" },
      button: { label: "", href: "" },
      link: { label: "", href: "" },
    },
  );
});

test("empty card defaults save without placeholder content", () => {
  assert.equal(dumpCardGroupYaml({ cards: [{}] }), "cards:\n  - {}\n");

  const block = buildCardGroupBlock({ cards: [{}] });
  assert.doesNotMatch(
    block,
    /Card heading|Markdown body|Primary action|Secondary link/,
  );
});

test("shortcode renders USWDS card markup with markdown and escaped user values", () => {
  const html = renderUswdsCardGroup(
    {
      cards: [
        {
          heading: 'Heading <script>alert("x")</script>',
          content: "**Markdown** <em>HTML</em>",
          image: {
            src: '"/uploads/example.jpg',
            alt: "Alt <text>",
          },
          button: {
            label: "Primary <action>",
            href: '"/example/"',
          },
          link: {
            label: "Secondary <link>",
            href: "/example/details/",
          },
        },
      ],
    },
    createMarkdownLibrary({ html: true }),
  );

  assert.match(html, /^<ul class="usa-card-group">/);
  assert.match(
    html,
    /<li class="usa-card tablet:grid-col-6 desktop:grid-col-4">/,
  );
  assert.match(html, /<div class="usa-card__container">/);
  assert.match(html, /<div class="usa-card__header">/);
  assert.match(html, /<h4 class="usa-card__heading">Heading &lt;script&gt;/);
  assert.match(html, /<div class="usa-card__media">/);
  assert.match(
    html,
    /<img src="&quot;\/uploads\/example\.jpg" alt="Alt &lt;text&gt;" \/>/,
  );
  assert.match(html, /<div class="usa-card__body">/);
  assert.match(html, /<strong>Markdown<\/strong> &lt;em&gt;HTML&lt;\/em&gt;/);
  assert.match(
    html,
    /<a class="usa-button" href="&quot;\/example\/&quot;">Primary &lt;action&gt;<\/a>\n<a href="\/example\/details\/">Secondary &lt;link&gt;<\/a>/,
  );
});

test("missing optional card fields omit wrappers cleanly", () => {
  const html = renderUswdsCardGroup(
    {
      cards: [
        {
          heading: "Only heading",
        },
      ],
    },
    createMarkdownLibrary(),
  );

  assert.match(html, /usa-card__header/);
  assert.doesNotMatch(html, /usa-card__media/);
  assert.doesNotMatch(html, /usa-card__body/);
  assert.doesNotMatch(html, /usa-card__footer/);
});

test("Liquid tag captures raw YAML so card body Liquid is not evaluated", async () => {
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

  const html =
    await liquidEngine.parseAndRender(`{% assign secret = "evaluated" %}
{% uswds_card_group %}
cards:
  - content: |-
      **Bold** {{ secret }} {% assign nested = "nope" %}
{% enduswds_card_group %}`);

  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /\{\{ secret \}\}/);
  assert.match(html, /\{% assign nested = &quot;nope&quot; %\}/);
  assert.doesNotMatch(html, /evaluated/);
});

test("malformed YAML fails clearly", () => {
  assert.throws(
    () => parseCardGroupYaml("cards: ["),
    /Unable to parse uswds_card_group YAML:/,
  );
});

test("multiple card group blocks parse independently", () => {
  const content = `${buildCardGroupBlock({ cards: [{ heading: "First" }] })}

Some Markdown between groups.

${buildCardGroupBlock({ cards: [{ heading: "Second" }] })}`;

  const pattern = new RegExp(USWDS_CARD_GROUP_PATTERN.source, "g");
  const matches = [...content.matchAll(pattern)];

  assert.equal(matches.length, 2);
  assert.equal(parseCardGroupBlock(matches[0]).cards[0].heading, "First");
  assert.equal(parseCardGroupBlock(matches[1]).cards[0].heading, "Second");
});

test("admin entry registers card group before resolving CMS proxy calls", async () => {
  const adminSource = await readFile(
    new URL("../src/admin.js", import.meta.url),
    "utf8",
  );
  const cardRegisterIndex = adminSource.indexOf(
    "registerUswdsCardGroupEditorComponent(CMS)",
  );
  const returnIndex = adminSource.indexOf("return CMS");

  assert.notEqual(cardRegisterIndex, -1);
  assert.ok(cardRegisterIndex < returnIndex);
});
