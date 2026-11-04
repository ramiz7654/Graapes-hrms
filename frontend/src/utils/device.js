/**
 * Best-effort mobile device detection that still works when the browser is in
 * "Desktop site" mode. No detector is perfect (browsers can hide or spoof details),
 * so the result is only a HINT: the user's explicit layout choice always wins,
 * and the UI stays usable if detection is wrong.
 *
 * Signals, strongest first:
 *  1. navigator.userAgentData.mobile (Chromium; usually still true in Desktop mode)
 *  2. Mobile user-agent patterns (Android phones, iPhone, iPod, ...)
 *  3. iPadOS/iOS Safari in desktop mode: reports "Macintosh" but has multi-touch
 *  4. Physical screen size (screen.width is NOT changed by Desktop mode, unlike the viewport)
 *     combined with a coarse pointer. Used only as supporting evidence.
 */
const MOBILE_UA = /Android.+Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS|Mobile Safari/i;

export function detectMobileDevice() {
  if (typeof navigator === 'undefined') return false;

  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean' && uaData.mobile) return true;

  const ua = navigator.userAgent || '';
  if (MOBILE_UA.test(ua)) return true;

  const isIpadOsDesktopMode = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const shortSide = Math.min(window.screen?.width || 0, window.screen?.height || 0);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;

  // Phone-sized physical screen + touch input. (Tablets are treated as desktop-capable.)
  if (coarse && shortSide > 0 && shortSide <= 480) return true;
  // iPad in desktop mode: use the compact layout only if the viewport is narrow too.
  if (isIpadOsDesktopMode && window.innerWidth < 700) return true;

  return false;
}

/** Layout preference: 'auto' | 'mobile' | 'desktop'. Returns the effective layout. */
export function resolveLayout(preference, { isMobileDevice, viewportWidth }) {
  if (preference === 'mobile') return 'mobile';
  if (preference === 'desktop') return 'desktop';
  // auto: recognised phones get the mobile UI; otherwise fall back to viewport width.
  if (isMobileDevice) return 'mobile';
  return viewportWidth < 768 ? 'mobile' : 'desktop';
}
