import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Eye, EyeOff, LogIn, Loader2, ClipboardList, PackageCheck, FileCheck2, ShieldCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const workflow = [
  { icon: ClipboardList, title: 'Capture the order', text: 'Field orders flow directly to the factory desk.' },
  { icon: PackageCheck, title: 'Track production', text: 'BOM usage, yield, stock, and cost stay connected.' },
  { icon: FileCheck2, title: 'Close the audit trail', text: 'Invoices, dispatch, collections, and reports reconcile.' }
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleRoutes = {
    salesman: '/salesman/dashboard',
    admin: '/admin/dashboard',
    production: '/production/dashboard',
    accountant: '/reports',
    owner: '/owner/dashboard'
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/auth/login', form);
      login(data.token, data.user);
      toast.success(`Welcome, ${data.user.full_name}!`);
      navigate(roleRoutes[data.user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-950/40"><Factory className="h-6 w-6" /></span>
          <div>
            <p className="text-lg font-bold tracking-tight">Sri Lakshmi Foods</p>
            <p className="text-xs font-medium text-ink-400">Tiruchirappalli, Tamil Nadu</p>
          </div>
        </div>

        <div className="relative max-w-xl py-12">
          <p className="eyebrow text-primary-300">FactoryLoop ERP</p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">
            One connected workflow, from field order to final audit.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-300">
            A single operational record for sales, production, inventory, billing, and collections—built for a small food manufacturer.
          </p>

          <div className="mt-10 space-y-5">
            {workflow.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-primary-300"><Icon className="h-5 w-5" /></span>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-ink-500">0{index + 1}</span>
                      <h2 className="text-sm font-bold text-white">{item.title}</h2>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-ink-400">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs font-medium text-ink-500">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Role-based access · Ledger-backed stock · Traceable transactions
        </div>
      </section>

      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm"><Factory className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-bold text-ink-950">Sri Lakshmi Foods</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">FactoryLoop ERP</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[440px]">
            <div className="mb-8">
              <p className="eyebrow">Secure workspace</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">Sign in with your assigned account to continue.</p>
            </div>

            <div className="surface p-6 sm:p-8">
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800" role="alert">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="label">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={form.username}
                    onChange={event => setForm({ ...form, username: event.target.value })}
                    className="input-field h-12"
                    placeholder="Enter your username"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onChange={event => setForm({ ...form, password: event.target.value })}
                      className="input-field h-12 pr-12"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 hover:text-ink-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-[15px]">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  {loading ? 'Signing in...' : 'Sign in to workspace'}
                  {!loading && <ArrowRight className="ml-auto h-4 w-4" />}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-ink-400">
              Access is limited to authorized factory, sales, production, and audit roles.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-400">© {new Date().getFullYear()} Sri Lakshmi Foods · Powered by FactoryLoop</p>
      </main>
    </div>
  );
}
