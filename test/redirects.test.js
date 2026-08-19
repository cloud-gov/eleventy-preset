import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import Eleventy from "@11ty/eleventy";
import {
  defaultPresetOptions,
  resolvePresetOptions,
} from "../src/defaults.js";
import studioEleventyPreset from "../src/index.js";
import {
  applyRedirectPathPrefix,
  normalizeRedirectFrom,
  normalizeRedirectSource,
  normalizeRedirectTo,
  redirectSourceToOutputPath,
  renderRedirectDocument,
} from "../src/redirects.js";

const minimalFeatures = {
  collections: false,
  filters: false,
  htmlBase: false,
  imageShortcodes: false,
  imageTransform: false,
  navigation: false,
  passthroughCopy: false,
  redirects: true,
  rss: false,
  shortcodes: false,
  svgSprites: false,
  watchTargets: false,
  yamlData: false,
};

async function createVirtualSite(
  templates,
  { features = {}, pathPrefix = "/", redirects } = {},
) {
  const inputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-redirect-input-"),
  );
  const outputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-redirect-output-"),
  );
  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    quietMode: true,
    config: async (eleventyConfig) => {
      await studioEleventyPreset(eleventyConfig, {
        features: { ...minimalFeatures, ...features },
        pathPrefix,
        ...(redirects ? { redirects } : {}),
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
    inputDirectory,
    outputDirectory,
    async cleanup() {
      await Promise.all([
        rm(inputDirectory, { force: true, recursive: true }),
        rm(outputDirectory, { force: true, recursive: true }),
      ]);
    },
  };
}

function resultsByUrl(results) {
  return new Map(results.map((result) => [result.url, result]));
}

function fullErrorText(error) {
  const messages = [];
  const seen = new Set();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    messages.push(current.stack || current.message || String(current));
    current = current.originalError || current.cause;
  }

  return messages.join("\n");
}

async function assertBuildRejects(site, pattern) {
  await assert.rejects(site.eleventy.toJSON(), (error) => {
    assert.match(fullErrorText(error), pattern);
    return true;
  });
}

test("redirect options are enabled by default and merge independently", () => {
  assert.equal(defaultPresetOptions.features.redirects, true);
  assert.deepEqual(defaultPresetOptions.redirects, { json: true });

  const options = resolvePresetOptions({
    features: { collections: false, redirects: true },
    redirects: { json: false },
  });

  assert.equal(options.features.collections, false);
  assert.equal(options.features.redirects, true);
  assert.equal(options.features.filters, true);
  assert.deepEqual(options.redirects, { json: false });
});

test("disabled redirects leave redirect frontmatter and output unchanged", async () => {
  const site = await createVirtualSite(
    [
      {
        path: "page.md",
        content: "# Original response",
        data: {
          permalink: "/current/",
          redirect_from: "/old/",
          redirect_to: "/elsewhere/",
        },
      },
    ],
    { features: { redirects: false } },
  );

  try {
    const results = await site.eleventy.toJSON();
    const pages = resultsByUrl(results);

    assert.deepEqual([...pages.keys()], ["/current/"]);
    assert.match(pages.get("/current/").content, /<h1[^>]*>Original response<\/h1>/);
    assert.doesNotMatch(pages.get("/current/").content, /Redirecting/);
  } finally {
    await site.cleanup();
  }
});

test("normalizers preserve Jekyll forms and output-path distinctions", () => {
  assert.deepEqual(
    normalizeRedirectFrom([null, "old", "/old/", "old", "/old.html"]),
    ["/old", "/old/", "/old.html"],
  );
  assert.equal(normalizeRedirectTo([null, "/first/", "/second/"]), "/first/");
  assert.equal(normalizeRedirectTo("https://example.gov/new"), "https://example.gov/new");
  assert.equal(redirectSourceToOutputPath("/old/"), "old/index.html");
  assert.equal(redirectSourceToOutputPath("/old"), "old");
  assert.equal(redirectSourceToOutputPath("/old.html"), "old.html");
});

test("path prefixes apply exactly once only to internal destinations", () => {
  assert.equal(applyRedirectPathPrefix("/new/", "/"), "/new/");
  assert.equal(applyRedirectPathPrefix("/new/", "/agency"), "/agency/new/");
  assert.equal(
    applyRedirectPathPrefix("/agency/new/?a=1", "/agency"),
    "/agency/new/?a=1",
  );
  assert.equal(
    applyRedirectPathPrefix("https://example.gov/new", "/agency"),
    "https://example.gov/new",
  );
});

test("redirect document is complete and escapes HTML and JavaScript contexts", () => {
  const hostileDestination = `/next/?q="</script><img src=x onerror=alert(1)>&x='`;
  const html = renderRedirectDocument(hostileDestination);

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<title>Redirecting&hellip;<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta http-equiv="refresh" content="0; url=/);
  assert.match(html, /<link rel="canonical" href="/);
  assert.match(html, /<h1>Redirecting&hellip;<\/h1>/);
  assert.match(html, /<a href="/);
  assert.match(html, /&quot;&lt;\/script&gt;&lt;img/);
  assert.match(html, /&amp;x=&#39;/);
  assert.match(html, /window\.location\.replace\("\/next\/\?q=\\"\\u003C\/script\\u003E\\u003Cimg/);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(html, /<img src=x/);
});

test("unsafe destinations and malformed redirect sources fail actionably", () => {
  assert.throws(
    () => normalizeRedirectTo("javascript:alert(1)", "unsafe.md"),
    /unsafe or unsupported javascript: scheme/,
  );
  assert.throws(
    () => normalizeRedirectTo("http://", "unsafe.md"),
    /not a valid absolute HTTP or HTTPS URL/,
  );
  assert.throws(
    () => normalizeRedirectTo("http:example.gov", "unsafe.md"),
    /not a valid absolute HTTP or HTTPS URL/,
  );
  assert.throws(
    () => normalizeRedirectSource("/old/?query=1", "bad.md"),
    /cannot contain a query string or fragment/,
  );
  assert.throws(
    () => normalizeRedirectSource("/old/#fragment", "bad.md"),
    /cannot contain a query string or fragment/,
  );
  assert.throws(
    () => normalizeRedirectSource("/old/../secret", "bad.md"),
    /path traversal/,
  );
  assert.throws(
    () => normalizeRedirectSource("/%2e%2e/secret", "bad.md"),
    /path traversal/,
  );
  assert.throws(
    () => normalizeRedirectSource("https://example.gov/old", "bad.md"),
    /must be a site path/,
  );
  assert.throws(
    () => normalizeRedirectSource('/old/<script>"', "bad.md"),
    /invalid URL-path characters/,
  );
});

test("real Eleventy build supports redirect_from, redirect_to, both fields, and redirects.json", async () => {
  const site = await createVirtualSite([
    {
      path: "scalar.md",
      content: "# Scalar target",
      data: { permalink: "/scalar/", redirect_from: "/scalar-old/" },
    },
    {
      path: "array.md",
      content: "# Array target",
      data: {
        permalink: "/array/",
        redirect_from: [
          null,
          "/array-old/",
          "/array-extensionless",
          "/array-old.html",
          "/array-old/",
        ],
      },
    },
    {
      path: "both.md",
      content: "# Must be replaced",
      data: {
        permalink: "/both/",
        redirect_from: ["/both-old/", "/representative-old/"],
        redirect_to: [null, "/final/", "/unused/"],
      },
    },
    {
      path: "external.md",
      content: "# Must also be replaced",
      data: {
        permalink: "/external.html",
        redirect_to: "https://example.gov/new-location/?a=1&b=2",
      },
    },
    {
      path: "hidden.md",
      content: "# Collection-only",
      data: { permalink: false, redirect_from: "/ignored/" },
    },
    {
      path: "feed.md",
      content: "feed response",
      data: {
        permalink: "/feed.xml",
        redirect_from: "/feed-old/",
        redirect_to: "/not-applied/",
      },
    },
  ]);

  try {
    const results = await site.eleventy.toJSON();
    const pages = resultsByUrl(results);

    assert.equal(pages.get("/scalar-old/").content.includes("/scalar/"), true);
    assert.equal(pages.get("/array-old/").content.includes("/array/"), true);
    assert.equal(pages.get("/array-extensionless").content.includes("/array/"), true);
    assert.equal(pages.get("/array-old.html").content.includes("/array/"), true);
    assert.equal(
      path.relative(site.outputDirectory, pages.get("/array-old/").outputPath),
      "array-old/index.html",
    );
    assert.equal(
      path.relative(
        site.outputDirectory,
        pages.get("/array-extensionless").outputPath,
      ),
      "array-extensionless",
    );
    assert.equal(
      path.relative(site.outputDirectory, pages.get("/array-old.html").outputPath),
      "array-old.html",
    );

    assert.match(pages.get("/both-old/").content, /href="\/both\/"/);
    assert.match(pages.get("/both/").content, /href="\/final\/"/);
    assert.doesNotMatch(pages.get("/both/").content, /Must be replaced/);
    assert.match(
      pages.get("/external.html").content,
      /https:\/\/example\.gov\/new-location\/\?a=1&amp;b=2/,
    );
    assert.doesNotMatch(pages.get("/external.html").content, /Must also/);

    assert.equal(pages.has("/ignored/"), false);
    assert.equal(pages.has("/feed-old/"), false);
    assert.equal(pages.get("/feed.xml").content, "<p>feed response</p>\n");

    const redirectMap = JSON.parse(pages.get("/redirects.json").content);
    assert.deepEqual(redirectMap, {
      "/array-extensionless": "/array/",
      "/array-old.html": "/array/",
      "/array-old/": "/array/",
      "/both-old/": "/both/",
      "/both/": "/final/",
      "/external.html": "https://example.gov/new-location/?a=1&b=2",
      "/representative-old/": "/both/",
      "/scalar-old/": "/scalar/",
    });
  } finally {
    await site.cleanup();
  }
});

test("non-root pathPrefix resolves internal destinations without changing alias output paths", async () => {
  const site = await createVirtualSite(
    [
      {
        path: "target.md",
        content: "# Target",
        data: { permalink: "/target/", redirect_from: "/old/" },
      },
      {
        path: "already-prefixed.md",
        content: "# Replaced",
        data: { permalink: "/move/", redirect_to: "/agency/final/" },
      },
      {
        path: "external.md",
        content: "# Replaced",
        data: {
          permalink: "/external/",
          redirect_to: "https://example.gov/final/",
        },
      },
    ],
    { pathPrefix: "/agency" },
  );

  try {
    const pages = resultsByUrl(await site.eleventy.toJSON());
    const alias = pages.get("/old/");

    assert.match(alias.content, /\/agency\/target\//);
    assert.doesNotMatch(alias.content, /\/agency\/agency\//);
    assert.equal(
      path.relative(site.outputDirectory, alias.outputPath),
      "old/index.html",
    );
    assert.match(pages.get("/move/").content, /\/agency\/final\//);
    assert.doesNotMatch(pages.get("/move/").content, /\/agency\/agency\//);
    assert.match(
      pages.get("/external/").content,
      /https:\/\/example\.gov\/final\//,
    );
  } finally {
    await site.cleanup();
  }
});

test("HTML base processing does not duplicate a non-root redirect pathPrefix", async () => {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-redirect-html-base-"),
  );
  const inputDirectory = path.join(rootDirectory, "site");
  const outputDirectory = path.join(rootDirectory, "output");
  const configPath = path.join(rootDirectory, "eleventy.config.mjs");
  const presetUrl = pathToFileURL(
    path.resolve("src/index.js"),
  ).href;

  await mkdir(inputDirectory, { recursive: true });
  await writeFile(
    configPath,
    `import studioEleventyPreset from ${JSON.stringify(presetUrl)};

export default async function (eleventyConfig) {
  await studioEleventyPreset(eleventyConfig, {
    pathPrefix: "/agency",
    features: ${JSON.stringify({ ...minimalFeatures, htmlBase: true })}
  });
  eleventyConfig.addTemplate("target.md", "# Target", {
    permalink: "/target/",
    redirect_from: "/old/"
  });
  eleventyConfig.addTemplate("move.md", "# Move", {
    permalink: "/move/",
    redirect_to: "/final/"
  });
}
`,
  );

  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    configPath,
    pathPrefix: "/agency",
    quietMode: true,
  });

  try {
    const pages = resultsByUrl(await eleventy.toJSON());

    for (const url of ["/old/", "/move/"]) {
      assert.match(pages.get(url).content, /\/agency\//);
      assert.doesNotMatch(pages.get(url).content, /\/agency\/agency\//);
    }
  } finally {
    await rm(rootDirectory, { force: true, recursive: true });
  }
});

test("redirects.json can be disabled and a site's own output is preserved", async (t) => {
  await t.test("json false", async () => {
    const site = await createVirtualSite(
      [
        {
          path: "page.md",
          content: "# Page",
          data: { permalink: "/page/", redirect_from: "/old/" },
        },
      ],
      { redirects: { json: false } },
    );

    try {
      const pages = resultsByUrl(await site.eleventy.toJSON());
      assert.equal(pages.has("/old/"), true);
      assert.equal(pages.has("/redirects.json"), false);
    } finally {
      await site.cleanup();
    }
  });

  await t.test("site output", async () => {
    const site = await createVirtualSite([
      {
        path: "page.md",
        content: "# Page",
        data: { permalink: "/page/", redirect_from: "/old/" },
      },
      {
        path: "site-redirects.11ty.js",
        content: () => '{"ownedBySite":true}',
        data: { permalink: "/redirects.json" },
      },
    ]);

    try {
      const pages = resultsByUrl(await site.eleventy.toJSON());
      assert.equal(pages.get("/redirects.json").content, '{"ownedBySite":true}');
    } finally {
      await site.cleanup();
    }
  });
});

test("duplicate mappings deduplicate while conflicts, self redirects, loops, and real-output collisions fail", async (t) => {
  await t.test("identical duplicates", async () => {
    const site = await createVirtualSite([
      {
        path: "page.md",
        content: "# Page",
        data: {
          permalink: "/page/",
          redirect_from: ["duplicate", "/duplicate", null, "duplicate"],
        },
      },
    ]);

    try {
      const results = await site.eleventy.toJSON();
      assert.equal(results.filter((result) => result.url === "/duplicate").length, 1);
      assert.deepEqual(JSON.parse(resultsByUrl(results).get("/redirects.json").content), {
        "/duplicate": "/page/",
      });
    } finally {
      await site.cleanup();
    }
  });

  await t.test("conflicting mappings", async () => {
    const site = await createVirtualSite([
      {
        path: "one.md",
        content: "# One",
        data: { permalink: "/one/", redirect_from: "/shared/" },
      },
      {
        path: "two.md",
        content: "# Two",
        data: { permalink: "/two/", redirect_from: "/shared/" },
      },
    ]);

    try {
      await assertBuildRejects(site, /conflicting mappings for "\/shared\/"[\s\S]*one\.md[\s\S]*two\.md/);
    } finally {
      await site.cleanup();
    }
  });

  await t.test("self redirect", async () => {
    const site = await createVirtualSite([
      {
        path: "self.md",
        content: "# Self",
        data: { permalink: "/self/", redirect_to: "/self/" },
      },
    ]);

    try {
      await assertBuildRejects(site, /self-redirect detected for "\/self\/"/);
    } finally {
      await site.cleanup();
    }
  });

  await t.test("loop", async () => {
    const site = await createVirtualSite([
      {
        path: "one.md",
        content: "# One",
        data: { permalink: "/one/", redirect_to: "/two/" },
      },
      {
        path: "two.md",
        content: "# Two",
        data: { permalink: "/two/", redirect_to: "/one/" },
      },
    ]);

    try {
      await assertBuildRejects(site, /redirect loop detected: \/one\/ -> \/two\/ -> \/one\//);
    } finally {
      await site.cleanup();
    }
  });

  await t.test("real output collision", async () => {
    const site = await createVirtualSite([
      {
        path: "target.md",
        content: "# Target",
        data: { permalink: "/target/", redirect_from: "/occupied/" },
      },
      {
        path: "occupied.md",
        content: "# Occupied",
        data: { permalink: "/occupied/" },
      },
    ]);

    try {
      await assertBuildRejects(
        site,
        /generated alias "\/occupied\/"[\s\S]*collides with the real Eleventy output[\s\S]*occupied\/index\.html/,
      );
    } finally {
      await site.cleanup();
    }
  });
});

test("a successful rebuild removes stale generated aliases", async () => {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-redirect-rebuild-"),
  );
  const inputDirectory = path.join(rootDirectory, "site");
  const outputDirectory = path.join(rootDirectory, "output");
  const pagePath = path.join(inputDirectory, "page.md");

  await mkdir(inputDirectory, { recursive: true });
  await writeFile(
    pagePath,
    `---
permalink: /current/
redirect_from: /old/
---
# Current
`,
  );

  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    quietMode: true,
    config: async (eleventyConfig) => {
      await studioEleventyPreset(eleventyConfig, {
        features: minimalFeatures,
      });
      eleventyConfig.setUseTemplateCache(false);
    },
  });

  try {
    await eleventy.write();
    await access(path.join(outputDirectory, "old", "index.html"));

    await writeFile(
      pagePath,
      `---
permalink: /current/
redirect_from: /new-alias
---
# Current
`,
    );
    eleventy.setIncrementalFile(pagePath);
    await eleventy.restart();
    await eleventy.write();

    await assert.rejects(
      access(path.join(outputDirectory, "old", "index.html")),
      /ENOENT/,
    );
    await access(path.join(outputDirectory, "new-alias"));
    assert.match(
      await readFile(path.join(outputDirectory, "new-alias"), "utf8"),
      /href="\/current\/"/,
    );
  } finally {
    await rm(rootDirectory, { force: true, recursive: true });
  }
});
