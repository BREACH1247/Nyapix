const fs = require("node:fs");
const path = require("node:path");
const source = path.dirname(require.resolve("three"));
const target = path.join(__dirname, "../src/vendor/three");
fs.mkdirSync(target, { recursive: true });
for (const name of ["three.module.js", "three.core.js"]) fs.copyFileSync(path.join(source, name), path.join(target, name));
fs.copyFileSync(path.join(source, "../LICENSE"), path.join(target, "LICENSE"));
