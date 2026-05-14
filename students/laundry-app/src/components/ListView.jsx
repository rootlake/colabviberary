import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from './ToastManager';

function ListView() {
  const [allSchedules, setAllSchedules] = useState([]);
  const [filter, setFilter] = useState('all');
  const currentUser = auth.currentUser;
  const { t } = useLanguage();
  const { showToast } = useToast();

  useEffect(() => {
    const q = query(
      collection(db, 'schedules'),
      orderBy('startAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const schedulesData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(s => {
          if (s.status === 'cancelled') return false;
          const endTime = s.endAt.toDate();
          return endTime > now;
        });
      
      setAllSchedules(schedulesData);
    });

    return () => unsubscribe();
  }, []);

  const filteredSchedules = filter === 'mine' 
    ? allSchedules.filter(s => s.userId === currentUser.uid)
    : allSchedules;

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.scheduled;
  };

  const isLive = (schedule) => {
    if (!schedule.isRealtimeUse || schedule.status !== 'active') return false;
    const now = new Date();
    const startTime = schedule.startAt.toDate();
    const endTime = schedule.endAt.toDate();
    return startTime <= now && endTime > now;
  };

  const handleCancelSchedule = async (schedule) => {
    if (schedule.userId !== currentUser.uid) {
      showToast('Can only cancel your own bookings', 'error');
      return;
    }

    if (isLive(schedule)) {
      showToast('Cannot cancel machine in use', 'warning');
      return;
    }

    const now = new Date();
    const startTime = schedule.startAt.toDate();
    
    if (startTime <= now) {
      showToast('Cannot cancel started booking', 'error');
      return;
    }

    if (!confirm('Cancel this booking?')) return;

    try {
      await updateDoc(doc(db, 'schedules', schedule.id), {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
      showToast('Booking cancelled', 'success');
    } catch (error) {
      console.error('Error canceling:', error);
      showToast('Cancel failed', 'error');
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            All Bookings ({allSchedules.length})
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              filter === 'mine'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            My Bookings ({allSchedules.filter(s => s.userId === currentUser.uid).length})
          </button>
        </div>
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'mine' ? 'No upcoming bookings' : 'No upcoming bookings'}
          </h3>
          <p className="text-gray-600">Schedule a machine to see it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map((schedule) => {
            const isMine = schedule.userId === currentUser.uid;
            const isScheduleLive = isLive(schedule);

            return (
              <div
                key={schedule.id}
                className={`bg-white rounded-lg shadow-md p-4 ${
                  isMine ? 'border-2 border-blue-400' : 'border-2 border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {schedule.machineType === 'washer' ? '🧺' : '💨'}
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-900">{schedule.machineLabel}</h3>
                      <p className="text-sm text-gray-600">{schedule.userName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isScheduleLive ? (
                      <span className="px-3 py-1 bg-purple-500 text-white rounded-full text-xs font-bold animate-pulse">
                        🔴 LIVE
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                        {schedule.status}
                      </span>
                    )}
                    {isMine && !isScheduleLive && (
                      <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold">
                        Mine
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-700 mb-3">
                  <p className="mb-1">
                    <span className="font-medium">Mode:</span> {schedule.mode}
                  </p>
                  <p>
                    <span className="font-medium">Time:</span>{' '}
                    {formatDateTime(schedule.startAt)} - {formatDateTime(schedule.endAt)}
                  </p>
                </div>

                {isMine && !isScheduleLive && schedule.status === 'scheduled' && (
                  <button
                    onClick={() => handleCancelSchedule(schedule)}
                    className="w-full bg-red-100 text-red-800 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ListView;
