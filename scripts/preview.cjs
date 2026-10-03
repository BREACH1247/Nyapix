const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../src");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
};
http
  .createServer((req, res) => {
    let file;
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      file = path.resolve(
        root,
        `.${pathname === "/" ? "/settings/" : pathname}`,
      );
      if (file !== root && !file.startsWith(root + path.sep))
        throw new Error("Invalid path");
      if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(4173, "127.0.0.1", () =>
    console.log(
      "Nyapix settings: http://127.0.0.1:4173/settings/\nPlayground: http://127.0.0.1:4173/preview/",
    ),
  );
