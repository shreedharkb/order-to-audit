import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Package,
  Factory,
  Wallet,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

export default function ReportsPage() {
  const reports = [
    {
      title: 'Sales Register',
      desc: 'Customer-wise & product-wise sales with CGST, SGST & IGST breakdown',
      path: '/reports/sales',
      icon: FileText,
      color: 'bg-blue-50 text-blue-600 border-blue-200'
    },
    {
      title: 'GST Outward Supplies (GSTR-1 / 3B)',
      desc: 'Tax schedule grouped by rate, intra vs inter-state supply for filing',
      path: '/reports/gst',
      icon: ShieldCheck,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200'
    },
    {
      title: 'Stock Summary & Audit Ledger',
      desc: 'Live floor balance reconciliation, unit rates, and inventory movement history',
      path: '/reports/stock',
      icon: Package,
      color: 'bg-purple-50 text-purple-600 border-purple-200'
    },
    {
      title: 'Production Variance Report',
      desc: 'Recipe consumption vs actual yield, scrap rates, and tolerance alerts (>3%)',
      path: '/reports/production',
      icon: Factory,
      color: 'bg-amber-50 text-amber-600 border-amber-200'
    },
    {
      title: 'Receivables & Ageing Analysis',
      desc: 'Customer outstanding amounts grouped by 0-30, 31-60, 61-90, 90+ days',
      path: '/reports/outstanding',
      icon: Wallet,
      color: 'bg-rose-50 text-rose-600 border-rose-200'
    },
    {
      title: 'Cost per Packet & Margins',
      desc: 'Weighted average raw materials + direct labour & overheads allocation',
      path: '/reports/cost',
      icon: TrendingUp,
      color: 'bg-orange-50 text-orange-600 border-orange-200'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Financial & Production Auditor Portal</h1>
        <p className="text-sm text-gray-500">Exportable registers and analytical audit reports ready for monthly sign-off</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reports.map((rep, idx) => {
          const Icon = rep.icon;
          return (
            <Link
              key={idx}
              to={rep.path}
              className="bg-white rounded-2xl p-6 border border-gray-200/90 shadow-sm hover:shadow-md hover:border-orange-400 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold ${rep.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                  {rep.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">{rep.desc}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-orange-600">
                <span>View Full Schedule</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
