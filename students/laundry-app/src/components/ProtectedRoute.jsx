import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const dorm = searchParams.get('dorm') || 'rashleigh';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to={`/login?dorm=${dorm}`} replace />;
  }

  return children;
}

export default ProtectedRoute;
