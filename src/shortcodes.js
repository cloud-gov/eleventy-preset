import path from "node:path";
import Image from "@11ty/eleventy-img";

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

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

export function registerShortcodes(eleventyConfig, options) {
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

    eleventyConfig.addLiquidShortcode("image", (src, alt) =>
      imageWithClassShortcode(src, "", alt, outputDir)
    );
    eleventyConfig.addLiquidShortcode("image_with_class", (src, cls, alt) =>
      imageWithClassShortcode(src, cls, alt, outputDir)
    );

    if (options.imageShortcodes.includeCaption) {
      eleventyConfig.addLiquidShortcode("image_with_caption", (src, cls, alt, caption) =>
        imageWithCaptionShortcode(src, cls, alt, caption, outputDir)
      );
    }
  }
}
