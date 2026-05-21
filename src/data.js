import yaml from "js-yaml";

export function registerDataExtensions(eleventyConfig, options) {
  if (options.features.yamlData) {
    eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  }
}
