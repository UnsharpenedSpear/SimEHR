import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildM3Theme } from '../theme/theme.js';
import { useUIStore } from '../stores/uiStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { AppShell } from '../components/layout/AppShell.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { LoginPage } from '../features/auth/LoginPage.js';
import { PatientListPage } from '../features/patients/PatientListPage.js';
import { PatientRegistrationPage } from '../features/patients/PatientRegistrationPage.js';
import { UsersManagementPage } from '../features/admin/UsersManagementPage.js';
import { RolesMatrixPage } from '../features/admin/RolesMatrixPage.js';
import { AuditLogViewerPage } from '../features/audit/AuditLogViewerPage.js';
import { PatientChartPage } from '../features/chart/PatientChartPage.js';
import { DispatchBoardPage } from '../features/dispatch/DispatchBoardPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  const { themeMode } = useUIStore();
  const theme = React.useMemo(() => buildM3Theme(themeMode), [themeMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="patients" element={<PatientListPage />} />
              <Route path="patients/new" element={<PatientRegistrationPage />} />
              <Route path="patients/:id" element={<PatientChartPage />} />
              <Route path="dispatch/*" element={<DispatchBoardPage />} />
              <Route path="lab/*" element={<DispatchBoardPage />} />
              <Route path="pharmacy/*" element={<DispatchBoardPage />} />
              <Route path="radiology/*" element={<DispatchBoardPage />} />
              <Route path="appointments/*" element={<DashboardPage />} />
              <Route path="billing/*" element={<DashboardPage />} />
              <Route path="reports/*" element={<DashboardPage />} />
              <Route path="audit" element={<AuditLogViewerPage />} />
              <Route path="admin" element={<UsersManagementPage />} />
              <Route path="admin/roles" element={<RolesMatrixPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
