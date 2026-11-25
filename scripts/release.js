// `npm run release`: builds the app and publishes it to a GitHub release -
// the same flow electron-builder's `--publish always` gave:
//   - release tagged v<package.json version>, named "메소워치 <version>", created as a
//     draft (publish it by hand on GitHub, which also creates the tag)
//   - body taken from build/release-notes.md
//   - installer + portable exe uploaded as
//     meso-watch-<version>-setup.exe / meso-watch-<version>-portable.exe
// An existing draft for the same version is updated in place (assets
// replaced); an already published one is left alone.
// Needs GH_TOKEN (loaded from .env by the npm script).
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const { version } = pkg;
const tag = `v${version}`;
const [, owner, repo] = pkg.repository.url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
const token = process.env.GH_TOKEN;

if (!token) {
  console.error("GH_TOKEN is not set (see .env.example).");
  process.exit(1);
}

async function github(method, url, body, headers = {}) {
  const response = await fetch(url.startsWith("http") ? url : `https://api.github.com/repos/${owner}/${repo}${url}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body && !Buffer.isBuffer(body) ? JSON.stringify(body) : body,
  });
  if (!response.ok) throw new Error(`${method} ${url} -> ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function findRelease() {
  // Drafts have no tag yet, so /releases/tags/:tag can't see them - scan.
  for (let page = 1; ; page++) {
    const releases = await github("GET", `/releases?per_page=100&page=${page}`);
    const match = releases.find((release) => release.tag_name === tag);
    if (match || releases.length < 100) return match ?? null;
  }
}

async function main() {
  execSync("npx tauri build", { cwd: root, stdio: "inherit" });

  const releaseDir = path.join(root, "src-tauri", "target", "release");
  const nsisDir = path.join(releaseDir, "bundle", "nsis");
  const installer = fs.readdirSync(nsisDir).find((file) => file.includes(`_${version}_`) && file.endsWith("-setup.exe"));
  if (!installer) throw new Error(`no NSIS installer for ${version} in ${nsisDir}`);
  const assets = [
    { name: `meso-watch-${version}-setup.exe`, file: path.join(nsisDir, installer) },
    // The frontend is embedded in the binary, so the bare exe runs on its own.
    { name: `meso-watch-${version}-portable.exe`, file: path.join(releaseDir, "meso-watch.exe") },
  ];

  const notes = fs.readFileSync(path.join(root, "build", "release-notes.md"), "utf8");
  let release = await findRelease();
  if (release && !release.draft) {
    throw new Error(`${tag} is already published - bump the version (npm version patch) first.`);
  }
  if (release) {
    release = await github("PATCH", `/releases/${release.id}`, { body: notes });
    console.log(`Updating draft release ${tag}`);
  } else {
    release = await github("POST", "/releases", { tag_name: tag, name: `메소워치 ${version}`, body: notes, draft: true });
    console.log(`Created draft release ${tag}`);
  }

  for (const asset of assets) {
    const existing = release.assets.find((item) => item.name === asset.name);
    if (existing) await github("DELETE", `/releases/assets/${existing.id}`);
    const uploadUrl = release.upload_url.replace(/\{.*\}$/, `?name=${encodeURIComponent(asset.name)}`);
    await github("POST", uploadUrl, fs.readFileSync(asset.file), { "Content-Type": "application/octet-stream" });
    console.log(`Uploaded ${asset.name}`);
  }
  console.log(release.html_url);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
