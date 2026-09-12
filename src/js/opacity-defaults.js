// Plain (non-module) script so the pre-paint bootstrap in index.html's <head>
// can read these synchronously before first paint, without waiting on a
// deferred ES module load (which would let the wrong background flash
// briefly). constants.js reads the same values back out via window, so
// there's still a single canonical source for these numbers.
window.mesoWatchOpacityDefaults = {
  bgOpacityElectron: 0,
  panelOpacityElectron: 90,
  bgOpacityWeb: 100,
  panelOpacityWeb: 100,
};
