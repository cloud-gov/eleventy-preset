import path from "node:path";
import Image from "@11ty/eleventy-img";
import {
  normalizeAccordionData,
  parseAccordionAttributes,
  parseAccordionYaml,
  renderUswdsAccordion,
} from "./uswds-accordion.js";
import {
  normalizeCardGroupData,
  parseCardGroupYaml,
  renderUswdsCardGroup,
} from "./uswds-card-group.js";
import { escapeAttribute } from "./uswds-utils.js";

function getYouTubeEmbedUrl(videoUrl) {
  const url = new URL(videoUrl);
  const id = url.hostname.includes("youtu.be")
    ? url.pathname.replace(/^\//, "")
    : url.searchParams.get("v");

  if (!id) {
    throw new Error(`Unable to parse YouTube video id from ${videoUrl}`);
  }

  return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
}

function getRawTokenText(token) {
  if (!token || typeof token.input !== "string") {
    return "";
  }

  return token.input.slice(token.begin, token.end);
}

function createUswdsAccordionTag(markdownLibrary) {
  return (liquidEngine) => ({
    parse(tagToken, remainTokens) {
      this.attributeText = tagToken.args;
      this.accordionIndex = (tagToken.begin || 0) + 1;
      this.rawTokens = [];

      const stream = liquidEngine.parser
        .parseStream(remainTokens)
        .on("template", (template) => this.rawTokens.push(template.token))
        .on("tag:enduswds_accordion", () => stream.stop())
        .on("end", () => {
          throw new Error(`tag ${tagToken.raw} not closed`);
        });

      stream.start();
    },
    *render() {
      const body = this.rawTokens.map(getRawTokenText).join("");
      const data = normalizeAccordionData({
        ...parseAccordionAttributes(this.attributeText),
        ...parseAccordionYaml(body),
      });

      return renderUswdsAccordion(data, markdownLibrary, {
        accordionIndex: this.accordionIndex,
      });
    },
  });
}

function registerRawLiquidTag(eleventyConfig, liquidEngine, tagName, createTag) {
  let registered = false;

  if (eleventyConfig && typeof eleventyConfig.addLiquidTag === "function") {
    eleventyConfig.addLiquidTag(tagName, createTag);
    registered = true;
  }

  if (liquidEngine && typeof liquidEngine.registerTag === "function") {
    liquidEngine.registerTag(tagName, createTag(liquidEngine));
    registered = true;
  }

  if (!registered) {
    throw new Error(
      `Unable to register Liquid tag "${tagName}": neither eleventyConfig.addLiquidTag nor liquidEngine.registerTag is available.`,
    );
  }
}

function registerUswdsAccordionShortcode(
  eleventyConfig,
  liquidEngine,
  markdownLibrary,
) {
  registerRawLiquidTag(
    eleventyConfig,
    liquidEngine,
    "uswds_accordion",
    createUswdsAccordionTag(markdownLibrary),
  );
}

function createUswdsCardGroupTag(markdownLibrary) {
  return (liquidEngine) => ({
    parse(tagToken, remainTokens) {
      this.rawTokens = [];

      const stream = liquidEngine.parser
        .parseStream(remainTokens)
        .on("template", (template) => this.rawTokens.push(template.token))
        .on("tag:enduswds_card_group", () => stream.stop())
        .on("end", () => {
          throw new Error(`tag ${tagToken.raw} not closed`);
        });

      stream.start();
    },
    *render() {
      const body = this.rawTokens.map(getRawTokenText).join("");
      const data = normalizeCardGroupData(parseCardGroupYaml(body));

      return renderUswdsCardGroup(data, markdownLibrary);
    },
  });
}

function registerUswdsCardGroupShortcode(
  eleventyConfig,
  liquidEngine,
  markdownLibrary,
) {
  registerRawLiquidTag(
    eleventyConfig,
    liquidEngine,
    "uswds_card_group",
    createUswdsCardGroupTag(markdownLibrary),
  );
}

async function imageWithClassShortcode(src, cls, alt, outputDir) {
  const ext = path.extname(src);
  const fileType = ext.replace(".", "");

  const metadata = await Image(src, {
    formats: [fileType],
    outputDir
  });

  const data = metadata[fileType] ? metadata[fileType][0] : metadata.jpeg[0];
  return `<img src="${data.url}" class="${escapeAttribute(cls)}" alt="${escapeAttribute(
    alt
  )}" loading="lazy" decoding="async">`;
}

async function imageWithCaptionShortcode(src, cls, alt, caption, outputDir) {
  const ext = path.extname(src);
  const fileType = ext.replace(".", "");

  const metadata = await Image(src, {
    formats: [fileType],
    outputDir
  });

  const data = metadata[fileType] ? metadata[fileType][0] : metadata.jpeg[0];
  const figcaption = caption ? `<figcaption>${caption}</figcaption>` : "";

  return `<figure class="${escapeAttribute(cls)}">
        <img src="${data.url}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async">
        ${figcaption}
      </figure>`;
}

export function registerShortcodes(eleventyConfig, options, context = {}) {
  registerUswdsAccordionShortcode(
    eleventyConfig,
    context.liquidEngine,
    context.markdownLibrary,
  );
  registerUswdsCardGroupShortcode(
    eleventyConfig,
    context.liquidEngine,
    context.markdownLibrary,
  );

  eleventyConfig.addLiquidShortcode("uswds_icon", function (name, classes = "") {
    return `<svg class="usa-icon ${escapeAttribute(
      classes
    )}" aria-hidden="true" role="img"><use xlink:href="#svg-${escapeAttribute(name)}"></use></svg>`;
  });

  eleventyConfig.addShortcode("youtube", (videoUrl, title) => {
    const titleText = title ? ` for ${title}` : "";
    return `
<iframe class="yt-shortcode" src="${getYouTubeEmbedUrl(videoUrl)}" title="YouTube video player${escapeAttribute(
      titleText
    )}" frameborder="0" allowfullscreen></iframe>
`;
  });

  if (options.features.imageShortcodes) {
    const outputDir = options.imageShortcodes.outputDir;

    eleventyConfig.addLiquidShortcode("image", async (src, alt) =>
      imageWithClassShortcode(src, "", alt, outputDir)
    );
    eleventyConfig.addLiquidShortcode("image_with_class", async (src, cls, alt) =>
      imageWithClassShortcode(src, cls, alt, outputDir)
    );

    if (options.imageShortcodes.includeCaption) {
      eleventyConfig.addLiquidShortcode("image_with_caption", async (src, cls, alt, caption) =>
        imageWithCaptionShortcode(src, cls, alt, caption, outputDir)
      );
    }
  }
}
