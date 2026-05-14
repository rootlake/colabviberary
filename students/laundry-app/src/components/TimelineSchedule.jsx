import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import ScheduleModal from './ScheduleModal';
import { useToast } from './ToastManager';
import { useLanguage } from '../contexts/LanguageContext';

function TimelineSchedule() {
  const [date, setDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const { t } = useLanguage();

  const hours = Array.from({ length: 17 }, (_, i) => i + 7);

  useEffect(() => {
    const unsubscribeMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
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

    return () => unsubscribeMachines();
  }, []);

  useEffect(() => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'schedules'),
      where('startAt', '>=', Timestamp.fromDate(startOfDay)),
      where('startAt', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('startAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(schedulesData);
    });

    return () => unsubscribe();
  }, [date]);

  const handlePrevDay = () => {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - 1);
    setDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + 1);
    setDate(newDate);
  };

  const isToday = date.toDateString() === new Date().toDateString();

  const handleSlotClick = (machine, hour) => {
    const schedule = getScheduleForSlot(machine.id, hour);
    
    if (schedule) {
      if (schedule.isRealtime) {
        showToast('Cannot cancel machine in use', 'warning');
        return;
      }
      
      if (schedule.userId === currentUser?.uid) {
        handleCancelSchedule(schedule);
      }
    } else {
      setSelectedMachine(machine);
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      setSelectedTime({ date, time: timeString });
      setShowScheduleModal(true);
    }
  };

  const handleCancelSchedule = async (schedule) => {
    if (!currentUser || schedule.userId !== currentUser.uid) {
      showToast('Can only cancel your own bookings', 'error');
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

  const getScheduleForSlot = (machineId, hour) => {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    const schedule = schedules.find(s => {
      if (s.machineId !== machineId || s.status === 'cancelled') return false;
      const startTime = s.startAt.toDate();
      const endTime = s.endAt.toDate();
      return startTime < slotEnd && endTime > slotStart;
    });

    if (schedule) {
      const now = new Date();
      // 修复：同时检查 schedule 和 machine 状态
      const machine = machines.find(m => m.id === machineId);
      const isMachineInUse = machine && (machine.status === 'in_use' || machine.status === 'completed_not_picked_up');
      
      const isLive = schedule.isRealtimeUse && 
                     schedule.status === 'active' && 
                     schedule.startAt.toDate() <= now && 
                     schedule.endAt.toDate() > now &&
                     isMachineInUse; // 新增：必须机器也在使用中
      
      return { ...schedule, isRealtime: isLive };
    }

    return null;
  };

  const isFirstSlot = (schedule, hour) => {
    if (!schedule) return false;
    const startHour = schedule.startAt.toDate().getHours();
    return hour === startHour;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handlePrevDay} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">
              {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'short' })}
            </h3>
            {isToday && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                Today
              </span>
            )}
          </div>
          <button onClick={handleNextDay} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-left sticky left-0 bg-gray-50 z-10 w-16"></th>
                {machines.map(machine => (
                  <th key={machine.id} className="border p-2 text-center w-32">
                    <div className="flex flex-col items-center">
                      <span className="text-xl mb-1">{machine.type === 'washer' ? '🧺' : '💨'}</span>
                      <span className="font-bold text-gray-900 text-xs">{machine.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map(hour => (
                <tr key={hour}>
                  <td className="border p-2 text-xs font-medium text-gray-700 sticky left-0 bg-white z-10">
                    {formatHour(hour)}
                  </td>
                  {machines.map(machine => {
                    const schedule = getScheduleForSlot(machine.id, hour);
                    const isAvailable = !schedule;
                    const isMySchedule = schedule && schedule.userId === currentUser?.uid;
                    const isRealtimeUse = schedule?.isRealtime;
                    const isFirst = isFirstSlot(schedule, hour);

                    return (
                      <td key={machine.id} className="border p-1">
                        {isAvailable ? (
                          <div 
                            onClick={() => handleSlotClick(machine, hour)}
                            className="h-16 border-2 border-dashed border-green-400 rounded-lg hover:bg-green-50 cursor-pointer transition-colors"
                          ></div>
                        ) : schedule ? (
                          <div
                            onClick={() => handleSlotClick(machine, hour)}
                            className={`h-16 rounded-lg p-1 text-[10px] ${
                              isRealtimeUse
                                ? 'bg-purple-100 border-2 border-purple-400'
                                : isMySchedule
                                ? 'bg-blue-100 border-2 border-blue-400 cursor-pointer hover:bg-blue-200'
                                : 'bg-gray-100 border-2 border-gray-300'
                            } relative overflow-hidden transition-colors ${!isFirst ? 'opacity-60' : ''}`}
                          >
                            {isFirst && (
                              <>
                                {isRealtimeUse && (
                                  <span className="absolute top-0.5 right-0.5 text-[8px] px-1 py-0.5 bg-purple-500 text-white rounded font-bold animate-pulse">
                                    🔴
                                  </span>
                                )}
                                {isMySchedule && !isRealtimeUse && (
                                  <span className="absolute top-0.5 right-0.5 text-[8px] px-1 py-0.5 bg-green-500 text-white rounded font-bold">
                                    M
                                  </span>
                                )}
                                <div className="font-medium text-gray-900 truncate text-[9px]">{schedule.userName}</div>
                                <div className="text-gray-600 truncate text-[8px]">{schedule.mode}</div>
                                <div className="text-blue-600 font-bold text-[9px] mt-0.5">
                                  {formatTime(schedule.startAt).replace(' ', '')}
                                </div>
                              </>
                            )}
                            {!isFirst && (
                              <div className="flex items-center justify-center h-full text-gray-500 text-[9px]">
                                ↑
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <h4 className="font-bold text-gray-900 mb-3 text-sm">Legend</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 border-2 border-dashed border-green-400 rounded"></div>
            <span className="text-gray-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-purple-100 border-2 border-purple-400 rounded relative">
              <span className="absolute -top-1 -right-1 text-[6px] px-0.5 bg-purple-500 text-white rounded">🔴</span>
            </div>
            <span className="text-gray-700">In Use (LIVE)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-blue-100 border-2 border-blue-400 rounded relative">
              <span className="absolute -top-1 -right-1 text-[6px] px-0.5 bg-green-500 text-white rounded">M</span>
            </div>
            <span className="text-gray-700">My Booking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
            <span className="text-gray-700">Others</span>
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <ScheduleModal
          machine={selectedMachine}
          initialDateTime={selectedTime}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedMachine(null);
            setSelectedTime(null);
          }}
        />
      )}
    </div>
  );
}

export default TimelineSchedule;
