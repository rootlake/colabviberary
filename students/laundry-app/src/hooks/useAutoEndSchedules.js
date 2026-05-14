import { useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { queueLaundryCompleteEmail } from '../utils/emailNotifications';

export function useAutoEndSchedules() {
  useEffect(() => {
    const checkAndEndSchedules = async () => {
      const now = new Date();
      
      const machinesSnapshot = await getDocs(collection(db, 'machines'));
      
      for (const machineDoc of machinesSnapshot.docs) {
        const machine = machineDoc.data();
        const machineRef = doc(db, 'machines', machineDoc.id);
        
        if (machine.status === 'in_use' && machine.estimatedEndAt) {
          const endTime = machine.estimatedEndAt.toDate();
          
          if (endTime <= now) {
            await updateDoc(machineRef, {
              status: 'completed_not_picked_up',
              actualEndAt: Timestamp.fromDate(endTime),
              pendingPickup: true,
              pendingPickupUserId: machine.currentUserId || null,
              pendingPickupUserName: machine.currentUserName || null,
              pendingPickupUserEmail: machine.currentUserEmail || null,
              pendingPickupAt: Timestamp.fromDate(endTime),
              updatedAt: Timestamp.now()
            });

            if (machine.currentScheduleId) {
              await updateDoc(doc(db, 'schedules', machine.currentScheduleId), {
                status: 'completed',
                endAt: Timestamp.fromDate(endTime),
                updatedAt: Timestamp.now()
              }).catch(() => {});
            }

            await queueLaundryCompleteEmail({
              scheduleId: machine.currentScheduleId || null,
              machineId: machineDoc.id,
              machineLabel: machine.label,
              dormId: machine.dormId || null,
              userEmail: machine.currentUserEmail || null,
              userName: machine.currentUserName || null,
              endAt: Timestamp.fromDate(endTime)
            });
            
            console.log(`自动结束使用：${machine.label}`);
          }
        }

        if (machine.status === 'completed_not_picked_up' && !machine.pendingPickupAt && machine.actualEndAt) {
          await updateDoc(machineRef, {
            pendingPickup: true,
            pendingPickupUserId: machine.currentUserId || null,
            pendingPickupUserName: machine.currentUserName || null,
            pendingPickupUserEmail: machine.currentUserEmail || null,
            pendingPickupAt: machine.actualEndAt,
            updatedAt: Timestamp.now()
          });
        }

        const hasStalePendingState = machine.status !== 'completed_not_picked_up' && (
          machine.pendingPickup ||
          machine.pendingPickupAt ||
          machine.pendingPickupUserId ||
          machine.pendingPickupUserName ||
          machine.pendingPickupUserEmail ||
          machine.actualEndAt
        );

        if (hasStalePendingState) {
          await updateDoc(machineRef, {
            pendingPickup: false,
            pendingPickupUserId: null,
            pendingPickupUserName: null,
            pendingPickupUserEmail: null,
            pendingPickupAt: null,
            actualEndAt: null,
            updatedAt: Timestamp.now()
          }).catch(() => {});
        }
      }
    };

    checkAndEndSchedules();
    const interval = setInterval(checkAndEndSchedules, 30000);
    
    return () => clearInterval(interval);
  }, []);
}
