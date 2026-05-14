import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '../components/ToastManager';
import { useLanguage } from '../contexts/LanguageContext';
import { useDorm } from '../contexts/DormContext';

function Feedback() {
  const [type, setType] = useState('suggestion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { currentDorm } = useDorm();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'feedback'), {
        dormId: currentDorm.id,
        type,
        title: title.trim(),
        description: description.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      showToast('Feedback submitted successfully!', 'success');
      
      setTitle('');
      setDescription('');
      setType('suggestion');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showToast('Failed to submit feedback', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Feedback</h2>
        <p className="text-gray-600">Help us improve the laundry system</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  type === 'bug'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🐛</div>
                <div className="text-sm font-medium text-gray-900">Bug Report</div>
              </button>
              <button
                type="button"
                onClick={() => setType('machine')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  type === 'machine'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🔧</div>
                <div className="text-sm font-medium text-gray-900">Machine Issue</div>
              </button>
              <button
                type="button"
                onClick={() => setType('suggestion')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  type === 'suggestion'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">💡</div>
                <div className="text-sm font-medium text-gray-900">Suggestion</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={
                type === 'bug' ? 'Brief description of the bug' :
                type === 'machine' ? 'Which machine and what issue?' :
                'Your suggestion in one line'
              }
              required
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="6"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={
                type === 'bug' ? 'Steps to reproduce, expected vs actual behavior...' :
                type === 'machine' ? 'What happened? When? Which machine?' :
                'Explain your suggestion in detail...'
              }
              required
              maxLength={1000}
            ></textarea>
            <div className="text-xs text-gray-500 mt-1 text-right">
              {description.length}/1000 characters
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Tips for good feedback:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Be specific about the issue or suggestion</li>
                  <li>Include machine numbers if relevant</li>
                  <li>Mention when the issue occurred</li>
                  <li>Suggest solutions if you have ideas</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Your feedback helps improve the laundry experience for everyone. Thank you! 🙏
        </p>
      </div>
    </div>
  );
}

export default Feedback;
