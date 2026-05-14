import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, addDoc, Timestamp, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { useToast } from '../components/ToastManager';
import { useNavigate } from 'react-router-dom';

// Demo mode: every signed-in user is treated as an admin.
const ADMIN_EMAILS = null;

const DORMS = {
  rashleigh: { id: 'rashleigh', name: 'Rashleigh', color: '#2563eb' },
  grove: { id: 'grove', name: 'Grove', color: '#059669' },
  colebrook: { id: 'colebrook', name: 'Colebrook', color: '#dc2626' }
};

function Admin() {
  const [selectedDorm, setSelectedDorm] = useState('all');
  const [machines, setMachines] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState(false);
  const currentUser = auth.currentUser;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isAdmin = Boolean(currentUser);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    // Machines
    const machinesQuery = selectedDorm === 'all'
      ? collection(db, 'machines')
      : query(collection(db, 'machines'), where('dormId', '==', selectedDorm));
    const unsubMachines = onSnapshot(machinesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        if (a.type === 'washer' && b.type === 'dryer') return -1;
        if (a.type === 'dryer' && b.type === 'washer') return 1;
        return 0;
      });
      setMachines(data);
    });

    // Schedules
    const schedulesQuery = selectedDorm === 'all'
      ? collection(db, 'schedules')
      : query(collection(db, 'schedules'), where('dormId', '==', selectedDorm));
    const unsubSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.startAt?.toDate() || new Date(0);
          const bTime = b.startAt?.toDate() || new Date(0);
          return bTime - aTime;
        });
      setAllSchedules(data);
    });

    // Announcements
    const announcementsQuery = selectedDorm === 'all'
      ? collection(db, 'announcements')
      : query(collection(db, 'announcements'), where('dormId', '==', selectedDorm));
    const unsubAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAnnouncements(data);
    });

    // Feedbacks
    const feedbacksQuery = selectedDorm === 'all'
      ? query(collection(db, 'feedback'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'feedback'), where('dormId', '==', selectedDorm));
    const unsubFeedbacks = onSnapshot(feedbacksQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setFeedbacks(data);
    });

    setLoading(false);

    return () => {
      unsubMachines();
      unsubSchedules();
      unsubAnnouncements();
      unsubFeedbacks();
    };
  }, [isAdmin, selectedDorm]);

  const filteredSchedules = allSchedules.filter(schedule => {
    if (filter === 'all') return true;
    const now = new Date();
    const startTime = schedule.startAt?.toDate();
    if (filter === 'future') return startTime > now && schedule.status !== 'cancelled';
    if (filter === 'past') return startTime <= now || schedule.status === 'cancelled';
    return true;
  });

  const getMachineResetFields = (status = 'idle') => ({
    status,
    currentUserId: null,
    currentUserName: null,
    currentUserEmail: null,
    currentScheduleId: null,
    startAt: null,
    durationMinutes: null,
    estimatedEndAt: null,
    actualEndAt: null,
    mode: null,
    pendingPickup: false,
    pendingPickupUserId: null,
    pendingPickupUserName: null,
    pendingPickupUserEmail: null,
    pendingPickupAt: null,
    updatedAt: Timestamp.now()
  });

  const clearMachine = async (machineId) => {
    if (!confirm('Clear this machine to idle?')) return;
    try {
      const machine = machines.find(m => m.id === machineId);
      if (machine?.currentScheduleId) {
        await deleteDoc(doc(db, 'schedules', machine.currentScheduleId)).catch(() => {});
      }
      await updateDoc(doc(db, 'machines', machineId), getMachineResetFields('idle'));
      showToast('Machine cleared', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed: ' + error.message, 'error');
    }
  };

  const clearAllMachines = async () => {
    const dormLabel = selectedDorm === 'all' ? 'ALL dorms' : DORMS[selectedDorm].name;
    if (!confirm(`Clear ALL machines in ${dormLabel}?`)) return;
    try {
      for (const machine of machines) {
        if (machine.currentScheduleId) {
          await deleteDoc(doc(db, 'schedules', machine.currentScheduleId)).catch(() => {});
        }
        await updateDoc(doc(db, 'machines', machine.id), getMachineResetFields('idle'));
      }
      showToast('All cleared', 'success');
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const setMachineStatus = async (machineId, status) => {
    try {
      const machine = machines.find(m => m.id === machineId);
      if (machine?.currentScheduleId) {
        await deleteDoc(doc(db, 'schedules', machine.currentScheduleId)).catch(() => {});
      }
      await updateDoc(doc(db, 'machines', machineId), getMachineResetFields(status));
      showToast(`Set to ${status}`, 'success');
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (deleting) return;
    if (!confirm('Delete this booking?')) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      showToast('Deleted', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Delete failed: ' + error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllPastSchedules = async () => {
    const dormLabel = selectedDorm === 'all' ? 'ALL dorms' : DORMS[selectedDorm].name;
    if (!confirm(`Delete ALL past/cancelled bookings in ${dormLabel}?`)) return;
    
    setDeleting(true);
    try {
      const now = new Date();
      const batch = writeBatch(db);
      let count = 0;
      
      allSchedules.forEach(schedule => {
        const startTime = schedule.startAt?.toDate();
        if (startTime <= now || schedule.status === 'cancelled') {
          batch.delete(doc(db, 'schedules', schedule.id));
          count++;
        }
      });
      
      await batch.commit();
      showToast(`Deleted ${count} past bookings`, 'success');
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAnnouncement = async (id, isActive) => {
    try {
      await updateDoc(doc(db, 'announcements', id), {
        isActive: !isActive,
        updatedAt: Timestamp.now()
      });
      showToast(isActive ? 'Hidden' : 'Shown', 'success');
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  const updateFeedbackStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      await updateDoc(doc(db, 'feedback', id), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      showToast(`Marked as ${newStatus}`, 'success');
    } catch (error) {
      console.error('Feedback update error:', error);
      showToast('Error: ' + error.message, 'error');
    }
  };

  const deleteFeedback = async (id) => {
    if (!confirm('Delete feedback?')) return;
    try {
      await deleteDoc(doc(db, 'feedback', id));
      showToast('Deleted', 'success');
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">🚫 Access Denied</h1>
          <p className="text-sm text-gray-500 mb-4">Email: {currentUser?.email}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Go Home</button>
        </div>
      </div>
    );
  }

  const pastCount = allSchedules.filter(s => {
    const startTime = s.startAt?.toDate();
    return startTime <= new Date() || s.status === 'cancelled';
  }).length;

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔧 Super Admin Panel</h1>
            <p className="text-sm text-gray-600">Multi-Dormitory Management</p>
          </div>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
            ← Home
          </button>
        </div>

        {/* Dorm Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-3">Select Dormitory</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setSelectedDorm('all')}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                selectedDorm === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Dorms
            </button>
            {Object.values(DORMS).map(dorm => (
              <button
                key={dorm.id}
                onClick={() => setSelectedDorm(dorm.id)}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  selectedDorm === dorm.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {dorm.name}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{machines.length}</div>
            <div className="text-sm text-gray-600">Machines</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{allSchedules.length}</div>
            <div className="text-sm text-gray-600">Total Bookings</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-orange-600">{feedbacks.length}</div>
            <div className="text-sm text-gray-600">Feedbacks</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-purple-600">{announcements.length}</div>
            <div className="text-sm text-gray-600">Announcements</div>
          </div>
        </div>

        {/* Machines */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Machines ({machines.length})</h2>
            <button onClick={clearAllMachines} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
              Clear All
            </button>
          </div>
          <div className="space-y-2">
            {machines.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No machines found</p>
            ) : (
              machines.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.type === 'washer' ? '🧺' : '💨'}</span>
                    <div>
                      <div className="font-medium text-sm">
                        {m.label}
                        {selectedDorm === 'all' && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({DORMS[m.dormId]?.name || m.dormId})
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        m.status === 'idle' ? 'bg-green-100 text-green-800' :
                        m.status === 'in_use' ? 'bg-blue-100 text-blue-800' :
                        m.status === 'completed_not_picked_up' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>{m.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setMachineStatus(m.id, 'idle')} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200">Idle</button>
                    <button onClick={() => setMachineStatus(m.id, 'maintenance')} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs hover:bg-orange-200">Maint</button>
                    <button onClick={() => clearMachine(m.id)} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200">Clear</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schedules */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Bookings ({filteredSchedules.length})</h2>
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-2 py-1 border rounded text-sm">
                <option value="all">All ({allSchedules.length})</option>
                <option value="future">Future</option>
                <option value="past">Past ({pastCount})</option>
              </select>
              {pastCount > 0 && (
                <button onClick={deleteAllPastSchedules} disabled={deleting} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
                  Delete Past ({pastCount})
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSchedules.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No bookings</p>
            ) : (
              filteredSchedules.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{s.machineLabel} - {s.userName}</div>
                    <div className="text-xs text-gray-600">
                      {selectedDorm === 'all' && (
                        <span className="mr-2 text-gray-500">
                          {DORMS[s.dormId]?.name || s.dormId}
                        </span>
                      )}
                      {s.startAt?.toDate().toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true})} - {s.mode} - {s.status}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteSchedule(s.id)} 
                    disabled={deleting}
                    className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200 disabled:opacity-50"
                  >
                    {deleting ? '...' : 'Del'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Feedbacks */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-bold mb-3">Feedbacks ({feedbacks.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {feedbacks.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No feedback</p>
            ) : (
              feedbacks.map(f => (
                <div key={f.id} className="p-2 bg-gray-50 rounded">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{f.type === 'bug' ? '🐛' : f.type === 'machine' ? '🔧' : '💡'}</span>
                        <span className="font-medium text-sm">{f.title}</span>
                        {selectedDorm === 'all' && (
                          <span className="text-xs text-gray-500">
                            {DORMS[f.dormId]?.name || f.dormId}
                          </span>
                        )}
                        {f.status === 'resolved' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">✓ Resolved</span>}
                      </div>
                      <p className="text-xs text-gray-700">{f.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{f.userName} • {f.createdAt?.toDate().toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => updateFeedbackStatus(f.id, f.status)}
                        className={`px-2 py-1 rounded text-xs ${
                          f.status === 'resolved' ? 'bg-gray-200 text-gray-800' : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {f.status === 'resolved' ? '↺' : '✓'}
                      </button>
                      <button onClick={() => deleteFeedback(f.id)} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200">×</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Announcements ({announcements.length})</h2>
            <button onClick={() => setShowNewAnnouncement(true)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">New</button>
          </div>
          <div className="space-y-2">
            {announcements.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No announcements</p>
            ) : (
              announcements.map(a => (
                <div key={a.id} className="flex items-start justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {a.title}
                      {selectedDorm === 'all' && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({DORMS[a.dormId]?.name || a.dormId})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">{a.message}</div>
                  </div>
                  <button 
                    onClick={() => toggleAnnouncement(a.id, a.isActive)}
                    className={`px-2 py-1 rounded text-xs ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}
                  >
                    {a.isActive ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {showNewAnnouncement && <NewAnnouncementModal dormId={selectedDorm} onClose={() => setShowNewAnnouncement(false)} />}
      </div>
    </div>
  );
}

function NewAnnouncementModal({ dormId, onClose }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDorm, setSelectedDorm] = useState(dormId === 'all' ? 'rashleigh' : dormId);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        dormId: selectedDorm,
        title: title.trim(),
        message: message.trim(),
        isActive: true,
        createdAt: Timestamp.now()
      });
      showToast('Created', 'success');
      onClose();
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">
          New Announcement - {dormId === 'all' ? 'Select Dorm' : DORMS[dormId].name}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {dormId === 'all' && (
            <div>
              <label className="block text-sm font-medium mb-1">Dorm</label>
              <select
                value={selectedDorm}
                onChange={(e) => setSelectedDorm(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                {Object.values(DORMS).map(dorm => (
                  <option key={`ann-${dorm.id}`} value={dorm.id}>
                    {dorm.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows="3" className="w-full px-3 py-2 border rounded resize-none" required></textarea>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Admin;
