import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  Menu,
  X,
  Moon,
  Sun,
  Bell,
  UserRound,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

import { NAV_ITEMS, ROLE_NAV } from '../app/navigation.js';
import { useTheme } from '../app/ThemeProvider.jsx';
import { useAuth } from '../app/AuthContext.jsx';

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150';


function SideLink({ item, onClick, iconOnly = false }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      title={iconOnly ? item.label : undefined}
      aria-label={iconOnly ? item.label : undefined}
      className={({ isActive }) =>
        `${linkBase} ${
          iconOnly ? 'justify-center px-0' : ''
        } ${
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-muted hover:bg-surface-2 hover:text-text'
        }`
      }
    >
      <Icon size={19} aria-hidden="true" />
      {!iconOnly && <span>{item.label}</span>}
    </NavLink>
  );
}


function Brand({ compact = false }) {
  return (
    <div
      className={`brand-lockup flex min-w-0 items-center gap-2.5 ${
        compact ? '' : 'px-1'
      }`}
    >
      <img
        src="/graapes-logo.jpg"
        alt="Graapes"
        className="brand-logo h-10 w-10 shrink-0 rounded-xl object-contain"
      />

      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-bold">Graapes</div>
        <div className="truncate text-xs text-muted">Core HR Portal</div>
      </div>
    </div>
  );
}


function IconButton({
  label,
  onClick,
  children,
  className = '',
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-text ${className}`}
    >
      {children}
    </button>
  );
}


function ThemeToggle() {
  const { isDark, setTheme } = useTheme();

  return (
    <IconButton
      label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </IconButton>
  );
}


function GreetingHero() {
  const [now, setNow] = useState(() => new Date());
  // The name always comes from the signed-in account (database via /auth/me), never from browser storage.
  const { user } = useAuth();
  const name = user?.fullName || '';

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const hour = now.getHours();

  const greeting =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : hour < 21
          ? 'Good evening'
          : 'Good night';

  const date = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  return (
    <section
      className="greeting-hero mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5 sm:p-6"
      aria-live="polite"
    >
      <div>
        <p className="text-sm font-semibold text-accent">
          {greeting}{name ? `, ${name}` : ''}!
        </p>

        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          Welcome to Graapes HRMS
        </h1>

        <p className="mt-1 text-sm text-muted">
          Here’s your workspace at a glance.
        </p>
      </div>

      <div className="greeting-clock rounded-xl border border-border bg-surface/80 px-4 py-3 text-left sm:text-right">
        <div className="text-lg font-bold tabular-nums">{time}</div>
        <div className="mt-0.5 text-xs text-muted">{date}</div>
      </div>
    </section>
  );
}


function DesktopHeader({
  smallScreen,
  drawerOpen,
  onToggleMenu,
  onProfile,
  onNotifications,
  unreadCount = 0,
}) {
  return (
    <header className="app-header desktop-header sticky top-0 z-20 flex items-center gap-5 border-b border-border bg-surface/95 px-5 py-3 backdrop-blur xl:px-7">
      <Brand />

      <nav
        aria-label="Quick navigation"
        className={`desktop-quick-nav flex min-w-0 flex-1 items-center justify-start gap-1 ${
          smallScreen ? 'is-hidden' : ''
        }`}
      >
        {[
          NAV_ITEMS.find((item) => item.to === '/attendance'),
          NAV_ITEMS.find((item) => item.to === '/announcements'),
          NAV_ITEMS.find((item) => item.to === '/leave'),
        ]
          .filter(Boolean)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <div className="relative">
          <IconButton
            label="Notifications"
            onClick={onNotifications}
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
            )}
          </IconButton>
        </div>

        <ThemeToggle />

        <IconButton
          label="Profile"
          onClick={onProfile}
        >
          <UserRound size={19} />
        </IconButton>

        {smallScreen && (
          <IconButton
            label={
              drawerOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            className="compact-menu-button"
            onClick={onToggleMenu}
          >
            {drawerOpen ? <X size={21} /> : <Menu size={21} />}
          </IconButton>
        )}
      </div>
    </header>
  );
}


function SidebarContents({
  onNavigate,
  onLogout,
  iconOnly = false,
  expanded = false,
  onToggleExpand,
}) {
  const location = useLocation();
  const [role, setRole] = useState(null);
  useEffect(() => {
    let active = true;
    api('/auth/me').then(({ user }) => { if (active) setRole(user?.role || null); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const roleKeyByRole = {
    SUPER_ADMIN: '/dashboard/super-admin',
    HR_ADMIN: '/dashboard/hr-admin',
    MANAGER: '/dashboard/manager',
    EMPLOYEE: '/dashboard/employee',
    INTERN: '/dashboard/employee',
    EMPLOYEE_INTERN: '/dashboard/employee',
    FINANCE: '/dashboard/super-admin',
  };
  const roleKey = roleKeyByRole[role] || Object.keys(ROLE_NAV).find((key) => location.pathname.startsWith(key)) || '/dashboard/super-admin';
  const items = [...(ROLE_NAV[roleKey] || NAV_ITEMS)];
  if (role === 'EMPLOYEE') {
    const profileItem = { to: '/profile', label: 'My profile', icon: UserRound, built: true };
    if (!items.some((item) => item.to === '/profile')) items.splice(1, 0, profileItem);
  }
  return (
    <>
      <div
        className={`sidebar-expand-row ${
          iconOnly ? 'is-compact' : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={
            expanded ? 'Collapse sidebar' : 'Expand sidebar'
          }
          title={
            expanded ? 'Collapse sidebar' : 'Expand sidebar'
          }
          className="sidebar-expand-button"
        >
          {expanded ? (
            <ChevronLeft size={19} />
          ) : (
            <ChevronRight size={19} />
          )}
        </button>
      </div>

      <nav
        aria-label="Main navigation"
        className={`sidebar-nav flex flex-1 flex-col gap-1 ${
          iconOnly ? 'items-stretch' : ''
        }`}
      >
        {items.map((item) => (
          <SideLink
            key={item.to}
            item={item}
            onClick={onNavigate}
            iconOnly={iconOnly}
          />
        ))}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className={`mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger ${
          iconOnly ? 'justify-center px-0' : ''
        }`}
        title={iconOnly ? 'Logout' : undefined}
        aria-label={iconOnly ? 'Logout' : undefined}
      >
        <LogOut size={19} />
        {!iconOnly && <span>Logout</span>}
      </button>
    </>
  );
}


function Drawer({ open, onClose, onLogout }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className={`drawer-layer ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close navigation menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <SidebarContents onNavigate={onClose} onLogout={onLogout} />
      </aside>
    </div>
  );
}


function DesktopShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const smallScreen = useSmallScreen();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const res = await api('/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // silently fallback
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [location.pathname, notificationsOpen]);

  const handleMarkAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date() })));
    } catch {}
  };

  const handleLogout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* Clear local UI even if the server is unavailable. */ }
    try {
      ['hrms.user', 'hrms.currentUser', 'currentUser', 'user'].forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch { /* Storage may be unavailable. */ }
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const openProfile = () => navigate('/profile');

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const closeOnOutsideClick = (event) => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      if (
        target.closest('.drawer-panel') ||
        target.closest('.compact-menu-button')
      ) {
        return;
      }

      setDrawerOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeOnOutsideClick
      );
    };
  }, [drawerOpen]);

  return (
    <div
      className="desktop-shell min-h-screen"
      onClick={() => {
        if (sidebarExpanded) {
          setSidebarExpanded(false);
        }
      }}
    >
      <DesktopHeader
        smallScreen={smallScreen}
        drawerOpen={drawerOpen}
        unreadCount={unreadCount}
        onToggleMenu={() => {
          setDrawerOpen((open) => !open);
        }}
        onProfile={openProfile}
        onNotifications={() => setNotificationsOpen((open) => !open)}
      />

      <div
        className="desktop-workspace flex min-h-[calc(100vh-68px)] min-w-0"
        onClick={() => setSidebarExpanded(false)}
      >
        <aside
          className={`desktop-sidebar sticky top-[68px] hidden h-[calc(100vh-68px)] shrink-0 flex-col border-r border-border bg-surface ${
            smallScreen ? 'is-small-hidden' : 'is-full-visible'
          } ${
            sidebarExpanded ? 'is-expanded' : 'is-collapsed'
          }`}
          aria-label="Sidebar navigation"
          onClick={(event) => event.stopPropagation()}
        >
          <SidebarContents
            onLogout={() => setLogoutConfirmOpen(true)}
            iconOnly={!sidebarExpanded}
            expanded={sidebarExpanded}
            onToggleExpand={() => {
              setSidebarExpanded((value) => !value);
            }}
          />
        </aside>

        <div className="desktop-main flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 xl:p-8">
            <GreetingHero />
            <Outlet />
          </main>
          <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted sm:px-6 xl:px-8">
            © {new Date().getFullYear()} Graapes Private Limited. All rights reserved. <span className="mx-1 hidden sm:inline">•</span><span className="block sm:inline">Graapes HRMS Portal</span>
          </footer>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLogout={() => setLogoutConfirmOpen(true)}
      />

      {notificationsOpen && (
        <div className="fixed inset-0 z-40" role="presentation" onClick={() => setNotificationsOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Notifications"
            className="absolute right-4 top-16 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-sm text-muted hover:bg-surface-2">✕</button>
              </div>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={async () => {
                    try {
                      if (!n.readAt) {
                        await api(`/notifications/${encodeURIComponent(n.id)}/read`, { method: 'PATCH' });
                        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item));
                        setUnreadCount((count) => Math.max(0, count - 1));
                      }
                    } catch {
                      // Navigation remains available even if marking the alert read fails.
                    }
                    if (n.link) {
                      navigate(n.link);
                      setNotificationsOpen(false);
                    }
                  }}
                  className={`rounded-xl border border-border p-3 transition ${
                    n.link ? 'cursor-pointer hover:border-accent/40 hover:bg-surface-2' : ''
                  } ${!n.readAt ? 'bg-accent-soft/20 border-accent/20' : 'bg-surface'}`}
                >
                  <div className="text-xs font-bold text-text">{n.title}</div>
                  <div className="mt-1 text-xs text-muted leading-relaxed">{n.body}</div>
                  <div className="mt-2 text-[10px] text-muted font-medium">
                    {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">No notifications to show right now.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutConfirmOpen(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2 id="logout-confirm-title" className="text-lg font-bold">Confirm logout</h2>
            <p className="mt-2 text-sm text-muted">Are you sure you want to log out? You will need to sign in again to access your account.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setLogoutConfirmOpen(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">Cancel</button>
              <button type="button" onClick={handleLogout} className="rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white">Yes, Log Out</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


// Kept for later; not currently used.
function MobileShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);

    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [menuOpen]);

  return (
    <div className="mobile-shell flex min-h-screen flex-col">
      <header className="app-header mobile-header sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-3 backdrop-blur">
        <Brand compact />

        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            label="Notifications"
            onClick={() => {}}
          >
            <Bell size={19} />
          </IconButton>

          <ThemeToggle />

          <IconButton
            label={
              menuOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </IconButton>
        </div>
      </header>

      <main className="mobile-main flex-1 p-4">
        <GreetingHero />
        <Outlet />
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Graapes Private Limited. All rights reserved.<span className="block mt-1">Graapes HRMS Portal</span>
      </footer>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}


export default function AppShell() {
  // Keep two layouts: full screen and compact/small screen.
  // MobileShell remains unused for now.
  return <DesktopShell />;
}


function useSmallScreen() {
  const [small, setSmall] = useState(
    () => window.matchMedia('(max-width: 750px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 750px)');

    const update = (event) => {
      setSmall(event.matches);
    };

    mq.addEventListener('change', update);

    return () => {
      mq.removeEventListener('change', update);
    };
  }, []);

  return small;
}