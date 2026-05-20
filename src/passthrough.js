export function registerPassthroughCopy(eleventyConfig, options) {
  for (const target of options.passthroughCopy) {
    eleventyConfig.addPassthroughCopy(target);
  }
}

export function registerWatchTargets(eleventyConfig, options) {
  for (const target of options.watchTargets) {
    eleventyConfig.addWatchTarget(target);
  }
}
