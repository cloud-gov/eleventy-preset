import yaml from "js-yaml";
import { escapeAttribute, escapeHtml, parseBoolean } from "./uswds-utils.js";

export const USWDS_ACCORDION_COMPONENT_ID = "uswds-accordion";
export const USWDS_ACCORDION_LABEL = "USWDS Accordion";
export const USWDS_ACCORDION_PATTERN =
  /\{%\s*uswds_accordion\b([^%}]*)%\}\s*\n?([\s\S]*?)\n?\{%\s*enduswds_accordion\s*%\}/;

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createUniqueId(baseId, seenIds) {
  let id = baseId;
  let suffix = 2;

  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  seenIds.add(id);
  return id;
}

export function parseAccordionAttributes(attributeText = "") {
  const attributes = {
    bordered: false,
    allow_multiple: false,
  };
  const pattern = /\b(bordered|allow_multiple)\s*=\s*("[^"]*"|'[^']*'|[^\s%}]+)/g;

  for (const match of String(attributeText).matchAll(pattern)) {
    const key = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, "");
    attributes[key] = parseBoolean(value, false);
  }

  return attributes;
}

export function normalizeAccordionData(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    bordered: parseBoolean(data.bordered, false),
    allow_multiple: parseBoolean(data.allow_multiple, false),
    items: items.map((item = {}) => ({
      title: String(item.title || ""),
      open: parseBoolean(item.open, false),
      content: String(item.content || ""),
    })),
  };
}

export function parseAccordionYaml(body = "") {
  try {
    const data = yaml.load(String(body || "").trim()) || {};
    if (typeof data !== "object" || Array.isArray(data)) {
      return { items: [] };
    }

    return data;
  } catch (error) {
    throw new Error(`Unable to parse uswds_accordion YAML: ${error.message}`);
  }
}

export function parseAccordionBlock(matchOrBlock) {
  const match = Array.isArray(matchOrBlock)
    ? matchOrBlock
    : USWDS_ACCORDION_PATTERN.exec(String(matchOrBlock || ""));

  if (!match) {
    return normalizeAccordionData();
  }

  return normalizeAccordionData({
    ...parseAccordionAttributes(match[1]),
    ...parseAccordionYaml(match[2]),
  });
}

export function dumpAccordionYaml(data = {}) {
  const normalized = normalizeAccordionData(data);
  const lines = ["items:"];

  if (normalized.items.length === 0) {
    return "items: []\n";
  }

  for (const item of normalized.items) {
    lines.push(`  - title: ${JSON.stringify(item.title)}`);
    lines.push(`    open: ${item.open ? "true" : "false"}`);

    if (item.content) {
      lines.push("    content: |-");
      lines.push(
        ...item.content
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((line) => `      ${line}`),
      );
    } else {
      lines.push('    content: ""');
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildAccordionBlock(data = {}) {
  const normalized = normalizeAccordionData(data);
  const bordered = normalized.bordered ? "true" : "false";
  const allowMultiple = normalized.allow_multiple ? "true" : "false";
  const body = dumpAccordionYaml(normalized).trimEnd();

  return `{% uswds_accordion bordered=${bordered} allow_multiple=${allowMultiple} %}\n${body}\n{% enduswds_accordion %}`;
}

export function renderUswdsAccordion(data = {}, markdownLibrary, options = {}) {
  const normalized = normalizeAccordionData(data);
  const accordionIndex = options.accordionIndex || 1;
  const seenIds = options.seenIds || new Set();
  const renderMarkdown =
    options.renderMarkdown ||
    ((value) => (markdownLibrary ? markdownLibrary.render(String(value || "")) : escapeHtml(value)));
  const classes = ["usa-accordion"];

  if (normalized.bordered) {
    classes.push("usa-accordion--bordered");
  }

  if (normalized.allow_multiple) {
    classes.push("usa-accordion--multiselectable");
  }

  const attributes = [`class="${classes.join(" ")}"`];

  if (normalized.allow_multiple) {
    attributes.push('data-allow-multiple="true"');
  }

  const items = normalized.items
    .map((item, index) => {
      const itemNumber = index + 1;
      const titleSlug = slugify(item.title) || `item-${itemNumber}`;
      const id = createUniqueId(
        `uswds-accordion-${accordionIndex}-item-${itemNumber}-${titleSlug}`,
        seenIds,
      );
      const isOpen = parseBoolean(item.open, false);

      return `<h4 class="usa-accordion__heading">
  <button type="button" class="usa-accordion__button" aria-expanded="${isOpen ? "true" : "false"}" aria-controls="${escapeAttribute(id)}">
    ${escapeHtml(item.title)}
  </button>
</h4>
<div id="${escapeAttribute(id)}" class="usa-accordion__content usa-prose">
${renderMarkdown(item.content).trim()}
</div>`;
    })
    .join("\n");

  return `<div ${attributes.join(" ")}>\n${items}\n</div>`;
}
