import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'hrms.theme'; // 'light' | 'dark' | 'system'

function readPref() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system'; // storage blocked: still works, just not persisted
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPref);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setTheme = useCallback((value) => {
    setPreference(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ preference, isDark, setTheme }), [preference, isDark, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
