// Sample data seeded into the in-memory store on first load.
// All timestamps are duck-typed Timestamp objects (matching the mock's Timestamp).

import { DEMO_USER_ID } from './auth';

class T {
  constructor(ms) { this.__ms = ms; }
  toDate() { return new Date(this.__ms); }
  toMillis() { return this.__ms; }
  get seconds() { return Math.floor(this.__ms / 1000); }
  get nanoseconds() { return (this.__ms % 1000) * 1e6; }
}
const tsFromDate = (d) => new T(d.getTime());
const tsFromOffset = (mins) => new T(Date.now() + mins * 60000);

// Helper to align to the next quarter-hour for tidy demo schedules.
function nextQuarterHour(offsetMin = 0) {
  const d = new Date(Date.now() + offsetMin * 60000);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const rounded = Math.ceil(m / 15) * 15;
  d.setMinutes(rounded);
  return d;
}

const DORMS = ['rashleigh', 'grove', 'colebrook'];

function buildMachines() {
  const out = [];
  for (const dormId of DORMS) {
    // 3 washers + 3 dryers per dorm
    for (let i = 1; i <= 3; i++) {
      out.push({
        id: `${dormId}_washer_${i}`,
        dormId,
        type: 'washer',
        label: `Washer ${i}`,
        status: 'idle',
        currentUserId: null,
        currentUserName: null,
        currentUserEmail: null,
        currentScheduleId: null,
        startAt: null,
        durationMinutes: null,
        estimatedEndAt: null,
        mode: null,
        updatedAt: tsFromOffset(-60)
      });
    }
    for (let i = 1; i <= 3; i++) {
      out.push({
        id: `${dormId}_dryer_${i}`,
        dormId,
        type: 'dryer',
        label: `Dryer ${i}`,
        status: 'idle',
        currentUserId: null,
        currentUserName: null,
        currentUserEmail: null,
        currentScheduleId: null,
        startAt: null,
        durationMinutes: null,
        estimatedEndAt: null,
        mode: null,
        updatedAt: tsFromOffset(-60)
      });
    }
  }
  return out;
}

function buildMachineActivity(machines) {
  // Mutate a couple of machines per dorm to show a mix of states.
  const schedules = [];
  for (const dormId of DORMS) {
    // Washer 1 — in use by another student, ending in ~15 min.
    const w1 = machines.find(m => m.id === `${dormId}_washer_1`);
    const w1Start = new Date(Date.now() - 30 * 60000);
    const w1End = new Date(w1Start.getTime() + 45 * 60000);
    const w1ScheduleId = `seed_sched_${dormId}_w1_active`;
    Object.assign(w1, {
      status: 'in_use',
      currentUserId: `peer_${dormId}_001`,
      currentUserName: 'Alex P.',
      currentUserEmail: 'alex@example.edu',
      currentScheduleId: w1ScheduleId,
      startAt: tsFromDate(w1Start),
      durationMinutes: 45,
      estimatedEndAt: tsFromDate(w1End),
      mode: 'Normal',
      updatedAt: tsFromDate(w1Start)
    });
    schedules.push({
      id: w1ScheduleId,
      userId: `peer_${dormId}_001`,
      userName: 'Alex P.',
      userEmail: 'alex@example.edu',
      dormId,
      machineId: w1.id,
      machineLabel: w1.label,
      machineType: 'washer',
      mode: 'Normal',
      status: 'active',
      isRealtimeUse: true,
      startAt: tsFromDate(w1Start),
      endAt: tsFromDate(w1End),
      createdAt: tsFromDate(w1Start),
      updatedAt: tsFromDate(w1Start)
    });

    // Dryer 1 — completed_not_picked_up by another student.
    const d1 = machines.find(m => m.id === `${dormId}_dryer_1`);
    const d1End = new Date(Date.now() - 10 * 60000);
    Object.assign(d1, {
      status: 'completed_not_picked_up',
      currentUserId: `peer_${dormId}_002`,
      currentUserName: 'Jordan K.',
      currentUserEmail: 'jordan@example.edu',
      currentScheduleId: null,
      pendingPickup: true,
      pendingPickupUserId: `peer_${dormId}_002`,
      pendingPickupUserName: 'Jordan K.',
      pendingPickupUserEmail: 'jordan@example.edu',
      pendingPickupAt: tsFromDate(d1End),
      actualEndAt: tsFromDate(d1End),
      startAt: tsFromDate(new Date(d1End.getTime() - 50 * 60000)),
      durationMinutes: 50,
      estimatedEndAt: tsFromDate(d1End),
      mode: 'Normal',
      updatedAt: tsFromDate(d1End)
    });
  }
  return schedules;
}

function buildUserSchedules() {
  // Demo user has a couple of upcoming bookings (Rashleigh only — that's the default dorm).
  const out = [];
  const dormId = 'rashleigh';

  const start1 = nextQuarterHour(60);
  const end1 = new Date(start1.getTime() + 45 * 60000);
  out.push({
    id: 'seed_demo_w2_upcoming',
    userId: DEMO_USER_ID,
    userName: 'Demo Student',
    userEmail: 'demo@example.edu',
    dormId,
    machineId: `${dormId}_washer_2`,
    machineLabel: 'Washer 2',
    machineType: 'washer',
    mode: 'Normal',
    status: 'scheduled',
    startAt: tsFromDate(start1),
    endAt: tsFromDate(end1),
    createdAt: tsFromOffset(-15),
    updatedAt: tsFromOffset(-15)
  });

  const start2 = new Date(end1.getTime() + 10 * 60000);
  const end2 = new Date(start2.getTime() + 50 * 60000);
  out.push({
    id: 'seed_demo_d2_upcoming',
    userId: DEMO_USER_ID,
    userName: 'Demo Student',
    userEmail: 'demo@example.edu',
    dormId,
    machineId: `${dormId}_dryer_2`,
    machineLabel: 'Dryer 2',
    machineType: 'dryer',
    mode: 'Normal',
    status: 'scheduled',
    isAutoDryer: true,
    linkedWasherMachineId: `${dormId}_washer_2`,
    startAt: tsFromDate(start2),
    endAt: tsFromDate(end2),
    createdAt: tsFromOffset(-15),
    updatedAt: tsFromOffset(-15)
  });

  return out;
}

function buildPeerSchedules() {
  // A few bookings from other students so the Calendar view feels populated.
  const out = [];
  const peers = [
    { uid: 'peer_rashleigh_010', name: 'Sam R.' },
    { uid: 'peer_rashleigh_011', name: 'Taylor M.' },
    { uid: 'peer_rashleigh_012', name: 'Riley B.' }
  ];
  for (let i = 0; i < peers.length; i++) {
    const peer = peers[i];
    const start = nextQuarterHour(120 + i * 75);
    const end = new Date(start.getTime() + 45 * 60000);
    const washerIdx = (i % 3) + 1;
    out.push({
      id: `seed_peer_w_${i}`,
      userId: peer.uid,
      userName: peer.name,
      dormId: 'rashleigh',
      machineId: `rashleigh_washer_${washerIdx}`,
      machineLabel: `Washer ${washerIdx}`,
      machineType: 'washer',
      mode: 'Normal',
      status: 'scheduled',
      startAt: tsFromDate(start),
      endAt: tsFromDate(end),
      createdAt: tsFromOffset(-30),
      updatedAt: tsFromOffset(-30)
    });
  }
  return out;
}

function buildAnnouncements() {
  return [
    {
      id: 'seed_announcement_rashleigh',
      dormId: 'rashleigh',
      title: 'Welcome to the demo',
      message: 'This is a sample announcement. All data resets on refresh — sign in, schedule, and start machines freely.',
      isActive: true,
      createdAt: tsFromOffset(-120)
    }
  ];
}

export function seedData() {
  const machines = buildMachines();
  const activitySchedules = buildMachineActivity(machines);
  const userSchedules = buildUserSchedules();
  const peerSchedules = buildPeerSchedules();
  const announcements = buildAnnouncements();

  return {
    machines,
    schedules: [...activitySchedules, ...userSchedules, ...peerSchedules],
    announcements,
    feedback: [],
    recurring_schedules: [],
    mail: []
  };
}
