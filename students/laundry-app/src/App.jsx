import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { DormProvider } from './contexts/DormContext';
import { ToastProvider } from './components/ToastManager';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Feedback from './pages/Feedback';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';
import DormSelector from './components/DormSelector';

function MainLayout({ children }) {
  return (
    <>
      <div className="max-w-4xl mx-auto p-4">
        <DormSelector />
        {children}
      </div>
      <BottomNav />
    </>
  );
}

function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <DormProvider>
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminLayout>
                      <Admin />
                    </AdminLayout>
                  </ProtectedRoute>
                } />
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/calendar" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Calendar />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/feedback" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Feedback />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Settings />
                    </MainLayout>
                  </ProtectedRoute>
                } />
              </Routes>
            </ToastProvider>
          </DormProvider>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
