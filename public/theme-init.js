(() => {
  try {
    const savedTheme = globalThis.localStorage.getItem("mizan-theme");
    const prefersDark = globalThis.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const useDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    if (useDark) globalThis.document.documentElement.dataset.theme = "dark";
    globalThis.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", useDark ? "#10111A" : "#F7F8FC");
  } catch {
    // The app remains usable when storage or media queries are unavailable.
  }
})();
