import path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetRoot = path.resolve(__dirname, "..");
const presetIncludesPath = path.join(presetRoot, "templates/includes");

export function registerSharedTemplates(eleventyConfig, options = {}) {
  if (!options.features.govBanner) {
    return;
  }

  eleventyConfig.setLibrary(
    "liquid",
    new Liquid({
      root: ["_includes", ".", presetIncludesPath],
      extname: ".html",
    }),
  );
}
