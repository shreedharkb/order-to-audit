import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          { path: '/reports/stock', label: 'Stock Ledger', icon: Package },
          { path: '/reports/production', label: 'Variance Report', icon: Factory },
          { path: '/reports/outstanding', label: 'Ageing & Dues', icon: Wallet }
        ];

      case 'owner':
      default:
        return [
          { path: '/owner/dashboard', label: 'Command Center', icon: LayoutDashboard },
          { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
          { path: '/admin/invoices', label: 'Invoices', icon: FileText },
          { path: '/production/runs', label: 'Production Runs', icon: Factory },
          { path: '/production/inventory', label: 'Stock Ledger', icon: Package },
          { path: '/reports', label: 'All Reports', icon: BarChart3 }
        ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-gradient-to-r from-orange-700 to-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-md z-30 sticky top-0">
        <div className="flex items-center space-x-2">
          <Building2 className="w-6 h-6 text-orange-200" />
          <div>
            <h1 className="text-base font-bold leading-tight">Sri Lakshmi Foods</h1>
            <p className="text-[10px] text-orange-200 uppercase tracking-wider font-medium">Order to Audit ERP</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-orange-800/60 hover:bg-orange-800 focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-stone-900 text-stone-200 shadow-xl min-h-screen sticky top-0">
        {/* Brand */}
        <div className="p-5 border-b border-stone-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-900/50">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Sri Lakshmi Foods</h2>
            <p className="text-xs text-orange-400 font-medium">Tiruchirappalli, TN</p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-5 py-4 bg-stone-950/50 border-b border-stone-800/80">
          <p className="text-xs text-stone-400">Logged in as</p>
          <p className="text-sm font-semibold text-white truncate">{user.fullName || user.username}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-orange-950 text-orange-400 border border-orange-800/50">
            {user.role}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-950'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-4 border-t border-stone-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-stone-400 hover:text-red-400 hover:bg-stone-800/70 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-stone-950/80 backdrop-blur-sm flex flex-col">
          <div className="p-5 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center space-x-2 text-white">
              <Building2 className="w-6 h-6 text-orange-500" />
              <span className="font-bold text-lg">Sri Lakshmi Foods</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-stone-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-4 border-b border-stone-800 text-sm">
            <p className="text-stone-400 text-xs">Logged in as</p>
            <p className="text-white font-semibold">{user.fullName || user.username} ({user.role})</p>
          </div>
          <div className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium ${
                    isActive ? 'bg-orange-600 text-white' : 'text-stone-300 hover:bg-stone-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="p-4 border-t border-stone-800">
            <button
              onClick={handleLogout}
              className="w-full py-3 flex items-center justify-center space-x-2 text-red-400 bg-stone-900 rounded-xl font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
