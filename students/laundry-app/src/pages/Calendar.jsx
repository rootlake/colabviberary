import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import ScheduleModal from '../components/ScheduleModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useDorm, DORMS } from '../contexts/DormContext';
import { useToast } from '../components/ToastManager';

function Calendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [machines, setMachines] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const [listFilter, setListFilter] = useState('all'); // 'all' or 'my'
  const currentUser = auth.currentUser;
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { currentDorm } = useDorm();
  const { showToast } = useToast();
  const isAdmin = Boolean(currentUser); // Demo mode: everyone is admin.
  const dormParam = searchParams.get('dorm');
  const dormId = DORMS[dormParam]?.id || currentDorm.id;

  useEffect(() => {
    const q = query(
      collection(db, 'machines'),
      where('dormId', '==', dormId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const machinesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      machinesData.sort((a, b) => {
        if (a.type === 'washer' && b.type === 'dryer') return -1;
        if (a.type === 'dryer' && b.type === 'washer') return 1;
        return 0;
      });
      
      setMachines(machinesData);
    });

    return () => unsubscribe();
  }, [currentDorm.id, dormId]);

  useEffect(() => {
    const q = query(
      collection(db, 'schedules'),
      where('dormId', '==', dormId),
      orderBy('startAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(s => s.status !== 'cancelled');

      setAllSchedules(schedules);
    });

    return () => unsubscribe();
  }, [currentDorm.id, dormId]);

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour < 23; hour++) {
      for (let minute of [0, 30]) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  };

  const getSchedulesForDay = () => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return allSchedules.filter(schedule => {
      const scheduleStart = schedule.startAt.toDate();
      return scheduleStart >= startOfDay && scheduleStart <= endOfDay;
    });
  };

  const getScheduleAtTime = (machine, hour, minute) => {
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    
    const daySchedules = getSchedulesForDay();
    
    return daySchedules.find(schedule => {
      if (schedule.machineId !== machine.id) return false;
      
      const scheduleStart = schedule.startAt.toDate();
      const scheduleEnd = schedule.endAt.toDate();
      
      return slotTime >= scheduleStart && slotTime < scheduleEnd;
    });
  };

  const handleSlotClick = (machine, hour, minute) => {
    if (machine.status === 'maintenance') {
      return;
    }

    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    
    const now = new Date();
    if (slotTime <= now) {
      return;
    }

    const schedule = getScheduleAtTime(machine, hour, minute);
    if (schedule) {
      return;
    }

    setSelectedMachine(machine);
    setSelectedDateTime({
      date: selectedDate,
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    });
    setShowScheduleModal(true);
  };

  const handleCancelSchedule = async (scheduleId) => {
    if (!confirm('Cancel this booking?')) return;

    try {
      await updateDoc(doc(db, 'schedules', scheduleId), {
        status: 'cancelled'
      });
      showToast('Booking cancelled', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to cancel', 'error');
    }
  };

  const formatTimeShort = (hour, minute) => {
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')}`;
  };

  const formatTimeRange = (startAt, endAt) => {
    if (!startAt || !endAt) return '';
    const start = startAt.toDate();
    const end = endAt.toDate();
    const startStr = formatTimeShort(start.getHours(), start.getMinutes());
    const endStr = formatTimeShort(end.getHours(), end.getMinutes());
    return `${startStr}-${endStr}`;
  };

  const isLiveSchedule = (schedule) => {
    if (!schedule || !schedule.isRealtimeUse || schedule.status !== 'active') return false;
    const now = new Date();
    const start = schedule.startAt.toDate();
    const end = schedule.endAt.toDate();
    return start <= now && end > now;
  };

  const canCancelSchedule = (schedule) => {
    if (!schedule) return false;
    if (schedule.status !== 'scheduled') return false;
    if (isAdmin) return true;
    if (schedule.userId !== currentUser?.uid) return false;
    const now = new Date();
    const start = schedule.startAt.toDate();
    return start > now;
  };

  const timeSlots = generateTimeSlots();
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // Get schedules for list view
  const now = new Date();
  const upcomingSchedules = allSchedules
    .filter(s => {
      const startTime = s.startAt.toDate();
      if (listFilter === 'my') {
        return startTime > now && s.userId === currentUser?.uid;
      }
      return startTime > now;
    })
    .sort((a, b) => a.startAt.toDate() - b.startAt.toDate());

  return (
    <div className="pb-24">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('calendar')}</h2>
          
          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Timeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 List
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          {viewMode === 'timeline' ? 'View and schedule laundry bookings' : 'View all upcoming bookings'}
        </p>
      </div>

      {viewMode === 'timeline' ? (
        // Timeline View
        <>
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPreviousDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h3>
                {!isToday && (
                  <button
                    onClick={goToToday}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                  >
                    Go to Today
                  </button>
                )}
              </div>

              <button
                onClick={goToNextDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
                <span className="text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="text-gray-600">Live</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Your Bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-300 rounded"></div>
                <span className="text-gray-600">Booked</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="w-16 px-2 py-2 md:px-4 md:py-3 text-left text-[10px] md:text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Time
                    </th>
                    {machines.map(machine => (
                      <th key={machine.id} className="px-1 py-2 md:px-4 md:py-3 text-center text-[10px] md:text-sm font-semibold text-gray-700">
                        <div className="flex flex-col items-center gap-0.5 leading-tight">
                          <span className="text-base md:text-xl">{machine.type === 'washer' ? '🧺' : '💨'}</span>
                          <span className="truncate">{machine.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {timeSlots.map(({ hour, minute }) => {
                    const slotTime = new Date(selectedDate);
                    slotTime.setHours(hour, minute, 0, 0);
                    const isPast = slotTime <= new Date();
                    const slotStartMs = slotTime.getTime();
                    const slotDurationMs = 30 * 60 * 1000;

                    return (
                      <tr key={`${hour}-${minute}`} className="hover:bg-gray-50">
                        <td className="w-16 px-2 py-1 md:px-4 md:py-2 text-[10px] md:text-sm text-gray-700 font-medium sticky left-0 bg-white z-10 border-r border-gray-200 whitespace-nowrap">
                          {formatTimeShort(hour, minute)}
                        </td>
                        {machines.map(machine => {
                          const schedule = getScheduleAtTime(machine, hour, minute);
                          const isMySchedule = schedule && schedule.userId === currentUser?.uid;
                          const scheduleStartMs = schedule ? schedule.startAt.toDate().getTime() : 0;
                          const isFirstSlot = schedule &&
                            slotStartMs >= scheduleStartMs &&
                            (slotStartMs - slotDurationMs) < scheduleStartMs;
                          const isLive = isLiveSchedule(schedule);
                          const canCancel = schedule && isFirstSlot && canCancelSchedule(schedule);

                          return (
                            <td
                              key={`${machine.id}-${hour}-${minute}`}
                              className={`px-1 py-1 md:px-2 md:py-2 text-center text-[9px] md:text-xs transition-colors ${
                                isPast ? 'bg-gray-100 cursor-not-allowed' :
                                schedule ? (isLive ? 'bg-purple-500 text-white' : isMySchedule ? 'bg-blue-500 text-white' : 'bg-gray-300') :
                                machine.status === 'maintenance' ? 'bg-orange-100 cursor-not-allowed' :
                                'bg-green-100 hover:bg-green-200 border-2 border-green-300'
                              } ${(!isPast && !schedule) || canCancel ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              onClick={() => {
                                if (!isPast && !schedule) {
                                  handleSlotClick(machine, hour, minute);
                                  return;
                                }
                                if (canCancel) {
                                  handleCancelSchedule(schedule.id);
                                }
                              }}
                            >
                              {schedule && isFirstSlot && (
                                <div className="font-medium leading-tight flex flex-col items-center gap-0.5">
                                  <div className="flex items-center justify-center gap-1">
                                    {isLive && <span className="inline-block w-2 h-2 bg-green-300 rounded-full animate-pulse" />}
                                    <span>{isLive ? 'LIVE' : formatTimeRange(schedule.startAt, schedule.endAt)}</span>
                                  </div>
                                  <div>{schedule.userName.split(' ')[0]} · {schedule.mode}</div>
                                </div>
                              )}
                              {machine.status === 'maintenance' && !schedule && (
                                <span className="text-orange-700">🔧</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        // List View
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Upcoming Bookings</h3>
            
            {/* Filter Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setListFilter('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  listFilter === 'all'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Bookings
              </button>
              <button
                onClick={() => setListFilter('my')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  listFilter === 'my'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                My Bookings
              </button>
            </div>
          </div>
          
          {upcomingSchedules.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-gray-600 mb-2">
                {listFilter === 'my' ? 'No bookings yet' : 'No upcoming bookings'}
              </p>
              <p className="text-sm text-gray-500">
                {listFilter === 'my' ? 'Switch to Timeline view to make a booking' : 'No one has booked yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedules.map(schedule => {
                const isMyBooking = schedule.userId === currentUser?.uid;
                return (
                  <div 
                    key={schedule.id} 
                    className={`border-2 rounded-lg p-4 transition-colors ${
                      isMyBooking 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-3xl">{schedule.machineType === 'washer' ? '🧺' : '💨'}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{schedule.machineLabel}</h4>
                            {isMyBooking && (
                              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Your Booking
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{schedule.userName}</p>
                          <p className="text-sm text-gray-600">{schedule.mode}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-700">
                            <span>
                              📅 {schedule.startAt.toDate().toLocaleDateString('en-US', { 
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                            <span>
                              ⏰ {formatTimeRange(schedule.startAt, schedule.endAt)}
                            </span>
                          </div>
                          {schedule.note && (
                            <p className="text-xs text-gray-500 mt-1">📝 {schedule.note}</p>
                          )}
                        </div>
                      </div>
                      {isMyBooking && (
                        <button
                          onClick={() => handleCancelSchedule(schedule.id)}
                          className="ml-3 px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showScheduleModal && selectedMachine && (
        <ScheduleModal
          machine={selectedMachine}
          initialDateTime={selectedDateTime}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedMachine(null);
            setSelectedDateTime(null);
          }}
        />
      )}
    </div>
  );
}

export default Calendar;
