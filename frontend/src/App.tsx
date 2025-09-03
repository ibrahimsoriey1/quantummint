import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import TwoFA from './pages/TwoFA';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Transactions from './pages/Transactions';
import Payments from './pages/Payments';
import KYC from './pages/KYC';
import Shell from './components/Shell';
import Transfer from './pages/Transfer';
import Balance from './pages/Balance';
import KYCUpload from './pages/KYCUpload';
import CardPayment from './pages/CardPayment';
import MobileMoney from './pages/MobileMoney';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/2fa" element={<TwoFA />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Shell>
                <Dashboard />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <PrivateRoute>
              <Shell>
                <Wallet />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <PrivateRoute>
              <Shell>
                <Transactions />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <PrivateRoute>
              <Shell>
                <Payments />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/pay/card"
          element={
            <PrivateRoute>
              <Shell>
                <CardPayment />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/pay/mobile"
          element={
            <PrivateRoute>
              <Shell>
                <MobileMoney />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/kyc"
          element={
            <PrivateRoute>
              <Shell>
                <KYC />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/kyc/upload"
          element={
            <PrivateRoute>
              <Shell>
                <KYCUpload />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/transfer"
          element={
            <PrivateRoute>
              <Shell>
                <Transfer />
              </Shell>
            </PrivateRoute>
          }
        />
        <Route
          path="/balance"
          element={
            <PrivateRoute>
              <Shell>
                <Balance />
              </Shell>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}


