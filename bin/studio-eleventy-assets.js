#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAll, watchAssets } from "../src/assets.js";

function readFlagValue(args, flagName) {
  const index = args.indexOf(flagName);
  return index >= 0 ? args[index + 1] : undefined;
}

async function loadConfig(configPath) {
  if (!configPath) {
    return {};
  }

  const absolutePath = path.resolve(process.cwd(), configPath);
  const module = await import(pathToFileURL(absolutePath).href);
  return module.default || module.assetOptions || {};
}

const args = process.argv.slice(2);
const options = await loadConfig(readFlagValue(args, "--config"));

if (args.includes("--watch")) {
  await watchAssets({
    ...options,
    skipInitialBuild: args.includes("--skip-initial")
  });
} else {
  await buildAll(options);
}
