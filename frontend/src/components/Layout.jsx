import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, Building2, CreditCard, DoorOpen, FileText, Gauge,
  Home, LogOut, Menu, Receipt, Settings, Shield, User, Users, Wrench, X,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/format';
import { Badge, cx } from './ui';

const ADMIN_NAV = [
  { to: '/', label: 'Tổng quan & Thống kê', icon: Home, end: true },
  { to: '/rooms', label: 'Quản lý phòng', icon: DoorOpen },
  { to: '/tenants', label: 'Người thuê', icon: Users },
  { to: '/contracts', label: 'Hợp đồng thuê', icon: FileText },
  { to: '/readings', label: 'Chỉ số điện nước', icon: Gauge },
  { to: '/invoices', label: 'Hóa đơn', icon: Receipt },
  { to: '/payments', label: 'Lịch sử thanh toán', icon: CreditCard },
  { to: '/fees', label: 'Đơn giá & Dịch vụ', icon: Settings },
  { to: '/incidents', label: 'Báo cáo sự cố', icon: Wrench },
  { to: '/users', label: 'Tài khoản & Phân quyền', icon: Shield },
  { to: '/notifications', label: 'Thông báo', icon: Bell },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: User },
];

const TENANT_NAV = [
  { to: '/', label: 'Tổng quan', icon: Home, end: true },
  { to: '/my-room', label: 'Phòng & Hợp đồng', icon: DoorOpen },
  { to: '/invoices', label: 'Hóa đơn & Công nợ', icon: Receipt },
  { to: '/payments', label: 'Lịch sử thanh toán', icon: CreditCard },
  { to: '/readings', label: 'Điện nước & Phí dịch vụ', icon: Gauge },
  { to: '/incidents', label: 'Báo cáo sự cố', icon: AlertTriangle },
  { to: '/notifications', label: 'Thông báo', icon: Bell },
  { to: '/profile', label: 'Thông tin cá nhân', icon: User },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notif, setNotif] = useState({ items: [], unread: 0 });
  const loc = useLocation();
  const nav = useNavigate();

  const loadNotif = () => {
    api.get('/notifications', { limit: 8 }).then(setNotif).catch(() => {});
  };

  useEffect(() => {
    setOpen(false);
    setBellOpen(false);
    loadNotif();
  }, [loc.pathname]);

  const items = isAdmin ? ADMIN_NAV : TENANT_NAV;

  const markReadAndGo = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => {});
    setBellOpen(false);
    loadNotif();
    if (n.link) nav(n.link);
  };

  const readAll = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    loadNotif();
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-800">Nhà 57 Giảng Võ</p>
              <p className="text-xs text-slate-500">Quản lý nhà cho thuê</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {to === '/notifications' && notif.unread > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{notif.unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.full_name}</p>
              <Badge color={isAdmin ? 'brand' : 'green'}>{isAdmin ? 'Chủ nhà / Quản lý' : 'Người thuê'}</Badge>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-slate-500 sm:inline">
              Địa chỉ: <strong className="font-medium text-slate-700">57 Giảng Võ, Đống Đa, Hà Nội</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                title="Thông báo"
              >
                <Bell className="h-5 w-5" />
                {notif.unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {notif.unread > 9 ? '9+' : notif.unread}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="font-semibold text-slate-800">Thông báo ({notif.unread} chưa đọc)</span>
                      {notif.unread > 0 && (
                        <button onClick={readAll} className="text-xs font-medium text-brand-600 hover:underline">
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                      {notif.items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">Chưa có thông báo</p>
                      ) : notif.items.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markReadAndGo(n)}
                          className={cx('block w-full px-4 py-3 text-left transition hover:bg-slate-50', !n.is_read && 'bg-brand-50/50')}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={cx('text-sm', !n.is_read ? 'font-semibold text-slate-800' : 'text-slate-700')}>{n.title}</p>
                            {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                          </div>
                          {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>}
                          <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 p-2 text-center">
                      <button onClick={() => { setBellOpen(false); nav('/notifications'); }} className="text-xs font-medium text-brand-600 hover:underline">
                        Xem tất cả thông báo
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => nav('/profile')} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm hover:bg-slate-100">
              <User className="h-4 w-4 text-slate-500" />
              <span className="hidden font-medium text-slate-700 sm:inline">{user?.full_name}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
