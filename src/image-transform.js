import path from "node:path";

const ELEVENTY_IGNORE = "eleventy:ignore";
const ELEVENTY_OPTIONAL = "eleventy:optional";
const ORIGINAL_SOURCE = "data-studio-image-original-src";
const NORMALIZED_SOURCE = "data-studio-image-normalized-src";

function mergeClassNames(...values) {
  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string")
        .flatMap((value) => value.trim().split(/\s+/))
        .filter(Boolean),
    ),
  ].join(" ");
}

function isRemoteSource(source) {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeSource(source) {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function normalizeImageSource(source, inputDirectory, inputPath) {
  if (isRemoteSource(source)) {
    return source;
  }

  const decodedSource = decodeSource(source);

  if (path.isAbsolute(decodedSource)) {
    return path.join(inputDirectory, decodedSource);
  }

  return path.join(path.dirname(inputPath), decodedSource);
}

function prepareImageNode(node, options, context) {
  if (!node.attrs || node.attrs[ELEVENTY_IGNORE] !== undefined) {
    return node;
  }

  const responsiveImageClass = options.responsiveImageClass;

  if (responsiveImageClass) {
    node.attrs.class = mergeClassNames(
      node.attrs.class,
      responsiveImageClass,
    );
  }

  if (
    options.failOnError === false &&
    node.attrs.src &&
    !node.attrs.src.startsWith("data:") &&
    node.attrs[ELEVENTY_OPTIONAL] === undefined
  ) {
    node.attrs[ORIGINAL_SOURCE] = node.attrs.src;
    node.attrs[NORMALIZED_SOURCE] = normalizeImageSource(
      node.attrs.src,
      options.inputDirectory,
      context.page.inputPath,
    );
    node.attrs[ELEVENTY_OPTIONAL] = "keep";
  }

  return node;
}

function restoreFailedImageSource(node) {
  if (!node.attrs || node.attrs[ORIGINAL_SOURCE] === undefined) {
    return node;
  }

  if (node.attrs.src === node.attrs[NORMALIZED_SOURCE]) {
    node.attrs.src = node.attrs[ORIGINAL_SOURCE];
  }

  delete node.attrs[ORIGINAL_SOURCE];
  delete node.attrs[NORMALIZED_SOURCE];
  return node;
}

export function imageTransformPreparationPlugin(eleventyConfig, options) {
  eleventyConfig.htmlTransformer.addPosthtmlPlugin(
    options.extensions || "html",
    (context) => (tree) => {
      const transformOptions = {
        ...options,
        inputDirectory: eleventyConfig.directories.input,
      };

      tree.match({ tag: "img" }, (node) =>
        prepareImageNode(node, transformOptions, context),
      );
      return tree;
    },
    {
      name: "studioImageTransformPreparation",
      priority: 0,
    },
  );

  eleventyConfig.htmlTransformer.addPosthtmlPlugin(
    options.extensions || "html",
    () => (tree) => {
      tree.match({ tag: "img" }, restoreFailedImageSource);
      return tree;
    },
    {
      name: "studioImageTransformCleanup",
      priority: -1.5,
    },
  );
}
