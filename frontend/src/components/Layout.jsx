import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  FileText,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  BarChart3,
  Factory,
  BookOpen,
  LogOut,
  Menu,
  X,
  Building2,
  ShieldCheck,
  ChevronRight,
  Receipt,
  TrendingUp
} from 'lucide-react';

const roleLabels = {
  salesman: 'Field Sales',
  admin: 'Factory Admin',
  production: 'Production',
  accountant: 'Audit & Accounts',
  owner: 'Owner'
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  if (!user) return <>{children}</>;

  const getNavItems = () => {
    switch (user.role) {
      case 'salesman':
        return [
          { path: '/salesman/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/salesman/new-order', label: 'Take Order', icon: PlusCircle },
          { path: '/salesman/orders', label: 'My Orders', icon: ClipboardList }
        ];
      case 'admin':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/admin/orders', label: 'Sales Orders', icon: ClipboardList },
          { path: '/admin/invoices', label: 'GST Invoices', icon: FileText },
          { path: '/admin/purchases', label: 'Raw Purchases', icon: ShoppingCart },
          { path: '/admin/payments', label: 'Collections', icon: Wallet },
          { path: '/admin/customers', label: 'Customers', icon: Users },
          { path: '/production/inventory', label: 'Live Stock', icon: Package },
          { path: '/reports', label: 'Auditor Reports', icon: BarChart3 }
        ];
      case 'production':
        return [
          { path: '/production/dashboard', label: 'Floor Dashboard', icon: LayoutDashboard },
          { path: '/production/runs', label: 'Production Runs', icon: Factory },
          { path: '/production/inventory', label: 'Inventory Ledger', icon: Package },
          { path: '/production/bom', label: 'Recipe (BOM)', icon: BookOpen }
        ];
      case 'accountant':
        return [
          { path: '/reports', label: 'Reports Hub', icon: BarChart3 },
          { path: '/reports/sales', label: 'Sales Register', icon: FileText },
          { path: '/reports/gst', label: 'GSTR Summary', icon: ShieldCheck },
          { path: '/reports/purchases', label: 'Purchase Register', icon: Receipt },
          { path: '/reports/collections', label: 'Collections', icon: Wallet },
          { path: '/reports/stock', label: 'Stock Ledger', icon: Package },
          { path: '/reports/production', label: 'Variance Report', icon: Factory },
          { path: '/reports/cost', label: 'Cost & Margins', icon: TrendingUp },
          { path: '/reports/outstanding', label: 'Ageing & Dues', icon: Wallet }
        ];
      case 'owner':
      default:
        return [
          { path: '/owner/dashboard', label: 'Command Center', icon: LayoutDashboard },
          { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
          { path: '/admin/invoices', label: 'Invoices', icon: FileText },
          { path: '/admin/payments', label: 'Collections', icon: Wallet },
          { path: '/production/runs', label: 'Production Runs', icon: Factory },
          { path: '/production/inventory', label: 'Stock Ledger', icon: Package },
          { path: '/reports', label: 'All Reports', icon: BarChart3 }
        ];
    }
  };

  const navItems = getNavItems();
  const currentItem = navItems.find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const initials = (user.full_name || user.username || 'U')
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const today = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavLink = (item, mobile = false) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => mobile && setMobileMenuOpen(false)}
        aria-current={isActive ? 'page' : undefined}
        className={`nav-item group ${mobile ? 'min-h-12 text-[15px]' : ''} ${
          isActive
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-950/20'
            : 'text-ink-300 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-ink-400 group-hover:text-primary-300'}`} />
        <span className="flex-1">{item.label}</span>
        {isActive && <ChevronRight className="h-4 w-4 text-primary-200" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] md:flex">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-sm font-bold text-primary-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-ink-950">Sri Lakshmi Foods</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Order to Audit ERP</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="icon-btn border border-slate-200"
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden w-[264px] shrink-0 flex-col bg-ink-950 md:sticky md:top-0 md:flex md:h-screen">
        <div className="border-b border-white/[0.07] px-5 py-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-950/30">
              <Building2 className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-tight text-white">Sri Lakshmi Foods</span>
              <span className="mt-0.5 block text-[11px] font-medium text-ink-400">Tiruchirappalli, Tamil Nadu</span>
            </span>
          </Link>
          <div className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Operations workspace
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-xs font-bold text-primary-300">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.full_name || user.username}</p>
              <p className="mt-0.5 text-[11px] font-medium text-ink-400">{roleLabels[user.role] || user.role}</p>
            </div>
          </div>
        </div>

        <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Primary navigation">
          {navItems.map(item => renderNavLink(item))}
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="nav-item w-full text-ink-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu" />
          <div id="mobile-navigation" className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm animate-fade-in flex-col bg-ink-950 shadow-elevated">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <div className="flex items-center gap-3 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600"><Building2 className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-bold">Sri Lakshmi Foods</p>
                  <p className="text-[11px] text-ink-400">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="icon-btn text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Close navigation menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs text-ink-500">Signed in as</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{user.full_name || user.username}</p>
            </div>
            <nav className="scrollbar-none flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="Mobile navigation">
              {navItems.map(item => renderNavLink(item, true))}
            </nav>
            <div className="border-t border-white/10 p-3">
              <button type="button" onClick={handleLogout} className="nav-item w-full text-red-300 hover:bg-red-500/10">
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-xl md:flex lg:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-ink-400">Workspace</span>
            <ChevronRight className="h-4 w-4 text-ink-300" />
            <span className="font-semibold text-ink-800">{currentItem?.label || 'Overview'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-ink-500">{today}</span>
            <span className="h-5 w-px bg-slate-200" />
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-ink-600">{roleLabels[user.role] || user.role}</span>
          </div>
        </div>
        <main id="main-content" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          <div key={location.pathname} className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
