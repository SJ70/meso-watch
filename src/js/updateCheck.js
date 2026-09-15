const REPO = "SJ70/meso-watch";

function parseVersion(raw) {
  const match = String(raw || "").match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isNewer(latest, current) {
  if (!latest || !current) return false;
  for (let i = 0; i < 3; i++) {
    if (latest[i] > current[i]) return true;
    if (latest[i] < current[i]) return false;
  }
  return false;
}

async function fetchLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  const data = await response.json();
  return { version: data.tag_name, url: data.html_url };
}

// Checks the GitHub releases API for a newer published version than
// currentVersion. Called once per app launch - no periodic polling.
export async function checkForUpdate(currentVersion) {
  try {
    const { version, url } = await fetchLatestRelease();
    return isNewer(parseVersion(version), parseVersion(currentVersion)) ? { latestVersion: version, url } : null;
  } catch (error) {
    return null;
  }
}
