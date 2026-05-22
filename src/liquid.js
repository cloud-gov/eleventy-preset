import { Liquid } from "liquidjs";
import { presetIncludesPath } from "./templates.js";

export function registerLiquid(eleventyConfig, options = {}) {
  const includesDir = options.directories?.includes ?? "_includes";

  eleventyConfig.setLibrary(
    "liquid",
    new Liquid({
      root: [includesDir, ".", presetIncludesPath],
      extname: ".html",
    }),
  );
}
