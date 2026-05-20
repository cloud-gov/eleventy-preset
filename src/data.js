import fs from "node:fs";
import { parse } from "csv-parse/sync";
import yaml from "js-yaml";

export function registerDataExtensions(eleventyConfig, options) {
  if (options.features.yamlData) {
    eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  }

  if (options.features.csvData) {
    eleventyConfig.addDataExtension("csv", (contents) =>
      parse(contents, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
      })
    );
  }
}

export function registerBaseUrlGlobalData(eleventyConfig, options, environment = process.env) {
  if (!options.features.baseUrlGlobalData) {
    return;
  }

  const config = options.baseUrlGlobalData;
  const siteData = yaml.load(fs.readFileSync(config.dataFile, "utf8"));
  const domains = siteData?.[config.domainsKey] || {};
  const branch = environment[config.branchEnvironmentVariable];
  let baseUrl = domains[config.localKey];

  if (branch) {
    baseUrl =
      branch === config.productionBranch
        ? domains[config.productionKey]
        : `${domains[config.stagingKey]}/${branch}`;
  }

  eleventyConfig.addGlobalData(config.globalName, baseUrl);
}
