import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

function BottomNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  
  // 获取当前dorm参数，如果没有就用rashleigh
  const dorm = searchParams.get('dorm') || 'rashleigh';

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-around items-center py-2">
          <Link
            to={`/?dorm=${dorm}`}
            className={`flex flex-col items-center px-4 py-2 transition-colors ${
              isActive('/') ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1">{t('home')}</span>
          </Link>

          <Link
            to={`/calendar?dorm=${dorm}`}
            className={`flex flex-col items-center px-4 py-2 transition-colors ${
              isActive('/calendar') ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <span className="text-2xl">📅</span>
            <span className="text-xs mt-1">{t('calendar')}</span>
          </Link>

          <Link
            to={`/settings?dorm=${dorm}`}
            className={`flex flex-col items-center px-4 py-2 transition-colors ${
              isActive('/settings') ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-xs mt-1">{t('settings')}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default BottomNav;
