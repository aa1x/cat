import { getShanghaiAjiDate, getShanghaiWeekStartUtcIso } from './_time.js';

export async function cleanupOldCatCakeWeeks(db, now = new Date()) {
  const currentWeekStart = getShanghaiWeekStartUtcIso(now);
  await db
    .prepare('DELETE FROM cat_cakes WHERE week_start <> ?')
    .bind(currentWeekStart)
    .run();
  return currentWeekStart;
}

export async function cleanupOldDailyAji(db, now = new Date()) {
  const currentAjiDate = getShanghaiAjiDate(now);
  await db
    .prepare('DELETE FROM daily_aji WHERE aji_date <> ?')
    .bind(currentAjiDate)
    .run();
  return currentAjiDate;
}
