import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

export async function generateSchedulesFromRecurring(recurringSchedule) {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const schedules = [];
  
  // 从今天开始，往后找14天
  for (let i = 0; i <= 14; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    
    // 检查是否是目标星期几
    if (date.getDay() === recurringSchedule.weekday) {
      const [hours, minutes] = recurringSchedule.time.split(':').map(Number);
      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);
      
      // 如果是今天，但时间已经过了，跳过
      if (startTime <= now) continue;
      
      const endTime = new Date(startTime.getTime() + recurringSchedule.duration * 60 * 1000);
      
      // 检查是否与现有预约冲突
      const conflictQuery = query(
        collection(db, 'schedules'),
        where('machineId', '==', recurringSchedule.machineId)
      );
      
      const conflictSnapshot = await getDocs(conflictQuery);
      let hasConflict = false;
      
      conflictSnapshot.forEach(doc => {
        const schedule = doc.data();
        
        // 跳过已取消的预约
        if (schedule.status === 'cancelled' || schedule.status === 'completed') {
          return;
        }
        
        const scheduleStart = schedule.startAt.toDate();
        const scheduleEnd = schedule.endAt.toDate();
        
        // 检查时间冲突
        if (
          (startTime >= scheduleStart && startTime < scheduleEnd) ||
          (endTime > scheduleStart && endTime <= scheduleEnd) ||
          (startTime <= scheduleStart && endTime >= scheduleEnd)
        ) {
          hasConflict = true;
        }
      });
      
      if (!hasConflict) {
        schedules.push({
          machineId: recurringSchedule.machineId,
          machineLabel: recurringSchedule.machineLabel,
          machineType: recurringSchedule.machineType,
          userId: recurringSchedule.userId,
          userName: recurringSchedule.userName,
          mode: recurringSchedule.mode,
          startAt: Timestamp.fromDate(startTime),
          endAt: Timestamp.fromDate(endTime),
          status: 'scheduled',
          recurringScheduleId: recurringSchedule.id,
          createdAt: Timestamp.now()
        });
      }
    }
  }
  
  // 批量创建预约
  for (const schedule of schedules) {
    await addDoc(collection(db, 'schedules'), schedule);
  }
  
  return schedules.length;
}
