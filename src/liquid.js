import { Liquid } from "liquidjs";
import { presetIncludesPath } from "./templates.js";

export function registerLiquid(eleventyConfig, options = {}) {
  const includesDir = options.directories?.includes ?? "_includes";
  const liquidEngine = new Liquid({
    root: [includesDir, ".", presetIncludesPath],
    extname: ".html",
  });

  eleventyConfig.setLibrary("liquid", liquidEngine);

  return liquidEngine;
}
