export const VALID_SERVERS = ['官服', 'B服'];
export const VALID_CAT_CAKES = [
  '垃圾糕', '冰糕', '星辰拿铁', '蜂蜜骰子', '芝麻酥', '游戏糕手', '红豆牛奶', '雪顶椰椰', '花见团子',
  '盹盹咪', '藤萝饼', '谐乐小猫', '蝶豆花慕斯', '白桃布丁', '薄荷提拉咪', '重力酥', '拉姆之友', '萤绒绒', '纯白的孩子',
  '捣乱专家', '太卜糍', '幸运点心', '墨镜猫咪', '天使圣代', '蓝莓罐子', '白玉青团', '糯米团',
];
export const VALID_CAT_LOCATIONS = [
  '猫爬架旁桌上台灯', '吧台上固定电话', '车厢上中部沙发', '留声机旁盆栽', '二楼楼梯旁花坛', '车厢下中部沙发', '帕姆衣架旁椅子',
];

const VALID_CAT_CAKE_SET = new Set(VALID_CAT_CAKES);
const VALID_CAT_LOCATION_SET = new Set(VALID_CAT_LOCATIONS);

export function getDb(env = {}) {
  const db = env.DB || env.CAT_DB;
  if (!db) throw new Error('Cloudflare D1 绑定 DB 或 CAT_DB 未配置');
  return db;
}

export function isValidUid(uid) {
  return typeof uid === 'string' && /^\d{9}$/.test(uid);
}

export function getServerByUid(uid) {
  if (!isValidUid(uid)) return '';
  if (uid.startsWith('1')) return '官服';
  if (uid.startsWith('5')) return 'B服';
  return '';
}

export function isValidServer(server) {
  return VALID_SERVERS.includes(server);
}

export function validateCatCakes(catCakes) {
  return Array.isArray(catCakes) && catCakes.length === 3 && catCakes.every((name) => VALID_CAT_CAKE_SET.has(name));
}

export function validateCatLocations(catLocations) {
  if (!Array.isArray(catLocations)) return false;
  if (catLocations.length === 0) return true;
  if (catLocations.length !== 3) return false;
  const unique = new Set(catLocations);
  return unique.size === 3 && catLocations.every((location) => VALID_CAT_LOCATION_SET.has(location));
}

export function encodeJson(value) {
  return JSON.stringify(value ?? []);
}

export function decodeJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function deserializeCatCakeRow(row) {
  if (!row) return row;
  return {
    ...row,
    cat_cakes: decodeJson(row.cat_cakes),
    cat_locations: decodeJson(row.cat_locations),
  };
}
