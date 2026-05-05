import { getShanghaiWeekStartUtcIso } from '../functions/api/_time.js';

const cases = [
  {
    label: '周一 03:59 上海',
    now: '2026-05-03T19:59:00.000Z',
    expected: '2026-04-26T20:00:00.000Z'
  },
  {
    label: '周一 04:01 上海',
    now: '2026-05-03T20:01:00.000Z',
    expected: '2026-05-03T20:00:00.000Z'
  },
  {
    label: '周日任意时间（12:00 上海）',
    now: '2026-05-10T04:00:00.000Z',
    expected: '2026-05-03T20:00:00.000Z'
  },
  {
    label: '样例 created_at 应属于本周',
    now: '2026-05-04T03:41:05.000Z',
    expected: '2026-05-03T20:00:00.000Z'
  }
];

let failed = false;
for (const testCase of cases) {
  const actual = getShanghaiWeekStartUtcIso(new Date(testCase.now));
  const ok = actual === testCase.expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${testCase.label} | now=${testCase.now} | weekStart=${actual}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exit(1);
}
