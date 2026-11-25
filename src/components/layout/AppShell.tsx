'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Package,
  QrCode,
  Settings,
  ShieldAlert,
  Smartphone,
  Snowflake,
  Truck,
  X,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { useCct } from './CctContext';
import { RoleSwitcher } from './RoleSwitcher';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function AppShell({
  channel,
  children,
}: {
  channel: 'control-tower' | 'customer' | 'field-app';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    currentOrg,
    isAuthenticated,
    lang,
    setLang,
    notifications,
    markNotificationRead,
    logout,
  } = useCct();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter(
    (n) => !currentUser || !n.isReadByUserIds.includes(currentUser.id)
  ).length;

  const ctNav: NavItem[] = [
    { href: '/control-tower', label: t('navOverview', lang), icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/control-tower/orders-plan', label: t('navOrdersPlan', lang), icon: <ClipboardCheck className="w-4 h-4" /> },
    { href: '/control-tower/warehouse-transport', label: t('navWarehouseTransport', lang), icon: <Truck className="w-4 h-4" /> },
    { href: '/control-tower/telemetry', label: t('navTelemetry', lang), icon: <Activity className="w-4 h-4" /> },
    { href: '/control-tower/lots', label: t('navLots', lang), icon: <Package className="w-4 h-4" /> },
    { href: '/control-tower/claims', label: t('navClaims', lang), icon: <ShieldAlert className="w-4 h-4" /> },
    { href: '/control-tower/billing', label: t('navBilling', lang), icon: <FileSpreadsheet className="w-4 h-4" /> },
    { href: '/control-tower/kpi', label: t('navKpi', lang), icon: <BarChart3 className="w-4 h-4" /> },
    { href: '/control-tower/admin', label: t('navAdmin', lang), icon: <Settings className="w-4 h-4" /> },
  ];

  const customerNav: NavItem[] = [
    { href: '/customer', label: 'Đơn hàng & Theo dõi lô', icon: <Building2 className="w-4 h-4" /> },
    { href: '/customer/login', label: 'Đăng nhập / Đăng ký B2B', icon: <LogIn className="w-4 h-4" /> },
  ];

  const fieldNav: NavItem[] = [
    { href: '/field-app', label: 'Thao tác hiện trường', icon: <Smartphone className="w-4 h-4" /> },
  ];

  const navItems =
    channel === 'control-tower' ? ctNav : channel === 'customer' ? customerNav : fieldNav;

  const mobileBottomItems =
    channel === 'control-tower'
      ? [ctNav[0], ctNav[1], ctNav[2], ctNav[4], ctNav[6]]
      : navItems;

  const homeHref =
    channel === 'control-tower'
      ? '/control-tower'
      : channel === 'field-app'
        ? '/field-app'
        : '/customer';

  const handleLogout = async () => {
    if (channel === 'control-tower') {
      await logout('admin');
      router.push('/admin');
    } else if (channel === 'customer') {
      await logout('customer');
      router.push('/customer/login');
    } else {
      await logout('field');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-4 py-4 border-b border-slate-100">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">Mitsui CCT</div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {t('corridorTag', lang)}
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {channel === 'control-tower'
              ? t('channelControlTower', lang)
              : channel === 'customer'
                ? t('channelCustomer', lang)
                : t('channelFieldApp', lang)}
          </div>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Strictly hide Admin/Control Tower links on Customer & Field channels */}
          {channel === 'control-tower' && (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Kênh đối tác & công khai
              </div>
              <Link
                href="/customer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                {t('channelCustomer', lang)}
              </Link>
              <Link
                href="/field-app"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                {t('channelFieldApp', lang)}
              </Link>
              <Link
                href="/qr/qr-tg-clean-001"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-600" />
                {t('channelPublicQr', lang)}
              </Link>
            </div>
          )}

          {channel === 'customer' && (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Truy xuất công khai
              </div>
              <Link
                href="/qr/qr-tg-clean-001"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-600" />
                Tra cứu mã QR mẫu
              </Link>
            </div>
          )}
        </nav>

        {currentOrg && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[11px] text-slate-400 font-medium">Tổ chức hiện tại</div>
            <div className="text-xs font-semibold text-slate-800 truncate">{currentOrg.name}</div>
            <div className="text-[11px] text-slate-500">{currentUser?.name}</div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl flex flex-col p-4 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <Link
                href={homeHref}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 font-bold text-slate-900"
              >
                <Snowflake className="w-5 h-5 text-emerald-600" />
                Mitsui CCT
              </Link>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-3 space-y-1 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
              {channel === 'control-tower' && (
                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                  <Link href="/customer" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600">
                    <Building2 className="w-3.5 h-3.5" /> Web Khách Hàng B2B
                  </Link>
                  <Link href="/field-app" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600">
                    <Smartphone className="w-3.5 h-3.5" /> App Hiện Trường
                  </Link>
                  <Link href="/qr/qr-tg-clean-001" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600">
                    <QrCode className="w-3.5 h-3.5" /> Trang QR Công Khai
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Asset-Light
              </span>
              <span className="truncate font-medium text-slate-700">
                {currentOrg?.name ?? 'Mitsui CCT'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RoleSwitcher />

            {channel === 'control-tower' && (
              <button
                onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title="Đổi ngôn ngữ VI/EN (NFR-11)"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>{lang.toUpperCase()}</span>
              </button>
            )}

            {channel === 'customer' &&
              (!isAuthenticated ? (
                <Link
                  href="/customer/login"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập / Đăng ký</span>
                </Link>
              ) : (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              ))}

            {channel === 'control-tower' && (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 whitespace-nowrap"
                title="Đăng xuất phiên Quản trị"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Thông báo"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {t('notifications', lang)} ({unreadCount})
                    </span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        Chưa có thông báo mới.
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => {
                        const isUnread = currentUser && !n.isReadByUserIds.includes(currentUser.id);
                        return (
                          <div
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-3 cursor-pointer hover:bg-slate-50 ${
                              isUnread ? 'bg-emerald-50/40' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                              <div className="flex gap-1">
                                {n.channel.map((ch) => (
                                  <span
                                    key={ch}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                                  >
                                    {ch}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {new Date(n.createdAt).toLocaleString('vi-VN', {
                                timeZone: 'Asia/Ho_Chi_Minh',
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-3 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
        {mobileBottomItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-medium ${
                active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-[100px]">{item.label.split('&')[0].trim()}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
