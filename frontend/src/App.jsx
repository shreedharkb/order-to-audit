import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Page Imports
import LoginPage from './pages/LoginPage';
import SalesmanDashboard from './pages/salesman/SalesmanDashboard';
import NewOrder from './pages/salesman/NewOrder';
import OrderList from './pages/salesman/OrderList';
import AdminDashboard from './pages/admin/AdminDashboard';
import OrderManagement from './pages/admin/OrderManagement';
import InvoiceManagement from './pages/admin/InvoiceManagement';
import InvoiceDetail from './pages/admin/InvoiceDetail';
import PurchaseManagement from './pages/admin/PurchaseManagement';
import PaymentManagement from './pages/admin/PaymentManagement';
import CustomerManagement from './pages/admin/CustomerManagement';
import ProductionDashboard from './pages/production/ProductionDashboard';
import ProductionRunPage from './pages/production/ProductionRunPage';
import InventoryPage from './pages/production/InventoryPage';
import BOMPage from './pages/production/BOMPage';
import ReportsPage from './pages/reports/ReportsPage';
import SalesReport from './pages/reports/SalesReport';
import GSTReport from './pages/reports/GSTReport';
import StockReport from './pages/reports/StockReport';
import ProductionReport from './pages/reports/ProductionReport';
import OutstandingReport from './pages/reports/OutstandingReport';
import CostReport from './pages/reports/CostReport';
import OwnerDashboard from './pages/owner/OwnerDashboard';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const routes = {
    salesman: '/salesman/dashboard',
    admin: '/admin/dashboard',
    production: '/production/dashboard',
    accountant: '/reports',
    owner: '/owner/dashboard'
  };
  return <Navigate to={routes[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* ================= Salesman Routes ================= */}
      <Route
        path="/salesman/dashboard"
        element={
          <ProtectedRoute roles={['salesman']}>
            <Layout><SalesmanDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/salesman/new-order"
        element={
          <ProtectedRoute roles={['salesman', 'admin']}>
            <Layout><NewOrder /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/salesman/orders"
        element={
          <ProtectedRoute roles={['salesman']}>
            <Layout><OrderList /></Layout>
          </ProtectedRoute>
        }
      />

      {/* ================= Admin & Invoicing Routes ================= */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={['admin', 'owner']}>
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute roles={['admin', 'owner']}>
            <Layout><OrderManagement /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/invoices"
        element={
          <ProtectedRoute roles={['admin', 'owner']}>
            <Layout><InvoiceManagement /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/invoices/:id"
        element={
          <ProtectedRoute roles={['admin', 'owner', 'accountant']}>
            <Layout><InvoiceDetail /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/purchases"
        element={
          <ProtectedRoute roles={['admin', 'owner', 'production']}>
            <Layout><PurchaseManagement /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <ProtectedRoute roles={['admin', 'owner', 'accountant']}>
            <Layout><PaymentManagement /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute roles={['admin', 'owner']}>
            <Layout><CustomerManagement /></Layout>
          </ProtectedRoute>
        }
      />

      {/* ================= Production Floor Routes ================= */}
      <Route
        path="/production/dashboard"
        element={
          <ProtectedRoute roles={['production', 'admin', 'owner']}>
            <Layout><ProductionDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/runs"
        element={
          <ProtectedRoute roles={['production', 'admin', 'owner']}>
            <Layout><ProductionRunPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/runs/:id"
        element={
          <ProtectedRoute roles={['production', 'admin', 'owner']}>
            <Layout><ProductionRunPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/inventory"
        element={
          <ProtectedRoute roles={['production', 'admin', 'owner', 'accountant']}>
            <Layout><InventoryPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/production/bom"
        element={
          <ProtectedRoute roles={['production', 'admin', 'owner']}>
            <Layout><BOMPage /></Layout>
          </ProtectedRoute>
        }
      />

      {/* ================= Reports & Auditor Routes ================= */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner']}>
            <Layout><ReportsPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/sales"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner']}>
            <Layout><SalesReport /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/gst"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner']}>
            <Layout><GSTReport /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/stock"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner', 'production']}>
            <Layout><StockReport /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/production"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner', 'production']}>
            <Layout><ProductionReport /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/outstanding"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner']}>
            <Layout><OutstandingReport /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/cost"
        element={
          <ProtectedRoute roles={['accountant', 'admin', 'owner', 'production']}>
            <Layout><CostReport /></Layout>
          </ProtectedRoute>
        }
      />

      {/* ================= Owner Command Center ================= */}
      <Route
        path="/owner/dashboard"
        element={
          <ProtectedRoute roles={['owner']}>
            <Layout><OwnerDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
