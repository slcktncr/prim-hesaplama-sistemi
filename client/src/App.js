import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import SalesList from './components/Sales/SalesList';
import SaleForm from './components/Sales/SaleForm';
import CancelledSales from './components/Sales/CancelledSales';
import PrimSettings from './components/Prims/PrimSettings';
import PrimPeriods from './components/Prims/PrimPeriods';
import PrimTransactions from './components/Prims/PrimTransactions';
import PrimEarnings from './components/Prims/PrimEarnings';
import Reports from './components/Reports/Reports';
import PendingUsers from './components/Admin/PendingUsers';
import UserPermissions from './components/Admin/UserPermissions';
import SystemSettings from './components/SystemSettings/SystemSettings';
import Profile from './components/Profile/Profile';
import DailyCommunicationEntry from './components/Communications/DailyCommunicationEntry';
import CommunicationSalesReport from './components/Communications/CommunicationSalesReport';
import Loading from './components/Common/Loading';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
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
                    
                    {/* Satış Routes */}
                    <Route path="/sales" element={<SalesList />} />
                    <Route path="/sales/new" element={<SaleForm />} />
                    <Route path="/sales/edit/:id" element={<SaleForm />} />
                    <Route path="/sales/cancelled" element={<CancelledSales />} />
                    
                    {/* İletişim Routes */}
                    <Route path="/communications/daily" element={<DailyCommunicationEntry />} />
                    <Route path="/communications/reports" element={<CommunicationSalesReport />} />
                    
                    {/* Prim Routes */}
                    <Route path="/prims/transactions" element={<PrimTransactions />} />
                    <Route path="/prims/earnings" element={<PrimEarnings />} />
                    
                    {/* Admin Routes */}
                    <Route
                      path="/prims/periods"
                      element={
                        <ProtectedRoute adminOnly={true}>
                          <PrimPeriods />
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Reports */}
                    <Route path="/reports" element={<Reports />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin/pending-users" element={
                      <ProtectedRoute adminOnly={true}>
                        <PendingUsers />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/user-permissions" element={
                      <ProtectedRoute adminOnly={true}>
                        <UserPermissions />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/system-settings" element={
                      <ProtectedRoute adminOnly={true}>
                        <SystemSettings />
                      </ProtectedRoute>
                    } />
                    
                    {/* Profile Route */}
                    <Route path="/profile" element={<Profile />} />
                    
                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
