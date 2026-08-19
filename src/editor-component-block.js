export const PRETTIER_IGNORE_START = "<!-- prettier-ignore-start -->";
export const PRETTIER_IGNORE_END = "<!-- prettier-ignore-end -->";

const PRETTIER_IGNORE_START_PATTERN =
  "<!--\\s*prettier-ignore-start\\s*-->";
const PRETTIER_IGNORE_END_PATTERN = "<!--\\s*prettier-ignore-end\\s*-->";

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pairedShortcodeSource(shortcodeName) {
  const escapedName = escapeRegExp(shortcodeName);

  return `\\{%\\s*${escapedName}\\b[^%}]*%\\}[\\s\\S]*?\\{%\\s*end${escapedName}\\s*%\\}`;
}

export function createEditorComponentPattern(shortcodeName) {
  const shortcode = pairedShortcodeSource(shortcodeName);
  const wrapped = `${PRETTIER_IGNORE_START_PATTERN}\\s*${shortcode}\\s*${PRETTIER_IGNORE_END_PATTERN}`;

  return new RegExp(`(?:${wrapped}|${shortcode})`);
}

export function extractPairedShortcodeBlock(matchOrBlock, shortcodeName) {
  const block = Array.isArray(matchOrBlock)
    ? matchOrBlock[0]
    : String(matchOrBlock || "");
  const escapedName = escapeRegExp(shortcodeName);
  const match = new RegExp(
    `\\{%\\s*${escapedName}\\b([^%}]*)%\\}\\s*\\n?([\\s\\S]*?)\\n?\\{%\\s*end${escapedName}\\s*%\\}`,
  ).exec(block);

  if (!match) {
    return null;
  }

  return {
    attributes: match[1],
    body: match[2],
  };
}

export function wrapEditorComponentBlock(block) {
  const wrapperPattern = new RegExp(
    `^${PRETTIER_IGNORE_START_PATTERN}\\s*([\\s\\S]*?)\\s*${PRETTIER_IGNORE_END_PATTERN}$`,
  );
  let unwrapped = String(block || "").trim();
  let match = wrapperPattern.exec(unwrapped);

  while (match) {
    unwrapped = match[1].trim();
    match = wrapperPattern.exec(unwrapped);
  }

  return `${PRETTIER_IGNORE_START}\n\n${unwrapped}\n\n${PRETTIER_IGNORE_END}`;
}
