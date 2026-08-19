import { registerCollections } from "./collections.js";
import { registerDataExtensions } from "./data.js";
import {
  resolvePresetOptions,
  defaultPresetOptions,
  normalizePathPrefix,
} from "./defaults.js";
import { registerFilters } from "./filters.js";
import { registerLiquid } from "./liquid.js";
import { registerMarkdown } from "./markdown.js";
import {
  registerPassthroughCopy,
  registerWatchTargets,
} from "./passthrough.js";
import { registerOfficialPlugins, registerSvgSprites } from "./plugins.js";
import { registerRedirects } from "./redirects.js";
import { registerShortcodes } from "./shortcodes.js";

export {
  buildAll,
  buildJavaScript,
  buildSass,
  copyUswdsAssets,
  watchAssets,
} from "./assets.js";
export { defaultPresetOptions, normalizePathPrefix, resolvePresetOptions };

export default async function studioEleventyPreset(
  eleventyConfig,
  userOptions = {},
) {
  const options = resolvePresetOptions(userOptions);

  if (options.features.passthroughCopy) {
    registerPassthroughCopy(eleventyConfig, options);
  }

  if (options.features.watchTargets) {
    registerWatchTargets(eleventyConfig, options);
  }

  await registerOfficialPlugins(eleventyConfig, options);

  if (options.features.svgSprites) {
    registerSvgSprites(eleventyConfig, options);
  }

  if (options.features.redirects) {
    registerRedirects(eleventyConfig, options);
  }

  registerDataExtensions(eleventyConfig, options);

  const liquidEngine = registerLiquid(eleventyConfig, options);

  if (options.features.filters) {
    registerFilters(eleventyConfig, options);
  }

  let markdownLibrary;

  if (options.features.markdown) {
    markdownLibrary = registerMarkdown(eleventyConfig, options);
  }

  if (options.features.shortcodes) {
    registerShortcodes(eleventyConfig, options, {
      liquidEngine,
      markdownLibrary,
    });
  }

  if (options.features.collections) {
    registerCollections(eleventyConfig, options);
  }
}
