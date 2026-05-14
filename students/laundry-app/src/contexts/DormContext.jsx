import { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

const DormContext = createContext();

export const DORMS = {
  rashleigh: { id: 'rashleigh', name: 'Rashleigh', color: '#2563eb' },
  grove: { id: 'grove', name: 'Grove', color: '#059669' },
  colebrook: { id: 'colebrook', name: 'Colebrook', color: '#dc2626' }
};

const DORM_STORAGE_KEY = 'laundryAppDorm';

export function DormProvider({ children }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDorm, setCurrentDorm] = useState(null);

  useEffect(() => {
    const dormParam = searchParams.get('dorm');
    const storedDorm = localStorage.getItem(DORM_STORAGE_KEY);
    const fallbackDorm = DORMS[storedDorm] ? storedDorm : 'rashleigh';
    const resolvedDorm = DORMS[dormParam] ? dormParam : fallbackDorm;

    if (!dormParam || !DORMS[dormParam]) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('dorm', resolvedDorm);
      navigate(
        { pathname: location.pathname, search: `?${nextParams.toString()}` },
        { replace: true }
      );
    }

    setCurrentDorm(DORMS[resolvedDorm]);
    localStorage.setItem(DORM_STORAGE_KEY, resolvedDorm);
  }, [searchParams, navigate, location.pathname]);

  if (!currentDorm) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <DormContext.Provider value={{ currentDorm, allDorms: DORMS }}>
      {children}
    </DormContext.Provider>
  );
}

export function useDorm() {
  const context = useContext(DormContext);
  if (!context) {
    throw new Error('useDorm must be used within DormProvider');
  }
  return context;
}
