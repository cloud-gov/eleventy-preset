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
    eleventyConfig.addPlugin(pluginRss);
  }

  if (options.features.navigation) {
    eleventyConfig.addPlugin(pluginNavigation);
  }

  if (options.features.renderPlugin && eleventy.EleventyRenderPlugin) {
    eleventyConfig.addPlugin(eleventy.EleventyRenderPlugin);
  }

  if (options.features.htmlBase) {
    eleventyConfig.addPlugin(eleventy.EleventyHtmlBasePlugin, {
      baseHref: options.pathPrefix
    });
  }

  if (options.features.imageTransform) {
    eleventyConfig.addPlugin(eleventyImageTransformPlugin, options.imageTransform);
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
