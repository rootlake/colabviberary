import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import StartUseModal from '../components/StartUseModal';
import ScheduleModal from '../components/ScheduleModal';
import { useToast } from '../components/ToastManager';
import { useDorm, DORMS } from '../contexts/DormContext';
import { useAutoEndSchedules } from '../hooks/useAutoEndSchedules';
import { queueLaundryCompleteEmail } from '../utils/emailNotifications';

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifyWatchers, setNotifyWatchers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('laundry_notify_watchers') || '{}'); }
    catch { return {}; }
  });
  const notifyWatchersRef = useRef(notifyWatchers);
  const prevStatusRef = useRef({});
  const currentUser = auth.currentUser;
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { currentDorm } = useDorm();
  const dormParam = searchParams.get('dorm');
  const dormId = DORMS[dormParam]?.id || currentDorm.id;

  const OPENING_HOUR = 7;
  const CLOSING_HOUR = 22;

  useAutoEndSchedules();

  const getPendingResetFields = () => ({
    pendingPickup: false,
    pendingPickupUserId: null,
    pendingPickupUserName: null,
    pendingPickupUserEmail: null,
    pendingPickupAt: null,
    actualEndAt: null,
    updatedAt: Timestamp.now()
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Load machines
  useEffect(() => {
    const q = query(
      collection(db, 'machines'),
      where('dormId', '==', dormId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      data.sort((a, b) => {
        if (a.type === 'washer' && b.type === 'dryer') return -1;
        if (a.type === 'dryer' && b.type === 'washer') return 1;
        return 0;
      });
      
      setMachines(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentDorm.id, dormId]);

  useEffect(() => {
    const staleMachines = machines.filter(machine => {
      if (machine.status === 'completed_not_picked_up') return false;
      return Boolean(
        machine.pendingPickup ||
        machine.pendingPickupAt ||
        machine.pendingPickupUserId ||
        machine.pendingPickupUserName ||
        machine.pendingPickupUserEmail ||
        machine.actualEndAt
      );
    });

    if (staleMachines.length === 0) return;

    staleMachines.forEach((machine) => {
      updateDoc(doc(db, 'machines', machine.id), getPendingResetFields()).catch(() => {});
    });
  }, [machines]);

  // Load user's schedules
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'schedules'),
      where('userId', '==', currentUser.uid),
      where('dormId', '==', dormId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(data);
    });

    return () => unsubscribe();
  }, [currentUser, currentDorm.id, dormId]);

  // Load announcements
  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      where('dormId', '==', dormId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(a => a.isActive);
      setAnnouncements(data);
    });

    return () => unsubscribe();
  }, [currentDorm.id, dormId]);

  const getNextSchedule = () => {
    const now = new Date();
    return schedules
      .filter(s => {
        const startTime = s.startAt.toDate();
        return startTime > now && s.status === 'scheduled';
      })
      .sort((a, b) => a.startAt.toDate() - b.startAt.toDate())[0];
  };

  const handleCancelSchedule = async (scheduleId) => {
    try {
      await updateDoc(doc(db, 'schedules', scheduleId), {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
      showToast('Cancelled', 'success');
    } catch (error) {
      showToast('Failed', 'error');
    }
  };

  const getRemainingMinutes = (estimatedEndAt) => {
    if (!estimatedEndAt) return 0;
    const endTime = estimatedEndAt.toDate ? estimatedEndAt.toDate() : new Date(estimatedEndAt);
    const diff = endTime - currentTime;
    return Math.max(0, Math.ceil(diff / 1000 / 60));
  };

  const getMinutesSince = (timestamp) => {
    if (!timestamp) return 0;
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = currentTime - time;
    return Math.max(0, Math.floor(diff / 1000 / 60));
  };

  const getPendingPickupMinutes = (machine) => {
    const hasPendingPickup = machine?.status === 'completed_not_picked_up';
    if (!hasPendingPickup) return 0;
    if (machine?.pendingPickupAt) return getMinutesSince(machine.pendingPickupAt);
    if (machine?.actualEndAt) return getMinutesSince(machine.actualEndAt);
    return 0;
  };

  const handleFinishEarly = async (machine) => {
    if (!currentUser || machine.currentUserId !== currentUser.uid) return;

    try {
      const now = Timestamp.now();

      if (machine.currentScheduleId) {
        await updateDoc(doc(db, 'schedules', machine.currentScheduleId), {
          status: 'completed',
          endAt: now,
          updatedAt: now
        }).catch(() => {});
      }

      await updateDoc(doc(db, 'machines', machine.id), {
        status: 'completed_not_picked_up',
        actualEndAt: now,
        pendingPickup: true,
        pendingPickupUserId: machine.currentUserId,
        pendingPickupUserName: machine.currentUserName,
        pendingPickupUserEmail: machine.currentUserEmail || currentUser.email || null,
        pendingPickupAt: now,
        updatedAt: now
      });

      if (machine.type === 'washer') {
        let autoSchedule = schedules
          .filter(s => s.machineType === 'dryer' && s.status === 'scheduled')
          .filter(s => s.isAutoDryer && s.linkedWasherMachineId === machine.id)
          .sort((a, b) => a.startAt.toDate() - b.startAt.toDate())[0] || null;

        if (!autoSchedule) {
          const targetEnd = machine.estimatedEndAt?.toDate ? machine.estimatedEndAt.toDate() : null;
          const minStart = targetEnd ? targetEnd.getTime() - 5 * 60000 : Date.now();
          const maxStart = targetEnd ? targetEnd.getTime() + 120 * 60000 : Date.now() + 2 * 60 * 60 * 1000;

          autoSchedule = schedules
            .filter(s => s.machineType === 'dryer' && s.status === 'scheduled')
            .filter(s => {
              const startMs = s.startAt?.toDate ? s.startAt.toDate().getTime() : 0;
              return startMs >= minStart && startMs <= maxStart;
            })
            .sort((a, b) => a.startAt.toDate() - b.startAt.toDate())[0] || null;
        }

        if (autoSchedule) {
          const moveNow = confirm('Move your dryer booking to now?');
          if (moveNow) {
            const durationMs = autoSchedule.endAt.toDate() - autoSchedule.startAt.toDate();
            const newStart = new Date();
            const newEnd = new Date(newStart.getTime() + durationMs);

            const conflictQuery = query(
              collection(db, 'schedules'),
              where('machineId', '==', autoSchedule.machineId),
              where('status', 'in', ['scheduled', 'active'])
            );
            const conflictSnap = await getDocs(conflictQuery);
            const hasConflict = conflictSnap.docs.some(docSnap => {
              if (docSnap.id === autoSchedule.id) return false;
              const existing = docSnap.data();
              const existingStart = existing.startAt.toDate();
              const existingEnd = existing.endAt.toDate();
              return newStart < existingEnd && newEnd > existingStart;
            });

            if (hasConflict) {
              showToast('Dryer not available now. Keeping original booking.', 'error');
            } else {
              const dryerMachineRef = doc(db, 'machines', autoSchedule.machineId);
              const dryerMachineSnap = await getDoc(dryerMachineRef);
              if (!dryerMachineSnap.exists()) {
                showToast('Dryer not found', 'error');
                return;
              }
              const dryerMachine = dryerMachineSnap.data();
              if (dryerMachine.status !== 'idle' && dryerMachine.currentScheduleId !== autoSchedule.id) {
                showToast('Dryer not available now. Keeping original booking.', 'error');
                return;
              }

              await updateDoc(doc(db, 'schedules', autoSchedule.id), {
                startAt: Timestamp.fromDate(newStart),
                endAt: Timestamp.fromDate(newEnd),
                status: 'active',
                isRealtimeUse: true,
                updatedAt: Timestamp.now()
              });

              await updateDoc(dryerMachineRef, {
                status: 'in_use',
                currentUserId: currentUser.uid,
                currentUserName: currentUser.displayName || currentUser.email,
                currentUserEmail: currentUser.email || null,
                currentScheduleId: autoSchedule.id,
                startAt: Timestamp.fromDate(newStart),
                durationMinutes: Math.ceil(durationMs / 60000),
                estimatedEndAt: Timestamp.fromDate(newEnd),
                actualEndAt: null,
                mode: autoSchedule.mode,
                updatedAt: Timestamp.now()
              });

              showToast('Dryer booking moved to now', 'success');
            }
          }
        }
      }

      await queueLaundryCompleteEmail({
        scheduleId: machine.currentScheduleId || null,
        machineId: machine.id,
        machineLabel: machine.label,
        dormId: machine.dormId || dormId,
        userEmail: machine.currentUserEmail || currentUser.email || null,
        userName: machine.currentUserName || currentUser.displayName || currentUser.email,
        endAt: now
      });

      showToast('Marked as completed', 'success');
    } catch (error) {
      showToast('Failed', 'error');
    }
  };

  const handlePickedUp = async (machine) => {
    const isPendingOwner = machine.pendingPickupUserId
      ? machine.pendingPickupUserId === currentUser?.uid
      : machine.currentUserId === currentUser?.uid;
    if (!isPendingOwner) return;

    try {
      const updates = getPendingResetFields();

      if (machine.status === 'completed_not_picked_up') {
        if (machine.currentScheduleId) {
          await deleteDoc(doc(db, 'schedules', machine.currentScheduleId)).catch(() => {});
        }

        Object.assign(updates, {
          status: 'idle',
          currentUserId: null,
          currentUserName: null,
          currentUserEmail: null,
          currentScheduleId: null,
          startAt: null,
          durationMinutes: null,
          estimatedEndAt: null,
          actualEndAt: null,
          mode: null
        });
      }

      await updateDoc(doc(db, 'machines', machine.id), updates);

      showToast('Thanks!', 'success');
    } catch (error) {
      showToast('Failed', 'error');
    }
  };

  const isWithinHours = () => {
    const hour = currentTime.getHours();
    return hour >= OPENING_HOUR && hour < CLOSING_HOUR;
  };

  // Keep ref in sync so the status-change effect always sees fresh watcher state
  useEffect(() => { notifyWatchersRef.current = notifyWatchers; }, [notifyWatchers]);

  const saveWatchers = (updated) => {
    setNotifyWatchers(updated);
    localStorage.setItem('laundry_notify_watchers', JSON.stringify(updated));
  };

  const handleNotify = async (key, title, body) => {
    if (!('Notification' in window)) {
      showToast('Notifications not supported in this browser', 'error');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast('Enable notifications in browser settings', 'error');
      return;
    }
    const updated = { ...notifyWatchersRef.current, [key]: { title, body } };
    saveWatchers(updated);
    showToast('You\'ll be notified 🔔', 'success');
  };

  const cancelNotify = (key) => {
    const updated = { ...notifyWatchersRef.current };
    delete updated[key];
    saveWatchers(updated);
  };

  // Fire browser notifications when machine status changes
  useEffect(() => {
    if (machines.length === 0) return;
    const prev = prevStatusRef.current;
    const watchers = notifyWatchersRef.current;

    machines.forEach(machine => {
      const prevStatus = prev[machine.id];
      const currStatus = machine.status;

      if (prevStatus && prevStatus !== currStatus) {
        // Machine just became free → notify anyone watching it
        if (currStatus === 'idle') {
          const key = `free_${machine.id}`;
          if (watchers[key]) {
            new Notification(watchers[key].title, { body: watchers[key].body, icon: '/favicon.ico' });
            cancelNotify(key);
          }
        }
        // Machine just completed → notify the owner
        if (currStatus === 'completed_not_picked_up') {
          const key = `done_${machine.id}`;
          if (watchers[key]) {
            new Notification(watchers[key].title, { body: watchers[key].body, icon: '/favicon.ico' });
            cancelNotify(key);
          }
        }
      }

      prev[machine.id] = currStatus;
    });
  }, [machines]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const nextSchedule = getNextSchedule();
  const withinHours = isWithinHours();

  return (
    <div className="pb-24">
      {announcements.length > 0 && (
        <div className="mb-6 space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
              <h3 className="font-bold text-orange-900">{a.title}</h3>
              <p className="text-sm text-orange-800">{a.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Machine Status</h2>
        {!withinHours && (
          <p className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-lg">
            Not in operating hours ({OPENING_HOUR}:00 - {CLOSING_HOUR}:00)
          </p>
        )}
      </div>

      {nextSchedule && (
        <div className="mb-6 bg-blue-600 text-white rounded-lg p-5">
          <h3 className="font-bold mb-2">My Next Booking</h3>
          <p>{nextSchedule.machineLabel} · {nextSchedule.mode}</p>
          <p className="text-sm text-blue-100">
            {nextSchedule.startAt.toDate().toLocaleString()}
          </p>
          <button
            onClick={() => handleCancelSchedule(nextSchedule.id)}
            className="mt-3 px-4 py-2 bg-white bg-opacity-20 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-4">
        {machines.map(machine => {
          const hasPendingPickup = machine.status === 'completed_not_picked_up';
          const remainingMinutes = getRemainingMinutes(machine.estimatedEndAt);
          const pendingMinutes = getPendingPickupMinutes(machine);
          const isOverdue = hasPendingPickup && pendingMinutes >= 20;
          const canStartWithPending = machine.status === 'completed_not_picked_up' && pendingMinutes >= 20;
          const isPendingOwner = machine.pendingPickupUserId
            ? machine.pendingPickupUserId === currentUser?.uid
            : machine.currentUserId === currentUser?.uid;

          return (
          <div
            key={machine.id}
            className={`relative bg-white rounded-lg shadow-md p-6 border-2 border-gray-100 ${isOverdue ? 'pl-8' : ''}`}
          >
            {isOverdue && (
              <div className="absolute left-0 top-0 h-full w-2 bg-red-500 rounded-l-lg" />
            )}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{machine.type === 'washer' ? '🧺' : '💨'}</span>
              <div>
                <h3 className="text-lg font-bold">{machine.label}</h3>
                <span className={`text-sm px-3 py-1 rounded-full ${
                  machine.status === 'idle' ? 'bg-green-100 text-green-800' :
                  machine.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                  machine.status === 'completed_not_picked_up' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {machine.status === 'idle' ? 'Available' :
                   machine.status === 'in_use' ? 'In Use' :
                   machine.status === 'completed_not_picked_up' ? 'Not Picked Up' :
                  'Maintenance'}
                </span>
              </div>
            </div>

            {hasPendingPickup && (
              <div className={`p-4 rounded-lg mb-4 ${isOverdue ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm"><strong>Pending Pickup:</strong> {machine.pendingPickupUserName || machine.currentUserName || 'Unknown'}</p>
                  <span className={`text-sm font-semibold ${isOverdue ? 'text-red-700' : 'text-yellow-700'}`}>
                    {pendingMinutes} min
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  If you need this machine, you may move the laundry to a clean area and start a new cycle.
                </p>
                {isPendingOwner && (
                  <button
                    onClick={() => handlePickedUp(machine)}
                    className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg"
                  >
                    ✅ Confirm Pickup
                  </button>
                )}
                {!isPendingOwner && (
                  notifyWatchers[`free_${machine.id}`]
                    ? <button
                        onClick={() => cancelNotify(`free_${machine.id}`)}
                        className="mt-3 w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                      >🔔 Watching — tap to cancel</button>
                    : <button
                        onClick={() => handleNotify(
                          `free_${machine.id}`,
                          `${machine.label} is now free! 🟢`,
                          'Laundry has been picked up — it\'s your turn.'
                        )}
                        className="mt-3 w-full bg-purple-50 text-purple-700 border border-purple-200 py-2 rounded-lg text-sm font-medium"
                      >🔔 Notify me when free</button>
                )}
              </div>
            )}

            {machine.status === 'in_use' && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm"><strong>User:</strong> {machine.currentUserName}</p>
                  <span className="text-sm font-semibold text-blue-700">
                    {remainingMinutes > 0 ? `${remainingMinutes} min left` : 'Almost done'}
                  </span>
                </div>
                <p className="text-sm mb-3"><strong>Mode:</strong> {machine.mode}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: machine.durationMinutes
                        ? `${Math.min(100, ((machine.durationMinutes - remainingMinutes) / machine.durationMinutes) * 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
                {machine.currentUserId === currentUser?.uid && remainingMinutes > 0 && (
                  <button
                    onClick={() => handleFinishEarly(machine)}
                    className="w-full mt-2 bg-orange-100 text-orange-800 py-2 rounded-lg font-medium hover:bg-orange-200 transition-colors text-sm"
                  >
                    ⏹ Finish Early
                  </button>
                )}
                {machine.currentUserId === currentUser?.uid && (
                  notifyWatchers[`done_${machine.id}`]
                    ? <button
                        onClick={() => cancelNotify(`done_${machine.id}`)}
                        className="w-full mt-2 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                      >🔔 Notifying when done — tap to cancel</button>
                    : <button
                        onClick={() => handleNotify(
                          `done_${machine.id}`,
                          'Your laundry is done! 🧺',
                          `${machine.label} — head over to pick it up.`
                        )}
                        className="w-full mt-2 bg-purple-50 text-purple-700 border border-purple-200 py-2 rounded-lg text-sm font-medium"
                      >🔔 Notify me when done</button>
                )}
                {machine.currentUserId !== currentUser?.uid && (
                  notifyWatchers[`free_${machine.id}`]
                    ? <button
                        onClick={() => cancelNotify(`free_${machine.id}`)}
                        className="w-full mt-2 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                      >🔔 Watching — tap to cancel</button>
                    : <button
                        onClick={() => handleNotify(
                          `free_${machine.id}`,
                          `${machine.label} is now free! 🟢`,
                          'Head over to start your laundry.'
                        )}
                        className="w-full mt-2 bg-purple-50 text-purple-700 border border-purple-200 py-2 rounded-lg text-sm font-medium"
                      >🔔 Notify me when free</button>
                )}
              </div>
            )}

            {(machine.status === 'idle' || canStartWithPending) && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedMachine(machine);
                    setShowStartModal(true);
                  }}
                  disabled={!withinHours}
                  className={`w-full py-3 rounded-lg font-medium ${
                    withinHours
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-500'
                  }`}
                >
                  {withinHours ? 'Start Now' : 'Not Operating'}
                </button>
                <button
                  onClick={() => {
                    setSelectedMachine(machine);
                    setShowScheduleModal(true);
                  }}
                  className="w-full bg-white text-blue-600 border-2 border-blue-600 py-3 rounded-lg font-medium"
                >
                  📅 Schedule for Later
                </button>
              </div>
            )}
          </div>
        );
        })}
      </div>

      {showStartModal && (
        <StartUseModal
          machine={selectedMachine}
          onClose={() => {
            setShowStartModal(false);
            setSelectedMachine(null);
          }}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          machine={selectedMachine}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedMachine(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
