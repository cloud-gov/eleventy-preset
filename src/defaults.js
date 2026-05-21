export const defaultPresetOptions = {
  pathPrefix: undefined,
  baseUrlEnvironmentVariable: "BASEURL",
  features: {
    baseUrlGlobalData: false,
    collections: true,
    filters: true,
    htmlBase: true,
    imageShortcodes: false,
    imageTransform: true,
    markdown: true,
    navigation: true,
    passthroughCopy: true,
    renderPlugin: false,
    rss: false,
    shortcodes: true,
    svgSprites: true,
    watchTargets: true,
    yamlData: true
  },
  passthroughCopy: ["admin", "uploads", "favicon.ico", "site.webmanifest", "img"],
  watchTargets: ["styles", "js"],
  markdown: {
    html: true,
    breaks: false,
    linkify: true,
    typographer: false,
    namedHeadings: true,
    pdfLinksNewWindow: false,
    markdownFilterName: "markdownify"
  },
  imageTransform: {
    failOnError: false,
    widths: ["auto", 600],
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
        decoding: "async"
      },
      pictureAttributes: {},
      fallback: "largest"
    }
  },
  collections: {
    postsByYear: {
      enabled: true,
      tag: "press-release",
      name: "postsByYear"
    }
  },
  imageShortcodes: {
    outputDir: "./_site/img/",
    includeCaption: false
  },
  baseUrlGlobalData: {
    dataFile: "./_data/site.yaml",
    globalName: "baseUrl",
    branchEnvironmentVariable: "BRANCH",
    domainsKey: "domains",
    localKey: "local",
    productionBranch: "main",
    productionKey: "prod",
    stagingKey: "staging"
  }
};

export function normalizePathPrefix(value) {
  let pathPrefix = value || "/";

  if (!pathPrefix.startsWith("/")) {
    pathPrefix = `/${pathPrefix}`;
  }

  return pathPrefix.replace(/\/+$/, "") || "/";
}

export function resolvePresetOptions(userOptions = {}, environment = process.env) {
  const envPathPrefix =
    userOptions.pathPrefix ??
    environment[userOptions.baseUrlEnvironmentVariable || defaultPresetOptions.baseUrlEnvironmentVariable];

  return {
    ...defaultPresetOptions,
    ...userOptions,
    pathPrefix: normalizePathPrefix(envPathPrefix),
    features: {
      ...defaultPresetOptions.features,
      ...(userOptions.features || {})
    },
    markdown: {
      ...defaultPresetOptions.markdown,
      ...(userOptions.markdown || {})
    },
    imageTransform: {
      ...defaultPresetOptions.imageTransform,
      ...(userOptions.imageTransform || {}),
      htmlOptions: {
        ...defaultPresetOptions.imageTransform.htmlOptions,
        ...(userOptions.imageTransform?.htmlOptions || {}),
        imgAttributes: {
          ...defaultPresetOptions.imageTransform.htmlOptions.imgAttributes,
          ...(userOptions.imageTransform?.htmlOptions?.imgAttributes || {})
        }
      }
    },
    collections: {
      ...defaultPresetOptions.collections,
      ...(userOptions.collections || {}),
      postsByYear: {
        ...defaultPresetOptions.collections.postsByYear,
        ...(userOptions.collections?.postsByYear || {})
      }
    },
    imageShortcodes: {
      ...defaultPresetOptions.imageShortcodes,
      ...(userOptions.imageShortcodes || {})
    },
    baseUrlGlobalData: {
      ...defaultPresetOptions.baseUrlGlobalData,
      ...(userOptions.baseUrlGlobalData || {})
    },
    passthroughCopy: userOptions.passthroughCopy ?? defaultPresetOptions.passthroughCopy,
    watchTargets: userOptions.watchTargets ?? defaultPresetOptions.watchTargets
  };
}
