'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { Lang } from '@/lib/i18n';
import { NotificationItem, Organization, User, UserRole } from '@/types/common';

export interface DemoUserSummary {
  id: string;
  name: string;
  role: UserRole;
  orgId: string;
  orgName: string;
  phone: string;
  email: string;
  twoFactorEnabled: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export type ActiveChannel = 'admin' | 'customer' | 'field';

interface CctContextValue {
  channel: ActiveChannel;
  currentUser: User | null;
  currentOrg: Organization | null;
  isAuthenticated: boolean;
  demoUsers: DemoUserSummary[];
  notifications: NotificationItem[];
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  loadingAuth: boolean;
  refreshTick: number;
  triggerRefresh: () => void;
  reloadAuth: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  logout: (scope: ActiveChannel) => Promise<void>;
  loginWithMode: (payload: {
    mode: 'OTP' | 'CUSTOMER_LOGIN' | 'ADMIN_LOGIN';
    phone?: string;
    email?: string;
    password?: string;
    otp?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  markNotificationRead: (id: string) => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
}

const LOCALE_STORAGE_KEY = 'cct_locale';
const CctContext = createContext<CctContextValue | null>(null);

export function CctProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const channel: ActiveChannel = useMemo(() => {
    if (pathname.startsWith('/control-tower') || pathname.startsWith('/admin')) return 'admin';
    if (pathname.startsWith('/field-app')) return 'field';
    return 'customer';
  }, [pathname]);

  const isAuthOrPublicPage =
    pathname === '/admin' || pathname === '/customer/login' || pathname.startsWith('/qr/');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUserSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // SSR-safe initial locale 'vi'; hydrated from localStorage inside useEffect
  const [lang, setLangState] = useState<Lang>('vi');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'vi' ? 'ja' : 'vi';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const loadAuth = useCallback(async () => {
    if (pathname.startsWith('/qr/')) {
      setLoadingAuth(false);
      return;
    }
    try {
      const res = await fetch(`/api/auth?channel=${channel}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.currentUser ?? null);
        setCurrentOrg(data.currentOrg ?? null);
        setIsAuthenticated(Boolean(data.isAuthenticated));
        setDemoUsers(data.demoUsers ?? []);
      }
    } finally {
      setLoadingAuth(false);
    }
  }, [channel, pathname]);

  const loadNotifications = useCallback(async () => {
    if (isAuthOrPublicPage) return;
    try {
      const res = await fetch('/api/admin', {
        cache: 'no-store',
        headers: { 'x-cct-channel': channel },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // ignore background poll errors
    }
  }, [channel, isAuthOrPublicPage]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (savedLang === 'ja' || savedLang === 'vi') {
        setLangState(savedLang);
      }
    }
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!isAuthOrPublicPage && currentUser) {
      loadNotifications();
    }
  }, [isAuthOrPublicPage, currentUser, loadNotifications]);

  useEffect(() => {
    if (isAuthOrPublicPage) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadNotifications();
        setRefreshTick((n) => n + 1);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [isAuthOrPublicPage, loadNotifications]);

  const triggerRefresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
    loadNotifications();
  }, [loadNotifications]);

  const switchUser = useCallback(
    async (userId: string) => {
      const mode =
        channel === 'admin'
          ? 'SWITCH_ADMIN_ROLE'
          : channel === 'field'
            ? 'SWITCH_FIELD_ROLE'
            : 'SWITCH_CUSTOMER_DEMO';
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.currentUser);
        setCurrentOrg(data.currentOrg);
        setIsAuthenticated(Boolean(data.isAuthenticated));
        pushToast('info', `Đã chuyển / 切替完了: ${data.currentUser?.name}`);
        triggerRefresh();
      } else {
        pushToast('error', data.error || 'Không thể chuyển vai trò.');
      }
    },
    [channel, pushToast, triggerRefresh]
  );

  const logout = useCallback(
    async (scope: ActiveChannel) => {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'LOGOUT', scope }),
      });
      setCurrentUser(null);
      setCurrentOrg(null);
      setIsAuthenticated(false);
      pushToast('info', 'Đã đăng xuất / ログアウトしました');
    },
    [pushToast]
  );

  const loginWithMode = useCallback(
    async (payload: {
      mode: 'OTP' | 'CUSTOMER_LOGIN' | 'ADMIN_LOGIN';
      phone?: string;
      email?: string;
      password?: string;
      otp?: string;
    }) => {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Đăng nhập thất bại.' };
      }
      setCurrentUser(data.currentUser);
      setCurrentOrg(data.currentOrg);
      setIsAuthenticated(true);
      pushToast('success', `Đăng nhập thành công / ログイン成功: ${data.currentUser?.name}`);
      triggerRefresh();
      return { ok: true };
    },
    [pushToast, triggerRefresh]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-cct-channel': channel },
        body: JSON.stringify({ action: 'MARK_NOTIFICATION_READ', notificationId: id }),
      });
      loadNotifications();
    },
    [channel, loadNotifications]
  );

  return (
    <CctContext.Provider
      value={{
        channel,
        currentUser,
        currentOrg,
        isAuthenticated,
        demoUsers,
        notifications,
        lang,
        setLang,
        toggleLang,
        loadingAuth,
        refreshTick,
        triggerRefresh,
        reloadAuth: loadAuth,
        switchUser,
        logout,
        loginWithMode,
        markNotificationRead,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
      <div className="fixed bottom-20 lg:bottom-5 right-4 z-[90] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2">
        {toasts.map((toast) => {
          const colors =
            toast.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : toast.type === 'error'
                ? 'bg-rose-700 text-white border-rose-800'
                : toast.type === 'warning'
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-slate-800 text-white border-slate-900';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg flex items-center justify-between gap-3 ${colors}`}
            >
              <span>{toast.text}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-xs opacity-80 hover:opacity-100 shrink-0"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </CctContext.Provider>
  );
}

export function useCct() {
  const ctx = useContext(CctContext);
  if (!ctx) throw new Error('useCct must be used inside CctProvider');
  return ctx;
}
