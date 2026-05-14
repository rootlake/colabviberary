import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, Timestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from './ToastManager';
import { useLanguage } from '../contexts/LanguageContext';
import { useDorm } from '../contexts/DormContext';

const DRYER_DURATIONS = [20, 30, 40, 50, 60];

function StartUseModal({ machine, onClose }) {
  const [mode, setMode] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(DRYER_DURATIONS[2]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [autoScheduleDryer, setAutoScheduleDryer] = useState(false);
  const [autoDryerDuration, setAutoDryerDuration] = useState(DRYER_DURATIONS[2]);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { currentDorm } = useDorm();

  const formatTimeRange = (start, end) => {
    const startStr = start.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const endStr = end.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${startStr} - ${endStr}`;
  };

  useEffect(() => {
    if (!machine) return;
    if (machine.type === 'dryer') {
      setDurationMinutes(DRYER_DURATIONS[2]);
      return;
    }
    if (machine.modes && machine.modes.length > 0) {
      setMode(machine.modes[0].name);
    }
  }, [machine]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dormId = machine?.dormId || currentDorm.id;
      const now = new Date();
      const duration = machine.type === 'dryer'
        ? durationMinutes
        : (machine.modes.find(m => m.name === mode)?.duration || 0);
      const endTime = new Date(now.getTime() + duration * 60000);

      const conflictsQuery = query(
        collection(db, 'schedules'),
        where('machineId', '==', machine.id),
        where('dormId', '==', dormId),
        where('status', 'in', ['scheduled', 'active'])
      );

      const conflictsSnapshot = await getDocs(conflictsQuery);
      const hasConflict = conflictsSnapshot.docs.some(docSnap => {
        const existing = docSnap.data();
        const existingStart = existing.startAt.toDate();
        const existingEnd = existing.endAt.toDate();
        return now < existingEnd && endTime > existingStart;
      });

      if (hasConflict) {
        showToast('Time conflicts with an existing booking', 'error');
        setLoading(false);
        return;
      }

      const scheduleRef = await addDoc(collection(db, 'schedules'), {
        dormId,
        machineId: machine.id,
        machineLabel: machine.label,
        machineType: machine.type,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email || null,
        mode: machine.type === 'dryer' ? `${duration} min` : mode,
        startAt: Timestamp.fromDate(now),
        endAt: Timestamp.fromDate(endTime),
        status: 'active',
        isRealtimeUse: true,
        note: note.trim() || null,
        createdAt: Timestamp.now()
      });

      await updateDoc(doc(db, 'machines', machine.id), {
        status: 'in_use',
        currentUserId: currentUser.uid,
        currentUserName: currentUser.displayName || currentUser.email,
        currentUserEmail: currentUser.email || null,
        currentScheduleId: scheduleRef.id,
        startAt: Timestamp.fromDate(now),
        durationMinutes: duration,
        estimatedEndAt: Timestamp.fromDate(endTime),
        actualEndAt: null,
        mode: machine.type === 'dryer' ? `${duration} min` : mode,
        updatedAt: Timestamp.now()
      });

      if (autoScheduleDryer && machine.type === 'washer') {
        const dryerQuery = query(
          collection(db, 'machines'),
          where('type', '==', 'dryer'),
          where('dormId', '==', dormId)
        );
        const dryerSnapshot = await getDocs(dryerQuery);
        
        if (dryerSnapshot.docs.length > 0) {
          const dryer = { id: dryerSnapshot.docs[0].id, ...dryerSnapshot.docs[0].data() };
          const dryerStart = new Date(endTime.getTime() + 5 * 60000);
          const dryerEnd = new Date(dryerStart.getTime() + autoDryerDuration * 60000);

          await addDoc(collection(db, 'schedules'), {
            dormId,
            machineId: dryer.id,
            machineLabel: dryer.label,
            machineType: 'dryer',
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            userEmail: currentUser.email || null,
            mode: `${autoDryerDuration} min`,
            startAt: Timestamp.fromDate(dryerStart),
            endAt: Timestamp.fromDate(dryerEnd),
            status: 'scheduled',
            isAutoDryer: true,
            linkedWasherScheduleId: scheduleRef.id,
            linkedWasherMachineId: machine.id,
            linkedWasherEndAt: Timestamp.fromDate(endTime),
            note: note.trim() || null,
            createdAt: Timestamp.now()
          });
        }
      }

      showToast('Started successfully!', 'success');
      
      if ('vibrate' in navigator) {
        navigator.vibrate(300);
      }
      
      onClose();
    } catch (error) {
      console.error('Error starting:', error);
      showToast('Failed to start', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Start Using Now</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center gap-3">
          <span className="text-3xl">{machine?.type === 'washer' ? '🧺' : '💨'}</span>
          <div>
            <h4 className="font-bold text-gray-900">{machine?.label}</h4>
            <p className="text-sm text-gray-600">{machine?.type === 'washer' ? 'Washer' : 'Dryer'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {machine?.type === 'dryer' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {DRYER_DURATIONS.map((minutes) => (
                  <option key={`dryer-${minutes}`} value={minutes}>
                    {minutes} minute
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formatTimeRange(new Date(), new Date(Date.now() + durationMinutes * 60000))}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {machine?.modes.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.duration} min)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Text me at 123-456-7890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">Add contact info if you might not get notifications</p>
          </div>

          {machine?.type === 'washer' && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScheduleDryer}
                  onChange={(e) => setAutoScheduleDryer(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900">Auto-schedule dryer after washing</div>
                  <div className="text-sm text-gray-600">Auto-book dryer 5 min after wash ends</div>
                </div>
              </label>

              {autoScheduleDryer && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dryer duration
                  </label>
                  <select
                    value={autoDryerDuration}
                    onChange={(e) => setAutoDryerDuration(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {DRYER_DURATIONS.map((minutes) => (
                      <option key={`auto-dryer-${minutes}`} value={minutes}>
                        {minutes} minute
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const washDuration = machine?.modes?.find(m => m.name === mode)?.duration || 0;
                      const washEnd = new Date(Date.now() + washDuration * 60000);
                      const dryerStart = new Date(washEnd.getTime() + 5 * 60000);
                      const dryerEnd = new Date(dryerStart.getTime() + autoDryerDuration * 60000);
                      return formatTimeRange(dryerStart, dryerEnd);
                    })()}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Starting...' : 'Start'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StartUseModal;
