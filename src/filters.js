import { DateTime } from "luxon";

export function filterTagList(tags, ignoredTags = ["all", "nav", "post", "posts"]) {
  return (tags || []).filter((tag) => !ignoredTags.includes(tag));
}

export function registerFilters(eleventyConfig, options) {
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("dd LLL yyyy");
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("head", (array, n) => {
    if (!Array.isArray(array) || array.length === 0) {
      return [];
    }

    if (n < 0) {
      return array.slice(n);
    }

    return array.slice(0, n);
  });

  eleventyConfig.addFilter("min", (...numbers) => Math.min.apply(null, numbers));

  eleventyConfig.addFilter("filterTagList", (tags) =>
    filterTagList(tags, options.collections.tagList.ignoredTags)
  );
}
