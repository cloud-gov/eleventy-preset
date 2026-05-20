import { filterTagList } from "./filters.js";

export function registerCollections(eleventyConfig, options) {
  const postsByYear = options.collections.postsByYear;

  if (postsByYear?.enabled) {
    eleventyConfig.addCollection(postsByYear.name, (collection) => {
      const posts = collection.getFilteredByTag(postsByYear.tag).reverse();
      const years = posts.map((post) => post.date.getFullYear());
      const uniqueYears = [...new Set(years)];

      return uniqueYears.map((year) => [
        year,
        posts.filter((post) => post.date.getFullYear() === year)
      ]);
    });
  }

  const tagList = options.collections.tagList;

  if (tagList?.enabled || options.features.tagList) {
    eleventyConfig.addCollection(tagList.name, (collection) => {
      const tagSet = new Set();
      collection.getAll().forEach((item) => {
        (item.data.tags || []).forEach((tag) => tagSet.add(tag));
      });

      return filterTagList([...tagSet], tagList.ignoredTags);
    });
  }
}
