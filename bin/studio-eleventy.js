#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAll, watchAssets } from "../src/assets.js";
import { normalizePathPrefix } from "../src/defaults.js";

function readFlagValue(args, flagName) {
  const index = args.indexOf(flagName);
  return index >= 0 ? args[index + 1] : undefined;
}

function splitArgs(args) {
  const separator = args.indexOf("--");
  if (separator < 0) {
    return [args, []];
  }

  return [args.slice(0, separator), args.slice(separator + 1)];
}

function hasPathPrefixArg(args) {
  return args.some((arg) => arg === "--pathprefix" || arg.startsWith("--pathprefix="));
}

function readEleventyOutputDir(args) {
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  if (outputArg) {
    return outputArg.slice("--output=".length);
  }

  const outputValue = readFlagValue(args, "--output") || readFlagValue(args, "-o");
  return outputValue || "_site";
}

async function cleanOutputDir(args) {
  const outputDir = readEleventyOutputDir(args);
  const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
  const projectRoot = path.resolve(process.cwd());

  if (absoluteOutputDir === projectRoot || absoluteOutputDir === path.parse(absoluteOutputDir).root) {
    throw new Error(`Refusing to clean unsafe Eleventy output directory: ${outputDir}`);
  }

  await fs.promises.rm(absoluteOutputDir, { recursive: true, force: true });
}

function withDefaultPathPrefix(args, env) {
  if (!env.BASEURL || hasPathPrefixArg(args)) {
    return args;
  }

  return [...args, "--pathprefix", normalizePathPrefix(env.BASEURL)];
}

async function loadConfig(configPath) {
  if (!configPath) {
    return {};
  }

  const absolutePath = path.resolve(process.cwd(), configPath);
  const module = await import(pathToFileURL(absolutePath).href);
  return module.default || module.assetOptions || {};
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, env);

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function resolveCommand(command) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  const localCommand = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    `${command}${extension}`
  );

  return fs.existsSync(localCommand) ? localCommand : command;
}

function spawnCommand(command, args, env) {
  return spawn(resolveCommand(command), args, {
    env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });
}

function waitForSpawn(child) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      child.off("error", onError);
      child.off("spawn", onSpawn);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onSpawn() {
      cleanup();
      resolve();
    }

    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill();
}

async function runBuild(args) {
  const [studioArgs, eleventyArgs] = splitArgs(args);
  const env = {
    ...process.env,
    ELEVENTY_ENV: process.env.ELEVENTY_ENV || "production"
  };
  const options = await loadConfig(readFlagValue(studioArgs, "--config"));

  await cleanOutputDir(eleventyArgs);
  await buildAll({
    ...options,
    production: env.ELEVENTY_ENV === "production"
  });
  await run("eleventy", withDefaultPathPrefix(eleventyArgs, env), env);
}

async function runDev(args) {
  const [studioArgs, eleventyArgs] = splitArgs(args);
  const env = {
    ...process.env,
    ELEVENTY_ENV: process.env.ELEVENTY_ENV || "development"
  };
  const options = await loadConfig(readFlagValue(studioArgs, "--config"));
  const serveArgs = withDefaultPathPrefix(
    eleventyArgs.length ? eleventyArgs : ["--serve", "--watch"],
    env
  );

  await cleanOutputDir(serveArgs);
  await buildAll({
    ...options,
    production: false
  });

  const eleventy = spawnCommand("eleventy", serveArgs, env);
  let watcher;

  await waitForSpawn(eleventy);

  watcher = await watchAssets({
    ...options,
    production: false,
    skipInitialBuild: true
  });

  watcher.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
    stopChild(eleventy);
  });

  process.on("SIGINT", () => {
    stopChild(eleventy);
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stopChild(eleventy);
    process.exit(143);
  });

  try {
    await new Promise((resolve, reject) => {
      eleventy.on("error", reject);
      eleventy.on("exit", (code, signal) => {
        if (signal) {
          reject(new Error(`eleventy exited with signal ${signal}`));
          return;
        }

        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`eleventy exited with code ${code}`));
      });
    });
  } finally {
    await watcher.close();
  }

  process.exit(0);
}

async function runAssets(args) {
  const options = await loadConfig(readFlagValue(args, "--config"));

  if (args.includes("--watch")) {
    await watchAssets({
      ...options,
      skipInitialBuild: args.includes("--skip-initial")
    });
    return;
  }

  await buildAll(options);
}

function printUsage() {
  console.error(`Usage:
  studio-eleventy build [--config ./asset.config.js] [-- <eleventy args>]
  studio-eleventy dev [--config ./asset.config.js] [-- <eleventy args>]
  studio-eleventy assets [--config ./asset.config.js] [--watch] [--skip-initial]`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "build") {
    await runBuild(args);
  } else if (command === "dev") {
    await runDev(args);
  } else if (command === "assets") {
    await runAssets(args);
  } else {
    printUsage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
