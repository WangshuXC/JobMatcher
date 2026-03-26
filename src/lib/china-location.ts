/**
 * 中国行政区划工具 —— 基于 china-division 数据包
 *
 * 功能：
 * 1. 判断一个地名是否属于中国
 * 2. 查询城市所属省份（归一化后的短名）
 * 3. 直辖市 & 省份名本身也支持查询
 */

import citiesData from "china-division/dist/cities.json";
import provincesData from "china-division/dist/provinces.json";

// ==================== 类型 ====================

interface CityEntry {
  code: string;
  name: string;
  provinceCode: string;
}

interface ProvinceEntry {
  code: string;
  name: string;
}

// ==================== 内部数据构建 ====================

const cities = citiesData as CityEntry[];
const provinces = provincesData as ProvinceEntry[];

/** provinceCode → 省份短名（去后缀） */
const codeToShortProvince = new Map<string, string>();
/** 省份全名 → 短名 */
const provinceFullToShort = new Map<string, string>();
/** 省份短名 set（用于判断输入本身就是省名） */
const provinceShortNames = new Set<string>();

for (const p of provinces) {
  const short = p.name
    .replace(/(省|市|自治区|维吾尔|壮族|回族|特别行政区)$/g, "")
    .replace(/(维吾尔|壮族|回族)/, "")
    .trim();
  codeToShortProvince.set(p.code, short);
  provinceFullToShort.set(p.name, short);
  provinceShortNames.add(short);
}

/**
 * 城市名（多种变体）→ 省份短名 的查找表
 * 例: "杭州" → "浙江", "杭州市" → "浙江", "石家庄" → "河北"
 */
const cityToProvince = new Map<string, string>();

/** 直辖市代码 → 省份短名（北京11、天津12、上海31、重庆50） */
const MUNICIPALITY_CODES = new Set(["11", "12", "31", "50"]);

for (const c of cities) {
  const provShort = codeToShortProvince.get(c.provinceCode);
  if (!provShort) continue;

  // 直辖市的 cities.json 中 name 是 "市辖区"，跳过，直辖市由省份名处理
  if (c.name === "市辖区" || c.name === "县") continue;

  // 登记全名和去"市"/"地区"/"自治州"后缀的短名
  const variants = new Set<string>();
  variants.add(c.name);
  const short = c.name
    .replace(/(市|地区|自治州|自治县|林区)$/, "")
    .trim();
  if (short && short !== c.name) variants.add(short);

  // 特殊处理：带"族"等民族名的自治州，如"黔东南苗族侗族自治州" → "黔东南"
  const ethnicShort = c.name
    .replace(/(苗族|侗族|土家族|彝族|藏族|哈萨克|蒙古|柯尔克孜|回族|壮族|傣族|白族|哈尼族|傈僳族|佤族|拉祜族|布依族|瑶族)+/g, "")
    .replace(/(自治州|自治县|地区)$/, "")
    .trim();
  if (ethnicShort && ethnicShort.length >= 2) variants.add(ethnicShort);

  for (const v of variants) {
    cityToProvince.set(v, provShort);
  }
}

// 直辖市本身的名称也加入（"北京"→"北京"，"上海"→"上海"）
for (const p of provinces) {
  const short = provinceFullToShort.get(p.name)!;
  // 直辖市：省名=市名，cityToProvince 指向自身
  if (MUNICIPALITY_CODES.has(p.code)) {
    cityToProvince.set(short, short);
    cityToProvince.set(p.name, short);
  }
  // 所有省份名也注册（当爬虫返回"广东"、"浙江"时也能识别）
  cityToProvince.set(short, short);
  cityToProvince.set(p.name, short);
}

// 港澳台
const EXTRA_REGIONS: Record<string, string> = {
  香港: "香港",
  澳门: "澳门",
  台湾: "台湾",
  台北: "台湾",
  高雄: "台湾",
  新竹: "台湾",
  台中: "台湾",
  台南: "台湾",
};
for (const [city, prov] of Object.entries(EXTRA_REGIONS)) {
  cityToProvince.set(city, prov);
}

// ==================== 公开 API ====================

/**
 * 判断一个归一化后的地名是否属于中国。
 * - 先查 cityToProvince 表（覆盖 340+ 地级市 + 31 省 + 港澳台）
 * - 若不在表中，用中文字符检测兜底（排除海外黑名单）
 */
export function isChinaLocation(loc: string): boolean {
  if (!loc) return false;
  if (cityToProvince.has(loc)) return true;
  // 海外黑名单
  if (OVERSEAS_LOCATIONS.has(loc)) return false;
  // 纯中文兜底（数据包未收录的小地名，如开发区、新区等）
  return /^[\u4e00-\u9fff\u3400-\u4dbf\u00b7\-·—–\s]+$/.test(loc);
}

/**
 * 获取城市所属省份短名。
 * 找不到返回 undefined（即海外或未知）。
 */
export function getProvince(loc: string): string | undefined {
  return cityToProvince.get(loc);
}

/**
 * 判断是否为省份名（短名或全名）
 */
export function isProvinceName(loc: string): boolean {
  return provinceShortNames.has(loc) || provinceFullToShort.has(loc);
}

// ==================== 海外黑名单（中文写法） ====================

const OVERSEAS_LOCATIONS = new Set([
  // 亚洲
  "新加坡", "东京", "大阪", "首尔", "曼谷", "吉隆坡", "雅加达",
  "河内", "胡志明", "马尼拉", "孟买", "班加罗尔", "海得拉巴", "德里",
  "迪拜", "利雅得", "特拉维夫",
  // 欧洲
  "伦敦", "巴黎", "柏林", "慕尼黑", "阿姆斯特丹", "都柏林",
  "苏黎世", "斯德哥尔摩", "赫尔辛基", "华沙", "布拉格", "维也纳",
  "米兰", "马德里", "巴塞罗那", "里斯本",
  // 北美
  "纽约", "旧金山", "洛杉矶", "西雅图", "芝加哥", "波士顿",
  "华盛顿", "多伦多", "温哥华", "蒙特利尔",
  // 大洋洲
  "悉尼", "墨尔本",
  // 南美 & 非洲
  "圣保罗", "开普敦",
]);
