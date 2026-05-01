// Simulator / dev-mode escape hatch. Real drivers never trigger this; it's
// only used for on-device testing of GPS-driven flows when a laptop on the
// same Wi-Fi (and thus a real `vite` dev build) isn't available.
//
// Visiting any URL with ?sim=1 pins the flag into sessionStorage so it
// survives React Router navigations between /login → /services → /run. A
// sessionStorage entry is scoped to the tab, so closing the tab forgets it.

const STORAGE_KEY = 'drivermate.sim';

export function isSimEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('sim') === '1') {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // sessionStorage can throw in private mode; fall through to URL-only.
    }
    return true;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
