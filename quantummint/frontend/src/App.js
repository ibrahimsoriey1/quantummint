import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Auth Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import TwoFactorAuth from './pages/Auth/TwoFactorAuth';

// Dashboard
import Dashboard from './pages/Dashboard/Dashboard';

// Money Generation
import MoneyGeneration from './pages/MoneyGeneration/MoneyGeneration';
import GenerationHistory from './pages/MoneyGeneration/GenerationHistory';

// Wallet
import Wallet from './pages/Wallet/Wallet';
import TransactionHistory from './pages/Wallet/TransactionHistory';

// Payments
import Payments from './pages/Payments/Payments';
import PaymentHistory from './pages/Payments/PaymentHistory';

// KYC
import KYCVerification from './pages/KYC/KYCVerification';
import DocumentUpload from './pages/KYC/DocumentUpload';
import VerificationStatus from './pages/KYC/VerificationStatus';

// Profile
import Profile from './pages/Profile/Profile';
import Settings from './pages/Profile/Settings';

// Admin (if user has admin role)
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import SystemSettings from './pages/Admin/SystemSettings';

function App() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        Loading...
      </Box>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />}
      />
      <Route
        path="/register"
        element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />}
      />
      <Route
        path="/forgot-password"
        element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />}
      />
      <Route
        path="/reset-password/:token"
        element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/dashboard" />}
      />
      <Route
        path="/2fa"
        element={!isAuthenticated ? <TwoFactorAuth /> : <Navigate to="/dashboard" />}
      />

      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Money Generation */}
                <Route path="/generate" element={<MoneyGeneration />} />
                <Route path="/generation-history" element={<GenerationHistory />} />
                
                {/* Wallet */}
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/transactions" element={<TransactionHistory />} />
                
                {/* Payments */}
                <Route path="/payments" element={<Payments />} />
                <Route path="/payment-history" element={<PaymentHistory />} />
                
                {/* KYC */}
                <Route path="/kyc" element={<KYCVerification />} />
                <Route path="/kyc/documents" element={<DocumentUpload />} />
                <Route path="/kyc/status" element={<VerificationStatus />} />
                
                {/* Profile */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Admin Routes */}
                {user?.role === 'admin' && (
                  <>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                    <Route path="/admin/settings" element={<SystemSettings />} />
                  </>
                )}
                
                {/* 404 */}
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
