import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const workflow = [
  { step: '01', title: 'Capture the order', text: 'Field orders move directly to the factory desk.' },
  { step: '02', title: 'Track production', text: 'BOM usage, yield, stock, and cost stay connected.' },
  { step: '03', title: 'Close the audit trail', text: 'Invoices, dispatch, collections, and reports reconcile.' }
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
      toast.success(`Welcome, ${data.user.full_name || data.user.fullName}!`);
      navigate(roleRoutes[data.user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(440px,0.96fr)]">
      <main className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-14 lg:py-9 xl:px-20">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold tracking-[-0.035em] text-ink-950">FactoryLoop</p>
            <p className="mt-1 text-xs text-ink-500">Sri Lakshmi Foods · Tiruchirappalli</p>
          </div>
          <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-600 shadow-sm sm:inline-flex">
            Operations workspace
          </span>
        </header>

        <div className="flex flex-1 items-center py-12 sm:py-16">
          <div className="w-full max-w-[420px] animate-fade-in">
            <p className="eyebrow">Secure workspace</p>
            <h1 className="mt-3 text-balance font-display text-[34px] font-bold leading-[1.12] tracking-[-0.04em] text-ink-950 sm:text-[38px]">
              Welcome back
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-ink-500">
              Sign in with your factory account to continue to the operations workspace.
            </p>

            {error && (
              <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  value={form.username}
                  onChange={event => setForm({ ...form, username: event.target.value })}
                  placeholder="Enter your username"
                  aria-invalid={Boolean(error)}
                  className="h-12 bg-slate-50/60 px-4 text-[15px] focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={event => setForm({ ...form, password: event.target.value })}
                    placeholder="Enter your password"
                    aria-invalid={Boolean(error)}
                    className="h-12 bg-slate-50/60 px-4 pr-12 text-[15px] focus:bg-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-lg text-[15px]">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign in to workspace'}
              </Button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold text-ink-800">Need an account?</p>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                Contact your factory administrator. Access is limited to authorized factory, sales, production, and audit roles.
              </p>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-400">
          <p>© {new Date().getFullYear()} Sri Lakshmi Foods</p>
          <p>Authorized personnel only</p>
        </footer>
      </main>

      <aside className="relative hidden overflow-hidden bg-ink-950 px-12 py-10 text-white lg:flex lg:flex-col xl:px-16">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary-500" aria-hidden="true" />

        <div className="flex items-center justify-between gap-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-400">Manufacturing operations</p>
          <span className="text-[11px] font-medium text-slate-500">System of record</span>
        </div>

        <div className="my-auto max-w-xl py-12">
          <h2 className="text-balance font-display text-[36px] font-bold leading-[1.16] tracking-[-0.04em] xl:text-[42px]">
            From field order to final audit, in one connected record.
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-400">
            Sales, production, inventory, billing, and collections share the same operational trail.
          </p>

          <ol className="mt-10 border-t border-white/10">
            {workflow.map(item => (
              <li key={item.step} className="grid grid-cols-[44px_1fr] gap-4 border-b border-white/10 py-5">
                <span className="pt-0.5 font-display text-sm font-bold tabular-nums text-primary-400">{item.step}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">One workspace for</p>
          <p className="mt-2 text-sm font-medium text-slate-300">Sales · Production · Inventory · Billing · Collections</p>
        </div>
      </aside>
    </div>
  );
}
