import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const sanitize = (value) => (value ? String(value) : '');

const buildMailDocId = (scheduleId, machineId, endAt) => {
  if (scheduleId) return `schedule_${scheduleId}`;
  const millis = endAt?.toMillis ? endAt.toMillis() : endAt instanceof Date ? endAt.getTime() : Date.now();
  return `machine_${machineId || 'unknown'}_${millis}`;
};

export async function queueLaundryCompleteEmail({
  scheduleId,
  machineId,
  machineLabel,
  dormId,
  userEmail,
  userName,
  endAt
}) {
  if (!userEmail) return;

  const mailDocId = buildMailDocId(scheduleId, machineId, endAt);
  const mailRef = doc(db, 'mail', mailDocId);
  const existing = await getDoc(mailRef);
  if (existing.exists()) return;

  const label = sanitize(machineLabel) || 'Laundry machine';
  const name = sanitize(userName) || 'there';
  const dorm = sanitize(dormId);

  const subject = `Laundry complete: ${label}`;
  const text = `Hi ${name}, your laundry (${label}) is complete${dorm ? ` in ${dorm}` : ''}. Please pick up your items.`;
  const html = `<p>Hi ${name},</p><p>Your laundry (<strong>${label}</strong>) is complete${dorm ? ` in <strong>${dorm}</strong>` : ''}.</p><p>Please pick up your items.</p>`;

  await setDoc(mailRef, {
    to: userEmail,
    message: { subject, text, html },
    meta: {
      scheduleId: scheduleId || null,
      machineId: machineId || null,
      machineLabel: label,
      dormId: dorm || null
    },
    createdAt: serverTimestamp()
  });
}
