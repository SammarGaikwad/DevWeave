import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Repositories } from './pages/Repositories';
import { RepositoryDetails } from './pages/RepositoryDetails';
import { Pipelines } from './pages/Pipelines';
import { Deployments } from './pages/Deployments';
import { Docker } from './pages/Docker';
import { Kubernetes } from './pages/Kubernetes';
import { Monitoring } from './pages/Monitoring';
import { Logs } from './pages/Logs';
import { AI } from './pages/AI';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Main Application Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="repositories" element={<Repositories />} />
            <Route path="repositories/:repositoryId" element={<RepositoryDetails />} />
            <Route path="pipelines" element={<Pipelines />} />
            <Route path="deployments" element={<Deployments />} />
            <Route path="docker" element={<Docker />} />
            <Route path="kubernetes" element={<Kubernetes />} />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="logs" element={<Logs />} />
            <Route path="ai" element={<AI />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
