import { access, rmdir, unlink } from "node:fs/promises";
import path from "node:path";

const VIRTUAL_TEMPLATE_PATH = "studio-redirects.11ty.js";
const REDIRECTS_JSON_PATH = "/redirects.json";

function redirectError(message) {
  return new Error(`Jekyll-compatible redirects: ${message}`);
}

function describeInput(inputPath) {
  return inputPath || "an unknown template";
}

export function normalizeRedirectFrom(value, inputPath = "") {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const aliases = values
    .filter((entry) => entry != null)
    .map((entry) => normalizeRedirectSource(entry, inputPath));

  return [...new Set(aliases)];
}

export function normalizeRedirectTo(value, inputPath = "") {
  const destination = Array.isArray(value)
    ? value.find((entry) => entry != null)
    : value;

  if (destination == null) {
    return null;
  }

  if (typeof destination !== "string") {
    throw redirectError(
      `redirect_to in ${describeInput(inputPath)} must be a string or an array whose first non-null entry is a string.`,
    );
  }

  return normalizeRedirectDestination(destination, inputPath);
}

export function normalizeRedirectSource(value, inputPath = "") {
  if (typeof value !== "string") {
    throw redirectError(
      `redirect_from in ${describeInput(inputPath)} must contain only string paths and null entries.`,
    );
  }

  let source = value.trim();

  if (!source) {
    throw redirectError(
      `redirect_from in ${describeInput(inputPath)} contains an empty source path.`,
    );
  }

  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(source) || source.startsWith("//")) {
    throw redirectError(
      `redirect source "${value}" in ${describeInput(inputPath)} must be a site path, not a URL.`,
    );
  }

  if (source.includes("?") || source.includes("#")) {
    throw redirectError(
      `redirect source "${value}" in ${describeInput(inputPath)} cannot contain a query string or fragment.`,
    );
  }

  if (!source.startsWith("/")) {
    source = `/${source}`;
  }

  if (
    source.includes("\\") ||
    /[\u0000-\u001F\u007F\s<>"`{}|^]/.test(source)
  ) {
    throw redirectError(
      `redirect source "${value}" in ${describeInput(inputPath)} contains invalid URL-path characters.`,
    );
  }

  if (source.includes("//")) {
    throw redirectError(
      `redirect source "${value}" in ${describeInput(inputPath)} contains an empty path segment.`,
    );
  }

  for (const segment of source.split("/")) {
    let decodedSegment;

    try {
      decodedSegment = decodeURIComponent(segment);
    } catch {
      throw redirectError(
        `redirect source "${value}" in ${describeInput(inputPath)} contains malformed percent encoding.`,
      );
    }

    if (
      decodedSegment === "." ||
      decodedSegment === ".." ||
      decodedSegment.includes("/") ||
      decodedSegment.includes("\\") ||
      /[\u0000-\u001F\u007F]/.test(decodedSegment)
    ) {
      throw redirectError(
        `redirect source "${value}" in ${describeInput(inputPath)} contains path traversal or an encoded path separator.`,
      );
    }
  }

  return source;
}

export function normalizeRedirectDestination(value, inputPath = "") {
  if (typeof value !== "string") {
    throw redirectError(
      `redirect destination in ${describeInput(inputPath)} must be a string.`,
    );
  }

  const destination = value.trim();

  if (!destination) {
    throw redirectError(
      `redirect destination in ${describeInput(inputPath)} cannot be empty.`,
    );
  }

  if (/[\u0000-\u001F\u007F]/.test(destination) || destination.includes("\\")) {
    throw redirectError(
      `redirect destination "${value}" in ${describeInput(inputPath)} contains control characters or backslashes.`,
    );
  }

  const scheme = destination.match(/^([A-Za-z][A-Za-z\d+.-]*):/);

  if (scheme) {
    if (!/^https?:$/i.test(`${scheme[1]}:`)) {
      throw redirectError(
        `redirect destination "${value}" in ${describeInput(inputPath)} uses the unsafe or unsupported ${scheme[1]}: scheme; only HTTP, HTTPS, and internal paths are allowed.`,
      );
    }

    if (!/^https?:\/\//i.test(destination)) {
      throw redirectError(
        `redirect destination "${value}" in ${describeInput(inputPath)} is not a valid absolute HTTP or HTTPS URL.`,
      );
    }

    try {
      const parsed = new URL(destination);
      if (!parsed.hostname) {
        throw new Error("missing hostname");
      }
    } catch {
      throw redirectError(
        `redirect destination "${value}" in ${describeInput(inputPath)} is not a valid absolute HTTP or HTTPS URL.`,
      );
    }

    return destination;
  }

  if (destination.startsWith("//")) {
    throw redirectError(
      `redirect destination "${value}" in ${describeInput(inputPath)} must include http: or https: for an external URL.`,
    );
  }

  return destination.startsWith("/") ? destination : `/${destination}`;
}

export function isExternalDestination(destination) {
  return /^https?:\/\//i.test(destination);
}

export function applyRedirectPathPrefix(destination, pathPrefix = "/") {
  if (isExternalDestination(destination) || pathPrefix === "/") {
    return destination;
  }

  const suffixIndex = destination.search(/[?#]/);
  const pathname = suffixIndex < 0 ? destination : destination.slice(0, suffixIndex);

  if (pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`)) {
    return destination;
  }

  return `${pathPrefix}${destination}`;
}

export function redirectSourceToOutputPath(source) {
  const relativePath = source.replace(/^\/+/, "");

  if (!relativePath || source.endsWith("/")) {
    return path.posix.join(relativePath, "index.html");
  }

  return relativePath;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function serializeJavaScriptString(value) {
  return JSON.stringify(String(value))
    .replaceAll("<", "\\u003C")
    .replaceAll(">", "\\u003E")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function renderRedirectDocument(destination) {
  const escapedDestination = escapeHtml(destination);
  const serializedDestination = serializeJavaScriptString(destination);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Redirecting&hellip;</title>
    <link rel="canonical" href="${escapedDestination}">
    <meta name="robots" content="noindex">
    <meta http-equiv="refresh" content="0; url=${escapedDestination}">
    <script>window.location.replace(${serializedDestination});</script>
  </head>
  <body>
    <main>
      <h1>Redirecting&hellip;</h1>
      <p>If you are not redirected automatically, <a href="${escapedDestination}">continue to ${escapedDestination}</a>.</p>
    </main>
  </body>
</html>
`;
}

function isRedirectableItem(item) {
  if (
    !item ||
    typeof item.url !== "string" ||
    !item.url ||
    typeof item.outputPath !== "string" ||
    !item.outputPath
  ) {
    return false;
  }

  const extension = path.extname(item.outputPath).toLowerCase();
  return extension === "" || extension === ".htm" || extension === ".html";
}

function outputPathForUrl(url) {
  if (typeof url !== "string" || !url || url === "/") {
    return url === "/" ? "index.html" : null;
  }

  const pathname = url.split(/[?#]/, 1)[0];
  return redirectSourceToOutputPath(pathname);
}

function internalDestinationSource(destination, pathPrefix) {
  if (isExternalDestination(destination)) {
    return null;
  }

  const pathname = destination.split(/[?#]/, 1)[0] || "/";

  if (pathPrefix !== "/") {
    if (pathname === pathPrefix) {
      return "/";
    }

    if (pathname.startsWith(`${pathPrefix}/`)) {
      return pathname.slice(pathPrefix.length) || "/";
    }
  }

  return pathname;
}

function assertNotSelfRedirect(source, destination, entry, pathPrefix) {
  if (internalDestinationSource(destination, pathPrefix) === source) {
    throw redirectError(
      `self-redirect detected for "${source}" in ${describeInput(entry.inputPath)} (destination "${destination}").`,
    );
  }
}

function addMapping(registry, source, destination, entry, pathPrefix) {
  assertNotSelfRedirect(source, destination, entry, pathPrefix);

  const existing = registry.mappings.get(source);

  if (existing) {
    if (existing.destination === destination) {
      return false;
    }

    throw redirectError(
      `conflicting mappings for "${source}": ${describeInput(existing.inputPath)} targets "${existing.destination}", but ${describeInput(entry.inputPath)} targets "${destination}".`,
    );
  }

  registry.mappings.set(source, {
    ...entry,
    destination,
    source,
  });
  return true;
}

function assertNoRedirectLoops(registry, pathPrefix) {
  const visited = new Set();
  const visiting = new Set();

  function visit(source, chain) {
    if (visiting.has(source)) {
      const loopStart = chain.indexOf(source);
      const loop = [...chain.slice(loopStart), source];
      throw redirectError(`redirect loop detected: ${loop.join(" -> ")}.`);
    }

    if (visited.has(source)) {
      return;
    }

    const mapping = registry.mappings.get(source);
    if (!mapping) {
      visited.add(source);
      return;
    }

    visiting.add(source);
    const destinationSource = internalDestinationSource(
      mapping.destination,
      pathPrefix,
    );

    if (destinationSource && registry.mappings.has(destinationSource)) {
      visit(destinationSource, [...chain, source]);
    }

    visiting.delete(source);
    visited.add(source);
  }

  for (const source of registry.mappings.keys()) {
    visit(source, []);
  }
}

export function collectRedirectPages(items, options, registry) {
  registry.mappings.clear();
  registry.redirectToByOutputPath.clear();
  registry.generatedOutputPaths.clear();

  const realOutputs = new Map();

  for (const item of items) {
    if (typeof item?.url === "string" && item.url && item.outputPath) {
      const outputPath = outputPathForUrl(item.url);
      if (outputPath && !realOutputs.has(outputPath)) {
        realOutputs.set(outputPath, item);
      }
    }
  }

  const aliasPages = [];

  for (const item of items) {
    if (!isRedirectableItem(item)) {
      continue;
    }

    const inputPath = item.inputPath;
    const pageSource = normalizeRedirectSource(item.url, inputPath);
    const pageDestination = applyRedirectPathPrefix(
      normalizeRedirectDestination(item.url, inputPath),
      options.pathPrefix,
    );

    for (const source of normalizeRedirectFrom(
      item.data?.redirect_from,
      inputPath,
    )) {
      const mapping = {
        inputPath,
        kind: "redirect_from",
      };

      assertNotSelfRedirect(source, pageDestination, mapping, options.pathPrefix);

      const outputPath = redirectSourceToOutputPath(source);
      const realOutput = realOutputs.get(outputPath);

      if (realOutput) {
        throw redirectError(
          `generated alias "${source}" from ${describeInput(inputPath)} collides with the real Eleventy output from ${describeInput(realOutput.inputPath)}; both write "${outputPath}".`,
        );
      }

      if (
        addMapping(
          registry,
          source,
          pageDestination,
          mapping,
          options.pathPrefix,
        )
      ) {
        aliasPages.push({
          destination: pageDestination,
          kind: "redirect",
          source,
        });
        registry.generatedOutputPaths.add(outputPath);
      }
    }

    const redirectTo = normalizeRedirectTo(item.data?.redirect_to, inputPath);

    if (redirectTo) {
      const destination = applyRedirectPathPrefix(
        redirectTo,
        options.pathPrefix,
      );
      const mapping = {
        inputPath,
        kind: "redirect_to",
      };

      addMapping(
        registry,
        pageSource,
        destination,
        mapping,
        options.pathPrefix,
      );
      registry.redirectToByOutputPath.set(
        redirectSourceToOutputPath(pageSource),
        destination,
      );
    }
  }

  assertNoRedirectLoops(registry, options.pathPrefix);

  const hasSiteRedirectsJson =
    registry.siteHasRedirectsJson || realOutputs.has("redirects.json");

  if (options.redirects.json && !hasSiteRedirectsJson) {
    const redirectMap = Object.fromEntries(
      [...registry.mappings].map(([source, mapping]) => [
        source,
        mapping.destination,
      ]),
    );

    aliasPages.push({
      content: `${JSON.stringify(redirectMap, null, 2)}\n`,
      kind: "json",
      source: REDIRECTS_JSON_PATH,
    });
    registry.generatedOutputPaths.add("redirects.json");
  }

  return aliasPages;
}

function createRegistry() {
  return {
    generatedOutputPaths: new Set(),
    mappings: new Map(),
    previousGeneratedOutputPaths: new Set(),
    previousOutputDirectory: null,
    redirectToByOutputPath: new Map(),
    siteHasRedirectsJson: false,
  };
}

function safeOutputFile(outputDirectory, relativeOutputPath) {
  const outputRoot = path.resolve(outputDirectory);
  const outputFile = path.resolve(outputRoot, relativeOutputPath);
  const relative = path.relative(outputRoot, outputFile);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw redirectError(
      `refusing to clean an unsafe generated output path: "${relativeOutputPath}".`,
    );
  }

  return { outputFile, outputRoot };
}

async function removeEmptyParentDirectories(filePath, outputRoot) {
  let directory = path.dirname(filePath);

  while (directory !== outputRoot) {
    try {
      await rmdir(directory);
    } catch (error) {
      if (error.code === "ENOENT") {
        directory = path.dirname(directory);
        continue;
      }

      if (error.code === "ENOTEMPTY" || error.code === "EEXIST") {
        return;
      }

      throw error;
    }

    directory = path.dirname(directory);
  }
}

async function cleanPreviousRedirectOutputs(registry) {
  if (!registry.previousOutputDirectory) {
    return;
  }

  for (const relativeOutputPath of registry.previousGeneratedOutputPaths) {
    const { outputFile, outputRoot } = safeOutputFile(
      registry.previousOutputDirectory,
      relativeOutputPath,
    );

    try {
      await unlink(outputFile);
      await removeEmptyParentDirectories(outputFile, outputRoot);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  registry.previousGeneratedOutputPaths.clear();
}

async function sourceHasRedirectsJson(inputDirectory) {
  try {
    await access(path.resolve(inputDirectory, "redirects.json"));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export function registerRedirects(eleventyConfig, options) {
  const registry = createRegistry();

  eleventyConfig.on(
    "eleventy.before",
    async ({ directories, outputMode }) => {
      if (outputMode === "fs") {
        await cleanPreviousRedirectOutputs(registry);
      }

      registry.mappings.clear();
      registry.redirectToByOutputPath.clear();
      registry.generatedOutputPaths.clear();
      registry.siteHasRedirectsJson = await sourceHasRedirectsJson(
        directories.input,
      );
    },
  );

  eleventyConfig.addTemplate(
    VIRTUAL_TEMPLATE_PATH,
    (data) => {
      if (data.studioRedirectPage.kind === "json") {
        return data.studioRedirectPage.content;
      }

      return renderRedirectDocument(data.studioRedirectPage.destination);
    },
    {
      eleventyAllowMissingExtension: true,
      eleventyExcludeFromCollections: true,
      layout: false,
      pagination: {
        addAllPagesToCollections: false,
        alias: "studioRedirectPage",
        before(items) {
          return collectRedirectPages(items, options, registry);
        },
        data: "collections.all",
        size: 1,
      },
      permalink(data) {
        return data.studioRedirectPage.source;
      },
    },
  );

  eleventyConfig.addTransform("studioRedirectTo", function (content) {
    const outputPath = outputPathForUrl(this.url);
    const destination = registry.redirectToByOutputPath.get(outputPath);

    return destination ? renderRedirectDocument(destination) : content;
  });

  eleventyConfig.on(
    "eleventy.after",
    ({ directories, outputMode }) => {
      if (outputMode !== "fs") {
        return;
      }

      registry.previousGeneratedOutputPaths = new Set(
        registry.generatedOutputPaths,
      );
      registry.previousOutputDirectory = path.resolve(directories.output);
    },
  );
}
