// Apply the theme before rendering to avoid a light flash on dark-mode visits.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('comitadus-theme');
  } catch (_) {}
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();
