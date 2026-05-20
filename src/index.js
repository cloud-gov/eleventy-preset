import { registerCollections } from "./collections.js";
import { registerBaseUrlGlobalData, registerDataExtensions } from "./data.js";
import { resolvePresetOptions, defaultPresetOptions, normalizePathPrefix } from "./defaults.js";
import { registerFilters } from "./filters.js";
import { registerMarkdown } from "./markdown.js";
import { registerPassthroughCopy, registerWatchTargets } from "./passthrough.js";
import { registerOfficialPlugins, registerSvgSprites } from "./plugins.js";
import { registerShortcodes } from "./shortcodes.js";

export { buildAll, buildJavaScript, buildSass, copyUswdsAssets, watchAssets } from "./assets.js";
export { defaultPresetOptions, normalizePathPrefix, resolvePresetOptions };

export default async function studioEleventyPreset(eleventyConfig, userOptions = {}) {
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

  registerDataExtensions(eleventyConfig, options);
  registerBaseUrlGlobalData(eleventyConfig, options);

  if (options.features.filters) {
    registerFilters(eleventyConfig, options);
  }

  if (options.features.markdown) {
    registerMarkdown(eleventyConfig, options);
  }

  if (options.features.shortcodes) {
    registerShortcodes(eleventyConfig, options);
  }

  if (options.features.collections) {
    registerCollections(eleventyConfig, options);
  }
}
