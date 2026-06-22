const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

  return new Date(monday4amShanghaiMs - SHANGHAI_OFFSET_MS).toISOString();
}

export function getShanghaiLastWeekStartUtcIso(now = new Date()) {
  const thisWeekStartMs = new Date(getShanghaiWeekStartUtcIso(now)).getTime();
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
    dayStart4amShanghaiMs -= DAY_MS;
  }

  return new Date(dayStart4amShanghaiMs - SHANGHAI_OFFSET_MS).toISOString();
}

export function getShanghaiAjiDate(now = new Date()) {
  const dayStartUtcMs = new Date(getShanghaiDayStart4amUtcIso(now)).getTime();
  return new Date(dayStartUtcMs + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}
