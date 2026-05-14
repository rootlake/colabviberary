import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { useToast } from './ToastManager';
import { useLanguage } from '../contexts/LanguageContext';
import { useDorm } from '../contexts/DormContext';

const DRYER_DURATIONS = [20, 30, 40, 50, 60];

function ScheduleModal({ machine, initialDateTime, onClose }) {
  const [mode, setMode] = useState('');
  const [date, setDate] = useState('today');
  const [time, setTime] = useState('17:00');
  const [autoScheduleDryer, setAutoScheduleDryer] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(DRYER_DURATIONS[2]);
  const [autoDryerDuration, setAutoDryerDuration] = useState(DRYER_DURATIONS[2]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { currentDorm } = useDorm();

  const formatDateValue = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateValue = (value) => {
    if (typeof value !== 'string') {
      return new Date(value);
    }

    const parts = value.split('-').map((part) => parseInt(part, 10));
    if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
      const [year, month, day] = parts;
      return new Date(year, month - 1, day);
    }

    return new Date(value);
  };

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

  const buildScheduledDate = () => {
    let scheduledDate = new Date();
    if (date === 'today') {
      scheduledDate = new Date();
    } else if (date === 'tomorrow') {
      scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    } else {
      scheduledDate = parseDateValue(date);
    }

    const [hours, minutes] = time.split(':');
    scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return scheduledDate;
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

  useEffect(() => {
    if (initialDateTime) {
      const initDate = parseDateValue(initialDateTime.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      initDate.setHours(0, 0, 0, 0);
      
      if (initDate.getTime() === today.getTime()) {
        setDate('today');
      } else {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (initDate.getTime() === tomorrow.getTime()) {
          setDate('tomorrow');
        } else {
          setDate(formatDateValue(initDate));
        }
      }
      
      if (initialDateTime.time) {
        setTime(initialDateTime.time);
      }
    }
  }, [initialDateTime]);

  const generateDateOptions = () => {
    const options = [
      { value: 'today', label: 'Today' },
      { value: 'tomorrow', label: 'Tomorrow' }
    ];
    
    // Add next 7 days
    for (let i = 2; i <= 7; i++) {
      const optionDate = new Date();
      optionDate.setDate(optionDate.getDate() + i);
      const value = formatDateValue(optionDate);
      const label = optionDate.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      options.push({ value, label });
    }
    
    return options;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dormId = machine?.dormId || currentDorm.id;
      const duration = machine.type === 'dryer'
        ? durationMinutes
        : (machine.modes.find(m => m.name === mode)?.duration || 0);

      const scheduledDate = buildScheduledDate();

      const endTime = new Date(scheduledDate.getTime() + duration * 60000);

      const now = new Date();
      if (scheduledDate <= now) {
        showToast('Cannot schedule in the past', 'error');
        setLoading(false);
        return;
      }

      const conflictsQuery = query(
        collection(db, 'schedules'),
        where('machineId', '==', machine.id),
        where('dormId', '==', dormId),
        where('status', 'in', ['scheduled', 'active'])
      );

      const conflictsSnapshot = await getDocs(conflictsQuery);
      const hasConflict = conflictsSnapshot.docs.some(doc => {
        const existingSchedule = doc.data();
        const existingStart = existingSchedule.startAt.toDate();
        const existingEnd = existingSchedule.endAt.toDate();
        return (
          (scheduledDate >= existingStart && scheduledDate < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd) ||
          (scheduledDate <= existingStart && endTime >= existingEnd)
        );
      });

      if (hasConflict) {
        showToast('Time slot already booked', 'error');
        setLoading(false);
        return;
      }

      const washerRef = await addDoc(collection(db, 'schedules'), {
        dormId,
        machineId: machine.id,
        machineLabel: machine.label,
        machineType: machine.type,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email || null,
        mode: machine.type === 'dryer' ? `${duration} min` : mode,
        startAt: Timestamp.fromDate(scheduledDate),
        endAt: Timestamp.fromDate(endTime),
        status: 'scheduled',
        note: note.trim() || null,
        createdAt: Timestamp.now()
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
            linkedWasherScheduleId: washerRef.id,
            linkedWasherMachineId: machine.id,
            linkedWasherEndAt: Timestamp.fromDate(endTime),
            note: note.trim() || null,
            createdAt: Timestamp.now()
          });
        }
      }

      showToast('Successfully scheduled!', 'success');
      
      if ('vibrate' in navigator) {
        navigator.vibrate(300);
      }
      
      onClose();
    } catch (error) {
      console.error('Error scheduling:', error);
      showToast('Failed to schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 7; hour < 23; hour++) {
      for (let minute of [0, 30]) {
        const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        options.push({ value: time24, label: displayTime });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();
  const dateOptions = generateDateOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Schedule for Later</h3>
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
                {(() => {
                  const start = buildScheduledDate();
                  const end = new Date(start.getTime() + durationMinutes * 60000);
                  return formatTimeRange(start, end);
                })()}
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
              Date
            </label>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {dateOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {timeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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
            <p className="text-xs text-gray-500 mt-1">Contact info if you might not get notifications</p>
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
                      const start = buildScheduledDate();
                      const washDuration = machine?.modes?.find(m => m.name === mode)?.duration || 0;
                      const washEnd = new Date(start.getTime() + washDuration * 60000);
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
              {loading ? 'Scheduling...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleModal;
