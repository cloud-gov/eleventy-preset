import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import autoprefixer from "autoprefixer";
import chokidar from "chokidar";
import esbuild from "esbuild";
import postcss from "postcss";
import * as sass from "sass";

const require = createRequire(import.meta.url);

function packageRoot(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    if (packageName === "@uswds/uswds") {
      return path.resolve(path.dirname(require.resolve(packageName)), "../..");
    }
    throw error;
  }
}

function uswdsRoot() {
  return packageRoot("@uswds/uswds");
}

export const defaultAssetOptions = {
  root: process.cwd(),
  outputDir: "_site/assets",
  production: process.env.ELEVENTY_ENV === "production",
  javascript: {
    entryPoints: {
      app: "js/app.js",
      admin: "js/admin.js",
      "uswds-init": "js/uswds-init.js"
    },
    outdir: "js",
    format: "iife",
    target: ["es2020"]
  },
  sass: {
    entryPoint: "styles/styles.scss",
    outdir: "styles",
    filename: "styles.css",
    quietDeps: true,
    silenceDeprecations: ["import", "global-builtin", "if-function"]
  },
  uswds: {
    copyAssets: true,
    fontsOutdir: "uswds/fonts",
    imgOutdir: "uswds/img"
  },
  watch: ["styles", "js"],
  watchOptions: {
    usePolling: true,
    interval: 250
  }
};

function resolveAssetOptions(userOptions = {}) {
  return {
    ...defaultAssetOptions,
    ...userOptions,
    javascript: {
      ...defaultAssetOptions.javascript,
      ...(userOptions.javascript || {}),
      entryPoints:
        userOptions.javascript?.entryPoints ?? defaultAssetOptions.javascript.entryPoints
    },
    sass: {
      ...defaultAssetOptions.sass,
      ...(userOptions.sass || {})
    },
    uswds: {
      ...defaultAssetOptions.uswds,
      ...(userOptions.uswds || {})
    },
    watch: userOptions.watch ?? defaultAssetOptions.watch,
    watchOptions: {
      ...defaultAssetOptions.watchOptions,
      ...(userOptions.watchOptions || {})
    }
  };
}

function fromRoot(options, target) {
  return path.isAbsolute(target) ? target : path.join(options.root, target);
}

function fromOutput(options, target) {
  return path.join(fromRoot(options, options.outputDir), target);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(source, destination) {
  await ensureDir(path.dirname(destination));
  await fs.cp(source, destination, { recursive: true });
}

export async function buildJavaScript(userOptions = {}) {
  const options = resolveAssetOptions(userOptions);
  const outdir = fromOutput(options, options.javascript.outdir);

  await ensureDir(outdir);

  const entryPoints = Object.fromEntries(
    Object.entries(options.javascript.entryPoints).map(([name, entryPoint]) => [
      name,
      fromRoot(options, entryPoint)
    ])
  );

  await esbuild.build({
    entryPoints,
    outdir,
    format: options.javascript.format,
    bundle: true,
    minify: options.production,
    sourcemap: !options.production,
    target: options.javascript.target
  });
}

export async function buildSass(userOptions = {}) {
  const options = resolveAssetOptions(userOptions);
  const rootUswds = uswdsRoot(options);
  const outdir = fromOutput(options, options.sass.outdir);

  await ensureDir(outdir);

  const result = sass.compile(fromRoot(options, options.sass.entryPoint), {
    style: options.production ? "compressed" : "expanded",
    sourceMap: !options.production,
    loadPaths: [
      path.dirname(rootUswds),
      path.join(rootUswds, "packages"),
      ...((options.sass.loadPaths || []).map((loadPath) => fromRoot(options, loadPath)))
    ],
    quietDeps: options.sass.quietDeps,
    silenceDeprecations: options.sass.silenceDeprecations
  });

  const cssPath = path.join(outdir, options.sass.filename);
  await fs.writeFile(cssPath, result.css);

  if (result.sourceMap) {
    await fs.writeFile(`${cssPath}.map`, JSON.stringify(result.sourceMap));
  }

  if (options.production) {
    await autoprefixStyles(cssPath, { sourceMap: false });
  }
}

export async function autoprefixStyles(cssPath, { sourceMap = false } = {}) {
  const css = await fs.readFile(cssPath, "utf8");
  const processed = await postcss([autoprefixer()]).process(css, {
    from: cssPath,
    to: cssPath,
    map: sourceMap ? { inline: false } : false
  });

  await fs.writeFile(cssPath, processed.css);
  if (processed.map) {
    await fs.writeFile(`${cssPath}.map`, processed.map.toString());
  }
}

export async function copyUswdsAssets(userOptions = {}) {
  const options = resolveAssetOptions(userOptions);
  const rootUswds = uswdsRoot(options);

  await copyDir(
    path.join(rootUswds, "dist", "fonts"),
    fromOutput(options, options.uswds.fontsOutdir)
  );

  await copyDir(
    path.join(rootUswds, "dist", "img"),
    fromOutput(options, options.uswds.imgOutdir)
  );
}

export async function buildAll(userOptions = {}) {
  const options = resolveAssetOptions(userOptions);

  await Promise.all([buildJavaScript(options), buildSass(options)]);

  if (options.uswds.copyAssets) {
    await copyUswdsAssets(options);
  }

  console.log("Assets have been built!");
}

export async function watchAssets(userOptions = {}) {
  const options = resolveAssetOptions(userOptions);

  if (!options.skipInitialBuild) {
    await buildAll(options);
  }

  let buildInProgress = false;
  let buildQueued = false;
  let debounceTimer;
  let pendingStyles = false;
  let pendingJavaScript = false;
  let pendingFullBuild = false;

  function queueChange(relPath) {
    const normalizedPath = relPath.replace(/\\/g, "/");

    if (normalizedPath.startsWith("styles/")) {
      pendingStyles = true;
      return;
    }

    if (normalizedPath.startsWith("js/")) {
      pendingJavaScript = true;
      return;
    }

    pendingFullBuild = true;
  }

  async function queueBuild(reason, relPath) {
    if (relPath) {
      queueChange(relPath);
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (buildInProgress) {
        buildQueued = true;
        return;
      }

      buildInProgress = true;
      try {
        if (reason) {
          console.log(`Asset change detected: ${reason}`);
        }

        const runFullBuild = pendingFullBuild;
        const runStyles = pendingStyles;
        const runJavaScript = pendingJavaScript;
        pendingFullBuild = false;
        pendingStyles = false;
        pendingJavaScript = false;

        if (runFullBuild) {
          await buildAll({ ...options, uswds: { ...options.uswds, copyAssets: false } });
        } else {
          const jobs = [];
          if (runStyles) jobs.push(buildSass(options));
          if (runJavaScript) jobs.push(buildJavaScript(options));
          if (jobs.length > 0) {
            await Promise.all(jobs);
            console.log("Assets have been built!");
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        buildInProgress = false;
        if (buildQueued) {
          buildQueued = false;
          await queueBuild("queued changes");
        }
      }
    }, 150);
  }

  const watcher = chokidar.watch(options.watch.map((target) => fromRoot(options, target)), {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50
    },
    ...options.watchOptions
  });

  watcher.on("all", (eventName, changedPath) => {
    const relPath = path.relative(options.root, changedPath);
    queueBuild(`${eventName} ${relPath}`, relPath);
  });

  console.log("Watching assets for changes...");
  return watcher;
}
