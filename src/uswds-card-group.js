import yaml from "js-yaml";
import {
  createEditorComponentPattern,
  extractPairedShortcodeBlock,
  wrapEditorComponentBlock,
} from "./editor-component-block.js";
import {
  escapeAttribute,
  escapeHtml,
  hasText,
  normalizeObject,
  normalizeString,
} from "./uswds-utils.js";

export const USWDS_CARD_GROUP_COMPONENT_ID = "uswds-card-group";
export const USWDS_CARD_GROUP_LABEL = "USWDS Card Group";
export const USWDS_CARD_GROUP_PATTERN =
  createEditorComponentPattern("uswds_card_group");

const CARD_CLASS = "usa-card tablet:grid-col-6 desktop:grid-col-4";

function normalizeAction(value = {}) {
  const action = normalizeObject(value);

  return {
    label: normalizeString(action.label),
    href: normalizeString(action.href),
  };
}

function normalizeImage(value = {}) {
  const image = normalizeObject(value);

  return {
    src: normalizeString(image.src),
    alt: normalizeString(image.alt),
  };
}

export function normalizeCardGroupData(data = {}) {
  const cards = Array.isArray(data.cards) ? data.cards : [];

  return {
    cards: cards.map((card = {}) => {
      const normalizedCard = normalizeObject(card);

      return {
        heading: normalizeString(normalizedCard.heading),
        content: normalizeString(normalizedCard.content),
        image: normalizeImage(normalizedCard.image),
        button: normalizeAction(normalizedCard.button),
        link: normalizeAction(normalizedCard.link),
      };
    }),
  };
}

export function parseCardGroupYaml(body = "") {
  try {
    const data = yaml.load(String(body || "").trim()) || {};
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { cards: [] };
    }

    return data;
  } catch (error) {
    throw new Error(`Unable to parse uswds_card_group YAML: ${error.message}`);
  }
}

export function parseCardGroupBlock(matchOrBlock) {
  const block = extractPairedShortcodeBlock(
    matchOrBlock,
    "uswds_card_group",
  );

  if (!block) {
    return normalizeCardGroupData();
  }

  return normalizeCardGroupData(parseCardGroupYaml(block.body));
}

function pushStringLine(lines, key, value, indent = "    ") {
  if (hasText(value)) {
    lines.push(`${indent}${key}: ${JSON.stringify(normalizeString(value))}`);
  }
}

function pushBlockScalarLine(
  lines,
  key,
  value,
  indent = "    ",
  contentIndent = "      ",
) {
  if (!hasText(value)) {
    return;
  }

  lines.push(`${indent}${key}: |-`);
  lines.push(
    ...normalizeString(value)
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => `${contentIndent}${line}`),
  );
}

function pushObjectLines(lines, key, value, fields) {
  const objectLines = [];

  for (const field of fields) {
    pushStringLine(objectLines, field, value[field], "      ");
  }

  if (objectLines.length > 0) {
    lines.push(`    ${key}:`);
    lines.push(...objectLines);
  }
}

export function dumpCardGroupYaml(data = {}) {
  const normalized = normalizeCardGroupData(data);

  if (normalized.cards.length === 0) {
    return "cards: []\n";
  }

  const lines = ["cards:"];

  for (const card of normalized.cards) {
    const cardLines = [];

    pushStringLine(cardLines, "heading", card.heading);
    pushBlockScalarLine(cardLines, "content", card.content);
    pushObjectLines(cardLines, "image", card.image, ["src", "alt"]);
    pushObjectLines(cardLines, "button", card.button, ["label", "href"]);
    pushObjectLines(cardLines, "link", card.link, ["label", "href"]);

    if (cardLines.length === 0) {
      lines.push("  - {}");
      continue;
    }

    lines.push(`  - ${cardLines[0].trimStart()}`);
    lines.push(...cardLines.slice(1));
  }

  return `${lines.join("\n")}\n`;
}

export function buildCardGroupBlock(data = {}) {
  const body = dumpCardGroupYaml(data).trimEnd();

  return wrapEditorComponentBlock(
    `{% uswds_card_group %}\n${body}\n{% enduswds_card_group %}`,
  );
}

function renderMarkdownOnly(value, markdownLibrary) {
  const content = normalizeString(value);

  if (!markdownLibrary || typeof markdownLibrary.render !== "function") {
    return escapeHtml(content);
  }

  if (typeof markdownLibrary.set !== "function") {
    return markdownLibrary.render(content);
  }

  const previousHtmlOption = markdownLibrary.options?.html;

  markdownLibrary.set({ html: false });

  try {
    return markdownLibrary.render(content);
  } finally {
    markdownLibrary.set({ html: previousHtmlOption });
  }
}

function renderCardFooter(card) {
  const footerParts = [];

  if (hasText(card.button.label) || hasText(card.button.href)) {
    footerParts.push(
      `<a class="usa-button" href="${escapeAttribute(card.button.href)}">${escapeHtml(
        card.button.label,
      )}</a>`,
    );
  }

  if (hasText(card.link.label) || hasText(card.link.href)) {
    footerParts.push(
      `<a href="${escapeAttribute(card.link.href)}">${escapeHtml(card.link.label)}</a>`,
    );
  }

  if (footerParts.length === 0) {
    return "";
  }

  return `<div class="usa-card__footer">
${footerParts.join("\n")}
</div>`;
}

export function renderUswdsCardGroup(data = {}, markdownLibrary) {
  const normalized = normalizeCardGroupData(data);
  const cards = normalized.cards
    .map((card) => {
      const parts = [];

      if (hasText(card.heading)) {
        parts.push(`<div class="usa-card__header">
  <h4 class="usa-card__heading">${escapeHtml(card.heading)}</h4>
</div>`);
      }

      if (hasText(card.image.src)) {
        parts.push(`<div class="usa-card__media">
  <div class="usa-card__img">
    <img src="${escapeAttribute(card.image.src)}" alt="${escapeAttribute(card.image.alt)}" />
  </div>
</div>`);
      }

      if (hasText(card.content)) {
        parts.push(`<div class="usa-card__body">
${renderMarkdownOnly(card.content, markdownLibrary).trim()}
</div>`);
      }

      const footer = renderCardFooter(card);
      if (footer) {
        parts.push(footer);
      }

      return `<li class="${CARD_CLASS}">
<div class="usa-card__container">
${parts.join("\n")}
</div>
</li>`;
    })
    .join("\n");

  return `<ul class="usa-card-group">
${cards}
</ul>`;
}
