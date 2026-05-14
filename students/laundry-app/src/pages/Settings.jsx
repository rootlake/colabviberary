import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useDorm } from '../contexts/DormContext';
import { useToast } from '../components/ToastManager';

function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { currentDorm } = useDorm();
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const dorm = searchParams.get('dorm') || 'rashleigh';

  useEffect(() => {
    setDisplayName(currentUser?.displayName || '');
  }, [currentUser?.displayName]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate(`/login?dorm=${dorm}`);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleFeedback = () => {
    navigate(`/feedback?dorm=${dorm}`);
  };

  const handleSaveName = async () => {
    if (!currentUser) return;
    const nextName = displayName.trim();
    if (!nextName) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(currentUser, { displayName: nextName });
      showToast('Name updated', 'success');
    } catch (error) {
      showToast('Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('settings')}</h2>
        <p className="text-gray-600">Manage your preferences</p>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2">Account</h3>
          <p className="text-sm text-gray-600">{currentUser?.email}</p>
          <p className="text-sm text-gray-500 mt-1">{currentUser?.displayName || displayName}</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2">Display Name</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your name"
              maxLength={50}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2">Dormitory</h3>
          <p className="text-sm text-gray-600">{currentDorm.name}</p>
        </div>

        <button
          onClick={handleFeedback}
          className="w-full p-4 text-left border-b border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Feedback</h3>
              <p className="text-sm text-gray-600">Report bugs or suggest features</p>
            </div>
            <span className="text-2xl">💡</span>
          </div>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full p-4 text-left hover:bg-red-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-red-600">Sign Out</h3>
              <p className="text-sm text-gray-600">Log out of your account</p>
            </div>
            <span className="text-2xl">🚪</span>
          </div>
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
        <p className="text-sm text-gray-600">Laundry Manager v1.0</p>
        <p className="text-xs text-gray-500 mt-1">Dormitory Laundry Management System</p>
      </div>

      <div className="mt-4 bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2">Laundry Tips</h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Separate whites, colors, and darks</li>
            <li>Use cold water for colors to prevent fading</li>
            <li>Clean the lint filter before every dry</li>
            <li>Don’t overload the machine</li>
            <li>Check pockets before washing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Settings;
