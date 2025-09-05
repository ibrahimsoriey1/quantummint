import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './assets/styles/theme';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

// Layout Components
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import TwoFactorAuth from './pages/auth/TwoFactorAuth';

// Main Pages
import Dashboard from './pages/Dashboard';
import MoneyGeneration from './pages/MoneyGeneration';
import Wallet from './pages/Wallet';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import KYCVerification from './pages/KYCVerification';
import PaymentMethods from './pages/PaymentMethods';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Security from './pages/Security';
import Integrations from './pages/Integrations';
import Reports from './pages/Reports';
import Support from './pages/Support';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Contact from './pages/Contact';
import HelpCenter from './pages/HelpCenter';
import Providers from './pages/Providers';
import Balances from './pages/Balances';
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersAdmin from './pages/admin/UsersAdmin';
import ProvidersAdmin from './pages/admin/ProvidersAdmin';
import TransactionsAdmin from './pages/admin/TransactionsAdmin';

// Error Pages
import NotFound from './pages/errors/NotFound';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/two-factor-auth" element={<TwoFactorAuth />} />
        </Route>
        
        {/* Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<MoneyGeneration />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/kyc" element={<KYCVerification />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/security" element={<Security />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/balances" element={<Balances />} />
          <Route path="/support" element={<Support />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<HelpCenter />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersAdmin />} />
          <Route path="/admin/providers" element={<ProvidersAdmin />} />
          <Route path="/admin/transactions" element={<TransactionsAdmin />} />
        </Route>
        
        {/* Error Routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;