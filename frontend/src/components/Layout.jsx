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
  ShieldCheck,
  ChevronRight,
  Receipt,
  TrendingUp
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './ui/sheet';

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
  const initials = (user.full_name || user.fullName || user.username || 'U')
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

  const renderNavLink = item => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={isActive ? 'page' : undefined}
        className={`nav-item ${isActive ? 'bg-primary-50 font-semibold text-primary-800 ring-1 ring-primary-100' : 'text-ink-600 hover:bg-slate-100 hover:text-ink-950'}`}
      >
        <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-primary-600' : 'text-ink-400'}`} />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  };

  const navigation = (
    <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Primary navigation">
      {navItems.map(renderNavLink)}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f6f7f9] md:flex">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Link to="/" className="min-w-0">
          <span className="block truncate font-display text-[15px] font-bold tracking-[-0.02em] text-ink-950">FactoryLoop</span>
          <span className="block text-[11px] text-ink-500">Sri Lakshmi Foods</span>
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="border-b border-slate-200 px-5 py-5 pr-14">
              <SheetTitle>FactoryLoop</SheetTitle>
              <SheetDescription>Sri Lakshmi Foods operations workspace</SheetDescription>
            </div>
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs text-ink-500">Signed in as</p>
              <p className="mt-1 truncate text-sm font-medium text-ink-950">{user.full_name || user.fullName || user.username}</p>
              <p className="mt-0.5 text-xs text-ink-500">{roleLabels[user.role] || user.role}</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col pt-3">{navigation}</div>
            <div className="border-t border-slate-200 p-3">
              <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-slate-200 bg-[#fcfcfd] md:sticky md:top-0 md:flex md:h-screen">
        <div className="border-b border-slate-200 px-5 py-6">
          <Link to="/" className="block">
            <span className="block font-display text-[17px] font-bold tracking-[-0.03em] text-ink-950">FactoryLoop</span>
            <span className="mt-1 block text-xs text-ink-500">Sri Lakshmi Foods</span>
          </Link>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">Operations workspace</p>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-950">{user.full_name || user.fullName || user.username}</p>
              <p className="mt-0.5 text-[11px] font-medium text-ink-500">{roleLabels[user.role] || user.role}</p>
            </div>
          </div>
        </div>

        {navigation}

        <div className="border-t border-slate-200 p-3">
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-slate-200 bg-white px-6 md:flex lg:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-400">Workspace</span>
            <ChevronRight className="h-4 w-4 text-ink-300" />
            <span className="font-medium text-ink-800">{currentItem?.label || 'Overview'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-500">{today}</span>
            <span className="h-4 w-px bg-slate-200" />
            <span className="rounded-md bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">{roleLabels[user.role] || user.role}</span>
          </div>
        </div>
        <main id="main-content" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
