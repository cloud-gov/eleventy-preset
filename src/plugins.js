import path from "node:path";
import { createRequire } from "node:module";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import pluginNavigation from "@11ty/eleventy-navigation";
import pluginRss from "@11ty/eleventy-plugin-rss";
import svgSprite from "eleventy-plugin-svg-sprite";

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

export async function registerOfficialPlugins(eleventyConfig, options) {
  const eleventy = await import("@11ty/eleventy");

  if (options.features.rss) {
    eleventyConfig.addPlugin(pluginRss, { immediate: true });
  }

  if (options.features.navigation) {
    eleventyConfig.addPlugin(pluginNavigation, { immediate: true });
  }

  if (options.features.renderPlugin && eleventy.EleventyRenderPlugin) {
    eleventyConfig.addPlugin(eleventy.EleventyRenderPlugin, { immediate: true });
  }

  if (options.features.htmlBase) {
    eleventyConfig.addPlugin(eleventy.EleventyHtmlBasePlugin, {
      baseHref: options.pathPrefix,
      immediate: true
    });

    if (options.pathPrefix !== "/") {
      eleventyConfig.addTransform("studioPathPrefixDedupe", (content) => {
        if (typeof content !== "string") {
          return content;
        }

        return content.split(`${options.pathPrefix}${options.pathPrefix}`).join(options.pathPrefix);
      });
    }
  }

  if (options.features.imageTransform) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
      ...options.imageTransform,
      immediate: true
    });
  }
}

export function registerSvgSprites(eleventyConfig) {
  const rootUswds = uswdsRoot();

  eleventyConfig.addPlugin(svgSprite, {
    path: path.join(rootUswds, "dist", "img", "uswds-icons"),
    svgSpriteShortcode: "uswds_icons_sprite",
    svgShortcode: "uswds_icons"
  });

  eleventyConfig.addPlugin(svgSprite, {
    path: path.join(rootUswds, "dist", "img", "usa-icons"),
    svgSpriteShortcode: "usa_icons_sprite",
    svgShortcode: "usa_icons"
  });
}
