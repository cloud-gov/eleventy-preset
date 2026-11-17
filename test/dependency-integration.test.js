import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Eleventy from "@11ty/eleventy";
import { buildAll } from "../src/assets.js";

test("updated dependencies build development and production USWDS and admin assets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "eleventy-preset-assets-"));
  const entries = {
    app: fileURLToPath(new URL("../src/uswds.js", import.meta.url)),
    admin: fileURLToPath(new URL("../src/admin.js", import.meta.url)),
    "uswds-init": fileURLToPath(new URL("../src/uswds-init.js", import.meta.url)),
  };

  try {
    await mkdir(path.join(root, "styles"));
    await writeFile(path.join(root, "styles/styles.scss"), `
@use "uswds-core" as * with (
  $theme-show-compile-warnings: false,
  $theme-show-notifications: false,
  $theme-font-path: "../uswds/fonts",
  $theme-image-path: "../uswds/img"
);
@forward "uswds";
`);

    for (const production of [false, true]) {
      const outputDir = production ? "production/assets" : "development/assets";
      await buildAll({
        root,
        outputDir,
        production,
        javascript: { entryPoints: entries },
      });
      const output = path.join(root, outputDir);
      for (const name of Object.keys(entries)) {
        const script = await readFile(path.join(output, `js/${name}.js`), "utf8");
        assert.ok(script.length > 0);
      }
      const css = await readFile(path.join(output, "styles/styles.css"), "utf8");
      assert.match(css, /\.usa-accordion/);
      assert.match(css, /\.usa-card/);
      assert.match(css, /\.usa-summary-box/);
      assert.ok((await readdir(path.join(output, "uswds/fonts"))).length > 0);
      assert.ok((await readdir(path.join(output, "uswds/img"))).length > 0);
      const scripts = await readdir(path.join(output, "js"));
      const styles = await readdir(path.join(output, "styles"));
      assert.equal(scripts.includes("admin.js.map"), !production);
      assert.equal(styles.includes("styles.css.map"), !production);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updated glob dependencies compile both USWDS sprites through real Eleventy registration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "eleventy-preset-sprites-"));
  const input = path.join(root, "input");
  const configPath = path.join(root, "eleventy.config.cjs");
  const presetUrl = new URL("../src/index.js", import.meta.url).href;

  try {
    await mkdir(input);
    await writeFile(path.join(input, "index.liquid"), `
{% usa_icons_sprite %}
{% uswds_icons_sprite %}
`);
    await writeFile(configPath, `module.exports = async function (config) {
  const { default: preset } = await import(${JSON.stringify(presetUrl)});
  await preset(config, { features: { rss: true } });
};`);
    const eleventy = new Eleventy(input, path.join(root, "output"), {
      configPath,
      quietMode: true,
    });
    const results = await eleventy.toJSON();
    const result = results.find((page) => page.inputPath.endsWith("index.liquid"));
    assert.ok(result);
    assert.match(result.content, /<svg\b/);
    assert.match(result.content, /<symbol\b/);
    assert.equal((result.content.match(/<svg\b/g) || []).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
