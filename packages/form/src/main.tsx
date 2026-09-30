// Two independent front ends share this bundle entry: the marketing site at "/" and the
// intake form at "/applynow". Each is loaded on demand so its CSS never reaches the other
// (the form's Tailwind reset would otherwise restyle the marketing site).
const { pathname, search, hash } = window.location;
const normalized = pathname.replace(/\/+$/, '').toLowerCase();

if (normalized === '/applynow') {
  // Canonicalise casing (e.g. /ApplyNow) so the address bar matches the real route.
  if (pathname !== '/applynow' && pathname !== '/applynow/') {
    window.history.replaceState(null, '', `/applynow${search}${hash}`);
  }
  import('./FormEntry.tsx');
} else {
  // The site is only served at "/", so /index.html (and /index.html/) is treated as home.
  if (normalized === '/index.html') {
    window.history.replaceState(null, '', `/${search}${hash}`);
  }
  import('./WebsiteEntry.tsx');
}
