import { getShanghaiAjiDate, getShanghaiDayStart4amUtcIso, getShanghaiWeekStartUtcIso } from '../functions/api/_time.js';

const weekCases = [
  { label: '周一 03:59 上海', now: '2026-05-03T19:59:00.000Z', expected: '2026-04-26T20:00:00.000Z' },
  { label: '周一 04:00 上海', now: '2026-05-03T20:00:00.000Z', expected: '2026-05-03T20:00:00.000Z' },
  { label: '周一 04:01 上海', now: '2026-05-03T20:01:00.000Z', expected: '2026-05-03T20:00:00.000Z' },
  { label: '周日任意时间（12:00 上海）', now: '2026-05-10T04:00:00.000Z', expected: '2026-05-03T20:00:00.000Z' },
  { label: '样例 created_at 应属于本周', now: '2026-05-04T03:41:05.000Z', expected: '2026-05-03T20:00:00.000Z' },
];

const dayCases = [
  { label: '每日 03:59 上海', now: '2026-05-10T19:59:00.000Z', start: '2026-05-09T20:00:00.000Z', ajiDate: '2026-05-10' },
  { label: '每日 04:00 上海', now: '2026-05-10T20:00:00.000Z', start: '2026-05-10T20:00:00.000Z', ajiDate: '2026-05-11' },
  { label: '每日 04:01 上海', now: '2026-05-10T20:01:00.000Z', start: '2026-05-10T20:00:00.000Z', ajiDate: '2026-05-11' },
];

let failed = false;
for (const testCase of weekCases) {
  const actual = getShanghaiWeekStartUtcIso(new Date(testCase.now));
  const ok = actual === testCase.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${testCase.label} | now=${testCase.now} | weekStart=${actual}`);
  if (!ok) failed = true;
}

for (const testCase of dayCases) {
  const actualStart = getShanghaiDayStart4amUtcIso(new Date(testCase.now));
  const actualAjiDate = getShanghaiAjiDate(new Date(testCase.now));
  const ok = actualStart === testCase.start && actualAjiDate === testCase.ajiDate;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${testCase.label} | now=${testCase.now} | dayStart=${actualStart} | ajiDate=${actualAjiDate}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exit(1);
}
