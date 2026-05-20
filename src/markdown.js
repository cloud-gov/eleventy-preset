import markdownIt from "markdown-it";
import markdownItLinkAttributes from "markdown-it-link-attributes";
import markdownItNamedHeadings from "markdown-it-named-headings";

export function createMarkdownLibrary(options) {
  const markdownLibrary = markdownIt({
    html: options.html,
    breaks: options.breaks,
    linkify: options.linkify,
    typographer: options.typographer
  });

  if (options.namedHeadings) {
    markdownLibrary.use(markdownItNamedHeadings);
  }

  if (options.pdfLinksNewWindow) {
    markdownLibrary.use(markdownItLinkAttributes, {
      matcher(href) {
        return href.endsWith("pdf");
      },
      attrs: {
        target: "_blank"
      }
    });
  }

  return markdownLibrary;
}

export function registerMarkdown(eleventyConfig, options) {
  const markdownLibrary = createMarkdownLibrary(options.markdown);
  const filterName = options.markdown.markdownFilterName || "markdownify";

  eleventyConfig.setLibrary("md", markdownLibrary);
  eleventyConfig.addFilter(filterName, (value) => markdownLibrary.render(value || ""));

  if (filterName !== "markdownify") {
    eleventyConfig.addFilter("markdownify", (value) => markdownLibrary.render(value || ""));
  }

  return markdownLibrary;
}
