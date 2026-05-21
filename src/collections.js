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
}
