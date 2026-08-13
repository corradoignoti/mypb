// Minimal service worker: no caching, just enough for the browser to
// consider the app installable (Chrome's install-prompt criteria).
self.addEventListener("fetch", () => {});
