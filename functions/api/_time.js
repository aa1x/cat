const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getShanghaiWeekStartUtcIso(now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const shanghaiNowMs = nowDate.getTime() + SHANGHAI_OFFSET_MS;
  const shanghaiNow = new Date(shanghaiNowMs);

  const day = shanghaiNow.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;

  let monday4amShanghaiMs = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() - diffToMonday,
    4,
    0,
    0,
    0
  );

  if (shanghaiNowMs < monday4amShanghaiMs) {
    monday4amShanghaiMs -= WEEK_MS;
  }

  const monday4amUtcMs = monday4amShanghaiMs - SHANGHAI_OFFSET_MS;
  return new Date(monday4amUtcMs).toISOString();
}

export function getShanghaiLastWeekStartUtcIso(now = new Date()) {
  const thisWeekStartIso = getShanghaiWeekStartUtcIso(now);
  const thisWeekStartMs = new Date(thisWeekStartIso).getTime();
  return new Date(thisWeekStartMs - WEEK_MS).toISOString();
}

export function getShanghaiDayStart4amUtcIso(now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const shanghaiNowMs = nowDate.getTime() + SHANGHAI_OFFSET_MS;
  const shanghaiNow = new Date(shanghaiNowMs);

  let dayStart4amShanghaiMs = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate(),
    4,
    0,
    0,
    0
  );

  if (shanghaiNowMs < dayStart4amShanghaiMs) {
    dayStart4amShanghaiMs -= 24 * 60 * 60 * 1000;
  }

  const dayStart4amUtcMs = dayStart4amShanghaiMs - SHANGHAI_OFFSET_MS;
  return new Date(dayStart4amUtcMs).toISOString();
}
