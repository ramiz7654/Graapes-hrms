import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { detectMobileDevice, resolveLayout } from '../utils/device.js';

const LayoutContext = createContext(null);
const KEY = 'hrms.layout'; // 'auto' | 'mobile' | 'desktop'

function readPref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'mobile' || v === 'desktop' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function LayoutProvider({ children }) {
  const [preference, setPreference] = useState(readPref);
  const [isMobileDevice, setIsMobileDevice] = useState(detectMobileDevice);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  // Re-evaluate on resize / rotation.
  useEffect(() => {
    const update = () => {
      setViewportWidth(window.innerWidth);
      setIsMobileDevice(detectMobileDevice());
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const setLayoutPreference = useCallback((value) => {
    setPreference(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const layout = resolveLayout(preference, { isMobileDevice, viewportWidth });
  const value = useMemo(
    () => ({ preference, layout, isMobile: layout === 'mobile', isMobileDevice, setLayoutPreference }),
    [preference, layout, isMobileDevice, setLayoutPreference],
  );
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider');
  return ctx;
}
