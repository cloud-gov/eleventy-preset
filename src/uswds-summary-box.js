import yaml from "js-yaml";
import {
  escapeAttribute,
  escapeHtml,
  normalizeObject,
  normalizeString,
} from "./uswds-utils.js";

export const USWDS_SUMMARY_BOX_COMPONENT_ID = "uswds-summary-box";
export const USWDS_SUMMARY_BOX_LABEL = "USWDS Summary Box";
export const USWDS_SUMMARY_BOX_PATTERN =
  /\{%\s*uswds_summary_box\b([^%}]*)%\}\s*\n?([\s\S]*?)\n?\{%\s*enduswds_summary_box\s*%\}/;

const DEFAULT_HEADING = "Key information";
const DEFAULT_HEADING_LEVEL = 2;

function slugify(value) {
  return normalizeString(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeSummaryBoxHeadingLevel(value) {
  const level = Number.parseInt(value, 10);

  return level >= 2 && level <= 6 ? level : DEFAULT_HEADING_LEVEL;
}

export function parseSummaryBoxAttributes(attributeText = "") {
  const match = /\bheading_level\s*=\s*("[^"]*"|'[^']*'|[^\s%}]+)/.exec(
    String(attributeText),
  );

  if (!match) {
    return { heading_level: DEFAULT_HEADING_LEVEL };
  }

  return {
    heading_level: normalizeSummaryBoxHeadingLevel(
      match[1].replace(/^['"]|['"]$/g, ""),
    ),
  };
}

export function normalizeSummaryBoxData(data = {}) {
  const normalized = normalizeObject(data);
  const heading = normalizeString(normalized.heading).trim();

  return {
    heading: heading || DEFAULT_HEADING,
    heading_level: normalizeSummaryBoxHeadingLevel(normalized.heading_level),
    content: normalizeString(normalized.content),
  };
}

export function parseSummaryBoxYaml(body = "") {
  try {
    const data = yaml.load(String(body || "").trim()) || {};

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data;
  } catch (error) {
    throw new Error(`Unable to parse uswds_summary_box YAML: ${error.message}`);
  }
}

export function parseSummaryBoxBlock(matchOrBlock) {
  const match = Array.isArray(matchOrBlock)
    ? matchOrBlock
    : USWDS_SUMMARY_BOX_PATTERN.exec(String(matchOrBlock || ""));

  if (!match) {
    return normalizeSummaryBoxData();
  }

  return normalizeSummaryBoxData({
    ...parseSummaryBoxYaml(match[2]),
    ...parseSummaryBoxAttributes(match[1]),
  });
}

export function dumpSummaryBoxYaml(data = {}) {
  const normalized = normalizeSummaryBoxData(data);
  const lines = [`heading: ${JSON.stringify(normalized.heading)}`];

  if (normalized.content) {
    lines.push("content: |-");
    lines.push(
      ...normalized.content
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => `  ${line}`),
    );
  } else {
    lines.push('content: ""');
  }

  return `${lines.join("\n")}\n`;
}

export function buildSummaryBoxBlock(data = {}) {
  const normalized = normalizeSummaryBoxData(data);
  const body = dumpSummaryBoxYaml(normalized).trimEnd();

  return `{% uswds_summary_box heading_level=${normalized.heading_level} %}\n${body}\n{% enduswds_summary_box %}`;
}

function renderSummaryBoxMarkdown(value, markdownLibrary) {
  const content = normalizeString(value);

  if (
    !markdownLibrary ||
    typeof markdownLibrary.render !== "function" ||
    typeof markdownLibrary.set !== "function"
  ) {
    return escapeHtml(content);
  }

  const previousHtmlOption = markdownLibrary.options?.html;
  const previousLinkOpen = markdownLibrary.renderer.rules.link_open;

  markdownLibrary.set({ html: false });
  markdownLibrary.renderer.rules.link_open = (tokens, index, options, env, self) => {
    tokens[index].attrJoin("class", "usa-summary-box__link");

    if (previousLinkOpen) {
      return previousLinkOpen(tokens, index, options, env, self);
    }

    return self.renderToken(tokens, index, options);
  };

  try {
    return markdownLibrary.render(content);
  } finally {
    markdownLibrary.set({ html: previousHtmlOption });

    if (previousLinkOpen) {
      markdownLibrary.renderer.rules.link_open = previousLinkOpen;
    } else {
      delete markdownLibrary.renderer.rules.link_open;
    }
  }
}

function normalizeSummaryBoxIndex(value) {
  const normalized = String(value || "1").replace(/[^a-zA-Z0-9_-]/g, "-");

  return normalized || "1";
}

export function renderUswdsSummaryBox(data = {}, markdownLibrary, options = {}) {
  const normalized = normalizeSummaryBoxData(data);
  const headingLevel = normalized.heading_level;
  const headingId = `uswds-summary-box-${normalizeSummaryBoxIndex(
    options.summaryBoxIndex,
  )}-${slugify(normalized.heading) || "heading"}`;

  return `<div class="usa-summary-box" role="region" aria-labelledby="${escapeAttribute(
    headingId,
  )}">
  <div class="usa-summary-box__body">
    <h${headingLevel} class="usa-summary-box__heading" id="${escapeAttribute(
      headingId,
    )}">${escapeHtml(normalized.heading)}</h${headingLevel}>
    <div class="usa-summary-box__text">
${renderSummaryBoxMarkdown(normalized.content, markdownLibrary).trim()}
    </div>
  </div>
</div>`;
}
