import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { useToast } from '../components/ToastManager';
import { useLanguage } from '../contexts/LanguageContext';

function RecurringSchedules() {
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribeMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
      const machinesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMachines(machinesData);
    });

    return () => unsubscribeMachines();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'recurring_schedules'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecurringSchedules(schedules);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleDelete = async (scheduleId) => {
    if (!confirm('Delete this recurring schedule?')) return;

    try {
      await deleteDoc(doc(db, 'recurring_schedules', scheduleId));
      showToast('Recurring schedule deleted', 'success');
    } catch (error) {
      console.error('Error deleting:', error);
      showToast('Delete failed', 'error');
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  };

  const formatTime = (time) => {
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${ampm}`;
  };

  return (
    <div className="pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Recurring Schedules</h2>
        <p className="text-gray-600">Automatically book machines every week</p>
      </div>

      {recurringSchedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring schedules</h3>
          <p className="text-gray-600 mb-6">Set up weekly automatic bookings</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Add Recurring Schedule
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full mb-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            + Add New Recurring Schedule
          </button>

          <div className="space-y-4">
            {recurringSchedules.map(schedule => {
              const machine = machines.find(m => m.id === schedule.machineId);
              return (
                <div key={schedule.id} className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">
                        {machine?.type === 'washer' ? '🧺' : '💨'}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900">{machine?.label}</h3>
                        <p className="text-sm text-gray-600">{schedule.mode}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      Active
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-medium">Day:</span> {getDayName(schedule.dayOfWeek)}
                    </p>
                    <p>
                      <span className="font-medium">Time:</span> {formatTime(schedule.time)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="w-full mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showAddModal && (
        <AddRecurringModal
          machines={machines}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function AddRecurringModal({ machines, onClose }) {
  const [machineId, setMachineId] = useState('');
  const [mode, setMode] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [time, setTime] = useState('07:00');
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();

  const selectedMachine = machines.find(m => m.id === machineId);

  useEffect(() => {
    if (machines.length > 0 && !machineId) {
      setMachineId(machines[0].id);
      setMode(machines[0].modes[0].name);
    }
  }, [machines, machineId]);

  useEffect(() => {
    if (selectedMachine && selectedMachine.modes.length > 0) {
      setMode(selectedMachine.modes[0].name);
    }
  }, [selectedMachine]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'recurring_schedules'), {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        machineId,
        machineLabel: selectedMachine.label,
        machineType: selectedMachine.type,
        mode,
        dayOfWeek,
        time,
        isActive: true,
        createdAt: Timestamp.now()
      });

      showToast('Recurring schedule created!', 'success');
      onClose();
    } catch (error) {
      console.error('Error creating:', error);
      showToast('Failed to create', 'error');
    } finally {
      setLoading(false);
    }
  };

  const days = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Add Recurring Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Machine</label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              required
            >
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.type === 'washer' ? 'Washer' : 'Dryer'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              required
            >
              {selectedMachine?.modes.map(m => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.duration} min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              required
            >
              {days.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecurringSchedules;
