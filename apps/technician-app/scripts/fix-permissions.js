"use strict";

const fs = require("fs");
const path = require("path");

const binPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "bare-pack",
  "bin.js"
);

try {
  fs.chmodSync(binPath, 0o755);
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}
