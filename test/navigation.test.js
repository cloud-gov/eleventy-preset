import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Eleventy from "@11ty/eleventy";
import { defaultPresetOptions, resolvePresetOptions } from "../src/defaults.js";
import studioEleventyPreset from "../src/index.js";
import {
  createNavigationEntriesFilter,
  navigationHasCurrentDescendant,
  navigationIsCurrent,
  navigationKeyFromInputPath,
} from "../src/navigation.js";

const minimalFeatures = {
  collections: false,
  filters: false,
  htmlBase: false,
  imageShortcodes: false,
  imageTransform: false,
  markdown: false,
  navigation: true,
  passthroughCopy: false,
  redirects: false,
  rss: false,
  shortcodes: false,
  svgSprites: false,
  watchTargets: false,
  yamlData: false,
};

function navigationEntry(inputPath, title, eleventyNavigation, extra = {}) {
  return {
    inputPath,
    outputPath: `_site/${title.toLowerCase().replaceAll(" ", "-")}/index.html`,
    url: `/${title.toLowerCase().replaceAll(" ", "-")}/`,
    data: {
      title,
      page: { inputPath, url: `/${title.toLowerCase()}/` },
      eleventyNavigation,
    },
    ...extra,
  };
}

async function createNavigationSite(templates, options = {}) {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-navigation-"),
  );
  const inputDirectory = path.join(rootDirectory, "input");
  const outputDirectory = path.join(rootDirectory, "output");

  await mkdir(inputDirectory, { recursive: true });

  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    quietMode: true,
    config: async (eleventyConfig) => {
      await studioEleventyPreset(eleventyConfig, {
        features: minimalFeatures,
        ...options,
      });

      for (const template of templates) {
        eleventyConfig.addTemplate(
          template.path,
          template.content || "",
          template.data || {},
        );
      }
    },
  });

  return {
    eleventy,
    async cleanup() {
      await rm(rootDirectory, { force: true, recursive: true });
    },
  };
}

test("navigation options default and merge without changing the feature default", () => {
  assert.equal(defaultPresetOptions.features.navigation, true);
  assert.deepEqual(defaultPresetOptions.navigation, {
    contentDirectory: "content/pages",
  });

  const options = resolvePresetOptions({
    navigation: { contentDirectory: "pages" },
  });

  assert.equal(options.features.navigation, true);
  assert.deepEqual(options.navigation, { contentDirectory: "pages" });
});

test("path keys cover indexes, children, nesting, Windows paths, and custom roots", () => {
  assert.equal(
    navigationKeyFromInputPath("content/pages/index.md"),
    undefined,
  );
  assert.equal(
    navigationKeyFromInputPath("./content/pages/about.md"),
    "about",
  );
  assert.equal(
    navigationKeyFromInputPath("/workspace/content/pages/about/index.md"),
    "about",
  );
  assert.equal(
    navigationKeyFromInputPath(
      "C:\\workspace\\content\\pages\\about\\offices\\audit.md",
    ),
    "about/offices/audit",
  );
  assert.equal(
    navigationKeyFromInputPath("pages/services/index.liquid", "pages/"),
    "services",
  );
  assert.equal(
    navigationKeyFromInputPath("content/collections/about.md"),
    undefined,
  );
});

test("navigation entries derive hierarchy and preserve explicit compatible metadata", () => {
  const source = [
    navigationEntry("content/pages/index.md", "Home", { order: 1 }),
    navigationEntry("content/pages/about/index.md", "About", {
      key: "manual-about-key",
      order: 10,
      selfTitle: "About this office",
    }),
    navigationEntry("content/pages/about/offices/audit.md", "Office of Audit", {
      parent: "about/careers",
      title: "Audit",
      order: 20,
      url: "https://example.gov/audit",
      sideTitle: "Audit office",
      hideInSideNav: false,
      futureField: { enabled: true },
    }),
    navigationEntry("legacy/guide.md", "Legacy Guide", {
      key: "legacy-key",
      order: 30,
    }),
    navigationEntry("outside/untitled.md", "Title fallback", { order: 40 }),
    navigationEntry("content/pages/concise.md", "Concise", true),
  ];
  const snapshot = structuredClone(source);
  const result = createNavigationEntriesFilter()(source);

  assert.deepEqual(source, snapshot);
  assert.notEqual(result, source);
  assert.notEqual(result[0], source[0]);
  assert.equal(result[0].outputPath, source[0].outputPath);
  assert.deepEqual(result[0].data.eleventyNavigation, {
    order: 1,
    key: "Home",
    parent: undefined,
    title: "Home",
  });
  assert.deepEqual(result[1].data.eleventyNavigation, {
    key: "about",
    order: 10,
    selfTitle: "About this office",
    parent: undefined,
    title: "About",
  });
  assert.deepEqual(result[2].data.eleventyNavigation, {
    parent: "about/careers",
    title: "Audit",
    order: 20,
    url: "https://example.gov/audit",
    sideTitle: "Audit office",
    hideInSideNav: false,
    futureField: { enabled: true },
    key: "about/offices/audit",
  });
  assert.equal(result[3].data.eleventyNavigation.key, "legacy-key");
  assert.equal(result[3].data.eleventyNavigation.title, "Legacy Guide");
  assert.equal(result[4].data.eleventyNavigation.key, "Title fallback");
  assert.equal(result[5].data.eleventyNavigation.key, "concise");
  assert.equal(result[5].data.eleventyNavigation.title, "Concise");
});

test("missing, false, null, empty, and recursively blank navigation values opt out", () => {
  const entries = [
    navigationEntry("content/pages/missing.md", "Missing", undefined),
    navigationEntry("content/pages/false.md", "False", false),
    navigationEntry("content/pages/null.md", "Null", null),
    navigationEntry("content/pages/empty.md", "Empty", {}),
    navigationEntry("content/pages/array.md", "Array", ["not", "an", "object"]),
    navigationEntry("content/pages/blank.md", "Blank", {
      title: "  ",
      parent: null,
      future: { value: "" },
    }),
  ];

  const result = createNavigationEntriesFilter()(entries);

  for (const entry of result) {
    assert.equal(entry.data.eleventyNavigation, undefined);
  }
});

test("current URL comparison is exact apart from trailing slashes", () => {
  assert.equal(navigationIsCurrent("/", "/"), true);
  assert.equal(navigationIsCurrent("/about/", "/about"), true);
  assert.equal(navigationIsCurrent("/about///", "/about/"), true);
  assert.equal(navigationIsCurrent("/about", "/about/team"), false);
  assert.equal(navigationIsCurrent("", "/"), false);
});

test("current descendant detection searches every navigation depth", () => {
  const children = [
    {
      url: "/about/",
      children: [
        {
          url: "/about/offices/",
          children: [{ url: "/about/offices/audit/" }],
        },
      ],
    },
  ];

  assert.equal(
    navigationHasCurrentDescendant(children, "/about/offices/audit"),
    true,
  );
  assert.equal(navigationHasCurrentDescendant(children, "/elsewhere/"), false);
});

test("navigation feature registration remains immediate and controls Studio filters", async () => {
  const enabledCalls = { filters: [], plugins: [] };
  const enabledConfig = {
    addFilter(name) {
      enabledCalls.filters.push(name);
    },
    addPlugin(plugin, options) {
      enabledCalls.plugins.push({ plugin, options });
    },
    setLibrary() {},
  };

  await studioEleventyPreset(enabledConfig, { features: minimalFeatures });

  assert.deepEqual(enabledCalls.filters, [
    "studioNavigationEntries",
    "studioNavigationIsCurrent",
    "studioNavigationHasCurrentDescendant",
  ]);
  assert.equal(enabledCalls.plugins.length, 1);
  assert.deepEqual(enabledCalls.plugins[0].options, { immediate: true });

  const disabledFilters = [];
  await studioEleventyPreset(
    {
      addFilter(name) {
        disabledFilters.push(name);
      },
      setLibrary() {},
    },
    {
      features: { ...minimalFeatures, navigation: false },
    },
  );

  assert.deepEqual(disabledFilters, []);
});

test("real Liquid fixture delegates tree construction and ordering to the official plugin", async () => {
  const fixture = await readFile(
    new URL("fixtures/navigation.liquid", import.meta.url),
    "utf8",
  );
  const site = await createNavigationSite([
    {
      path: "content/pages/about/index.md",
      data: {
        title: "About",
        permalink: "/about/",
        eleventyNavigation: { order: 20 },
      },
    },
    {
      path: "content/pages/about/later.md",
      data: {
        title: "Later",
        permalink: "/about/later/",
        eleventyNavigation: { order: 20 },
      },
    },
    {
      path: "content/pages/about/first.md",
      data: {
        title: "First",
        permalink: "/about/first/",
        eleventyNavigation: { order: 10 },
      },
    },
    {
      path: "navigation.liquid",
      content: fixture,
      data: {
        permalink: "/navigation/",
        eleventyExcludeFromCollections: true,
      },
    },
  ]);

  try {
    const results = await site.eleventy.toJSON();
    const navigation = results.find((result) => result.url === "/navigation/");

    assert.ok(navigation);
    assert.match(navigation.content, /about\|About\|\/about\//);
    assert.ok(
      navigation.content.indexOf("about/first|First|/about/first/") <
        navigation.content.indexOf("about/later|Later|/about/later/"),
    );
  } finally {
    await site.cleanup();
  }
});

test("native collections.all navigation behavior remains unchanged", async () => {
  const site = await createNavigationSite([
    {
      path: "legacy.md",
      data: {
        title: "Legacy page title",
        permalink: "/legacy/",
        eleventyNavigation: {
          key: "legacy",
          title: "Legacy navigation title",
          order: 10,
        },
      },
    },
    {
      path: "native.liquid",
      content:
        "{% assign items = collections.all | eleventyNavigation %}{% for item in items %}{{ item.key }}|{{ item.title }}|{{ item.url }}{% endfor %}",
      data: {
        permalink: "/native/",
        eleventyExcludeFromCollections: true,
      },
    },
  ]);

  try {
    const results = await site.eleventy.toJSON();
    const native = results.find((result) => result.url === "/native/");

    assert.equal(
      native.content,
      "legacy|Legacy navigation title|/legacy/",
    );
  } finally {
    await site.cleanup();
  }
});
