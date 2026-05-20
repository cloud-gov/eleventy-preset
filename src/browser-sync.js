import fs from "node:fs";

export function registerBrowserSync404(eleventyConfig, options) {
  if (!options.features.browserSync404) {
    return;
  }

  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function (err, browserSync) {
        const content404 = fs.readFileSync(options.browserSync404.file);

        browserSync.addMiddleware("*", (req, res) => {
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          res.write(content404);
          res.end();
        });
      }
    },
    ui: false,
    ghostMode: false
  });
}
