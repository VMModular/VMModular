import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import SettingsPage from './pages/SettingsPage';
import OrgStructurePage from './pages/OrgStructurePage';
import CalendarPage from './pages/CalendarPage';
import Layout from './components/Layout';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/leads" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={
          <PrivateRoute roles={['OWNER', 'SENIOR_MANAGER']}>
            <DashboardPage />
          </PrivateRoute>
        } />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={
          <PrivateRoute roles={['OWNER']}>
            <SettingsPage />
          </PrivateRoute>
        } />
        <Route path="settings/org" element={
          <PrivateRoute roles={['OWNER']}>
            <OrgStructurePage />
          </PrivateRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
