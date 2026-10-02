function normalizeInputPath(value = "") {
  return String(value).replace(/\\/g, "/").replace(/\/+/g, "/");
}

function normalizeContentDirectory(value = "") {
  return normalizeInputPath(value)
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "");
}

function isObjectRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBlank(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.every(isBlank);
  }

  if (isObjectRecord(value)) {
    return Object.values(value).every(isBlank);
  }

  return false;
}

function nonBlank(value, fallback) {
  return isBlank(value) ? fallback : value;
}

export function navigationKeyFromInputPath(
  inputPath = "",
  contentDirectory = "content/pages",
) {
  const normalizedPath = normalizeInputPath(inputPath).replace(/^\.\//, "");
  const normalizedDirectory = normalizeContentDirectory(contentDirectory);

  if (!normalizedPath || !normalizedDirectory) {
    return undefined;
  }

  const directoryPrefix = `${normalizedDirectory}/`;
  let relativePath;

  if (normalizedPath.startsWith(directoryPrefix)) {
    relativePath = normalizedPath.slice(directoryPrefix.length);
  } else {
    const marker = `/${directoryPrefix}`;
    const markerIndex = normalizedPath.lastIndexOf(marker);

    if (markerIndex === -1) {
      return undefined;
    }

    relativePath = normalizedPath.slice(markerIndex + marker.length);
  }

  const segments = relativePath
    .replace(/\.[^/.]+$/, "")
    .split("/")
    .filter(Boolean);

  if (segments.at(-1) === "index") {
    segments.pop();
  }

  return segments.length > 0 ? segments.join("/") : undefined;
}

export function parentKeyFromNavigationKey(key) {
  if (!key || !key.includes("/")) {
    return undefined;
  }

  return key.split("/").slice(0, -1).join("/");
}

export function navigationFromEntry(
  entry = {},
  { contentDirectory = "content/pages" } = {},
) {
  const data = entry.data || {};
  const navigation = data.eleventyNavigation;

  if (
    navigation !== true &&
    (!isObjectRecord(navigation) || isBlank(navigation))
  ) {
    return undefined;
  }

  const explicitNavigation = navigation === true ? {} : navigation;
  const pathKey = navigationKeyFromInputPath(
    entry.inputPath || data.page?.inputPath || "",
    contentDirectory,
  );
  const key = pathKey || nonBlank(explicitNavigation.key, data.title);

  return {
    ...explicitNavigation,
    key,
    parent: nonBlank(
      explicitNavigation.parent,
      pathKey ? parentKeyFromNavigationKey(pathKey) : undefined,
    ),
    title: nonBlank(explicitNavigation.title, data.title),
  };
}

export function createNavigationEntriesFilter(options = {}) {
  return function studioNavigationEntries(collection = []) {
    return collection.map((entry) => ({
      ...entry,
      data: {
        ...entry.data,
        eleventyNavigation: navigationFromEntry(entry, options),
      },
    }));
  };
}

export function normalizeNavigationUrl(url = "") {
  const value = String(url);

  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "") || "/";
}

export function navigationIsCurrent(url, pageUrl) {
  return normalizeNavigationUrl(url) === normalizeNavigationUrl(pageUrl);
}

export function navigationHasCurrentDescendant(children = [], pageUrl) {
  const remaining = Array.isArray(children) ? [...children] : [];
  const visited = new Set();

  while (remaining.length > 0) {
    const child = remaining.shift();

    if (!child || visited.has(child)) {
      continue;
    }

    visited.add(child);

    if (navigationIsCurrent(child.url, pageUrl)) {
      return true;
    }

    if (Array.isArray(child.children)) {
      remaining.push(...child.children);
    }
  }

  return false;
}

export function registerNavigationHelpers(eleventyConfig, options) {
  eleventyConfig.addFilter(
    "studioNavigationEntries",
    createNavigationEntriesFilter(options.navigation),
  );
  eleventyConfig.addFilter("studioNavigationIsCurrent", navigationIsCurrent);
  eleventyConfig.addFilter(
    "studioNavigationHasCurrentDescendant",
    navigationHasCurrentDescendant,
  );
}
