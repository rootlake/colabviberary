import { Outlet, Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

function Layout() {
  const location = useLocation();
  const { t } = useLanguage();
  
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            <Link
              to="/"
              className={`flex flex-col items-center justify-center flex-1 py-2 ${
                isActive('/') ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <span className="text-2xl mb-1">🏠</span>
              <span className="text-xs font-medium">{t('home')}</span>
            </Link>

            <Link
              to="/calendar"
              className={`flex flex-col items-center justify-center flex-1 py-2 ${
                isActive('/calendar') ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <span className="text-2xl mb-1">📅</span>
              <span className="text-xs font-medium">{t('calendar')}</span>
            </Link>

            <Link
              to="/settings"
              className={`flex flex-col items-center justify-center flex-1 py-2 ${
                isActive('/settings') ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              <span className="text-2xl mb-1">⚙️</span>
              <span className="text-xs font-medium">{t('settings')}</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default Layout;
