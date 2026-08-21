import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Eleventy from "@11ty/eleventy";
import {
  defaultPresetOptions,
  resolvePresetOptions,
} from "../src/defaults.js";

const presetUrl = new URL("../src/index.js", import.meta.url).href;

const minimalFeatures = {
  collections: false,
  filters: false,
  htmlBase: false,
  imageShortcodes: false,
  imageTransform: true,
  markdown: false,
  navigation: false,
  passthroughCopy: false,
  redirects: false,
  rss: false,
  shortcodes: false,
  svgSprites: false,
  watchTargets: false,
  yamlData: false,
};

async function createImageSite(html, imageTransform = {}, features = {}) {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), "eleventy-preset-image-transform-"),
  );
  const inputDirectory = path.join(rootDirectory, "input");
  const outputDirectory = path.join(rootDirectory, "output");
  const configPath = path.join(rootDirectory, "eleventy.config.cjs");

  await Promise.all([
    mkdir(inputDirectory, { recursive: true }),
    mkdir(outputDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(inputDirectory, "index.html"), html),
    writeFile(
      path.join(inputDirectory, "organization-chart.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="17584" height="5933" viewBox="0 0 17584 5933"><rect width="17584" height="5933" fill="white"/><path d="M0 0 17584 5933" stroke="black"/></svg>',
    ),
    writeFile(
      configPath,
      `module.exports = async function (eleventyConfig) {
  const { default: studioEleventyPreset } = await import(${JSON.stringify(presetUrl)});
  await studioEleventyPreset(eleventyConfig, ${JSON.stringify({
    features: { ...minimalFeatures, ...features },
    imageTransform,
  })});
};
`,
    ),
  ]);

  const eleventy = new Eleventy(inputDirectory, outputDirectory, {
    quietMode: true,
    configPath,
  });

  return {
    eleventy,
    async cleanup() {
      await rm(rootDirectory, { force: true, recursive: true });
    },
  };
}

function getImageTag(html, alt) {
  const match = html.match(new RegExp(`<img[^>]*alt="${alt}"[^>]*>`));
  assert.ok(match, `Expected an image with alt="${alt}" in ${html}`);
  return match[0];
}

function getNumericAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="(\\d+)"`));
  assert.ok(match, `Expected ${name} in ${tag}`);
  return Number(match[1]);
}

test("image transform defaults use finite widths and responsive USWDS behavior", () => {
  assert.deepEqual(defaultPresetOptions.imageTransform.widths, [600, 1200]);
  assert.equal(
    defaultPresetOptions.imageTransform.responsiveImageClass,
    "height-auto",
  );

  const options = resolvePresetOptions({
    imageTransform: { widths: [320, 640] },
  });

  assert.deepEqual(options.imageTransform.widths, [320, 640]);
  assert.equal(options.imageTransform.responsiveImageClass, "height-auto");
});

test("real Eleventy transforms preserve classes, ratios, safe widths, and source fallbacks", async () => {
  const site = await createImageSite(`<!doctype html>
<html><body>
  <img src="/organization-chart.svg" class="existing chart" alt="Chart">
  <img src="/missing.svg" class="missing" alt="Missing">
  <img src="/organization-chart.svg" loading="eager" alt="Late failure">
  <img src="/ignored.svg" class="icon" alt="Ignored" eleventy:ignore>
  <img src="/remove.svg" class="optional" alt="Optional" eleventy:optional>
</body></html>`);

  try {
    const [result] = await site.eleventy.toJSON();
    const chart = getImageTag(result.content, "Chart");
    const width = getNumericAttribute(chart, "width");
    const height = getNumericAttribute(chart, "height");

    assert.match(chart, /class="existing chart height-auto"/);
    assert.match(result.content, /600w/);
    assert.match(result.content, /1200w/);
    assert.doesNotMatch(result.content, /17584w/);
    assert.ok(Math.abs(width / height - 17584 / 5933) < 0.01);

    const missing = getImageTag(result.content, "Missing");
    assert.match(missing, /src="\/missing\.svg"/);
    assert.doesNotMatch(missing, /eleventy:/);

    const lateFailure = getImageTag(result.content, "Late failure");
    assert.match(lateFailure, /src="\/organization-chart\.svg"/);
    assert.doesNotMatch(lateFailure, /data-studio-image|eleventy:/);

    const ignored = getImageTag(result.content, "Ignored");
    assert.match(ignored, /src="\/ignored\.svg"/);
    assert.match(ignored, /class="icon"/);
    assert.doesNotMatch(ignored, /height-auto|eleventy:/);

    const optional = getImageTag(result.content, "Optional");
    assert.doesNotMatch(optional, /src=/);
    assert.doesNotMatch(optional, /eleventy:/);
  } finally {
    await site.cleanup();
  }
});

test("imageTransform false leaves image markup untouched", async () => {
  const site = await createImageSite(
    '<img src="/organization-chart.svg" class="existing" alt="Disabled">',
    {},
    { imageTransform: false },
  );

  try {
    const [result] = await site.eleventy.toJSON();
    const image = getImageTag(result.content, "Disabled");

    assert.match(image, /src="\/organization-chart\.svg"/);
    assert.match(image, /class="existing"/);
    assert.doesNotMatch(image, /height-auto|srcset=|width=|height=/);
  } finally {
    await site.cleanup();
  }
});

test("explicit consumer image overrides remain authoritative", async () => {
  const site = await createImageSite(
    '<img src="/organization-chart.svg" class="existing" alt="Override">',
    {
      formats: ["webp"],
      widths: [320, 640],
      responsiveImageClass: "custom-responsive",
      htmlOptions: {
        imgAttributes: {
          loading: "eager",
          fetchpriority: "high",
          sizes: "100vw",
        },
      },
    },
  );

  try {
    const [result] = await site.eleventy.toJSON();
    const image = getImageTag(result.content, "Override");

    assert.match(image, /class="existing custom-responsive"/);
    assert.match(image, /loading="eager"/);
    assert.match(image, /fetchpriority="high"/);
    assert.match(image, /320w/);
    assert.match(image, /640w/);
    assert.doesNotMatch(image, /1200w|height-auto/);
  } finally {
    await site.cleanup();
  }
});
