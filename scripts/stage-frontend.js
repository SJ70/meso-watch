// Assembles the folder Tauri bundles as the app's frontend (dist-app/).
// The pages under src/ reference ../public and ../package.json, the same
// layout GitHub Pages serves the web version from, so that layout is kept
// here instead of pointing Tauri at the repo root (which would bundle
// node_modules and src-tauri/target).
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist-app");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, "src"), path.join(out, "src"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });
fs.copyFileSync(path.join(root, "src-tauri", "legacy", "legacy-import.html"), path.join(out, "legacy-import.html"));

// The app reads its version from ../package.json; ship only what it needs.
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({ name, version }, null, 2));
