#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAll, watchAssets } from "../src/assets.js";

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

  await buildAll({
    ...options,
    production: env.ELEVENTY_ENV === "production"
  });
  await run("eleventy", eleventyArgs, env);
}

async function runDev(args) {
  const [studioArgs, eleventyArgs] = splitArgs(args);
  const env = {
    ...process.env,
    ELEVENTY_ENV: process.env.ELEVENTY_ENV || "development"
  };
  const options = await loadConfig(readFlagValue(studioArgs, "--config"));
  const serveArgs = eleventyArgs.length ? eleventyArgs : ["--serve", "--watch"];

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

function printUsage() {
  console.error(`Usage:
  studio-eleventy build [--config ./asset.config.js] [-- <eleventy args>]
  studio-eleventy dev [--config ./asset.config.js] [-- <eleventy args>]`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "build") {
    await runBuild(args);
  } else if (command === "dev") {
    await runDev(args);
  } else {
    printUsage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
