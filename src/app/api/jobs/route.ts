/**
 * GET /api/jobs - 查询职位列表
 * DELETE /api/jobs - 清除所有职位数据
 *
 * Query: ?source=xxx&keyword=xxx&location=city1,city2,...（多选，逗号分隔）
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/store";
import { JobPosting } from "@/types";
import {
  isChinaLocation,
  getProvince,
} from "@/lib/china-location";

// ==================== 地名工具函数 ====================

/** 将职位的 location 字段拆分为独立的城市列表 */
function splitLocation(loc: string): string[] {
  return loc
    .split(/[、，,/／]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 归一化地名：去除行政区划后缀 */
function normalizeLocation(loc: string): string {
  return loc
    .replace(/(市|省|自治区|自治州|特别行政区|维吾尔|壮族|回族)$/g, "")
    .trim() || loc;
}

/** 拆分并归一化地点 */
function splitAndNormalizeLocation(loc: string): string[] {
  return splitLocation(loc).map(normalizeLocation);
}

/** 判断职位是否匹配指定地点集合（任一匹配即可） */
function jobMatchesLocations(job: JobPosting, locs: Set<string>): boolean {
  const parts = splitAndNormalizeLocation(job.location || "");
  return parts.some((p) => locs.has(p));
}

// ==================== 地点分组 ====================

/** 热门城市（北上广深），始终排最前 */
const HOT_CITIES = new Set(["北京", "上海", "广州", "深圳", "杭州", "成都"]);

/** 地点分组结构 */
interface LocationGroup {
  label: string;
  locations: { name: string; count: number }[];
}

/**
 * 将扁平地点列表分为：热门城市 / 各省份（按省归并） / 海外
 * - 热门城市（北上广深）单独一组，排最前
 * - 国内城市按省份归组，每组内按职位数降序；省份间按总数降序
 * - 海外城市归一组，排最后
 */
function groupLocations(
  locationCounts: Record<string, number>
): LocationGroup[] {
  const hot: { name: string; count: number }[] = [];
  const overseas: { name: string; count: number }[] = [];
  /** 省份 → 城市列表 */
  const provinceMap = new Map<string, { name: string; count: number }[]>();

  for (const [loc, count] of Object.entries(locationCounts)) {
    const item = { name: loc, count };

    if (HOT_CITIES.has(loc)) {
      hot.push(item);
      continue;
    }

    if (isChinaLocation(loc)) {
      const prov = getProvince(loc) ?? "其他";
      if (!provinceMap.has(prov)) provinceMap.set(prov, []);
      provinceMap.get(prov)!.push(item);
    } else {
      overseas.push(item);
    }
  }

  // 排序辅助
  const byCount = (a: { count: number }, b: { count: number }) =>
    b.count - a.count;

  // 热门城市按数量降序
  hot.sort(byCount);

  // 各省按省内总数降序排列，"其他"单独提出来排到最后
  const provinceGroups: LocationGroup[] = [];
  let otherGroup: LocationGroup | null = null;

  const entries = [...provinceMap.entries()].map(([prov, locs]) => ({
    prov,
    locs,
    total: locs.reduce((s, l) => s + l.count, 0),
  }));
  entries.sort((a, b) => b.total - a.total);

  for (const { prov, locs } of entries) {
    locs.sort(byCount);
    if (prov === "其他") {
      otherGroup = { label: "其他", locations: locs };
    } else {
      provinceGroups.push({ label: prov, locations: locs });
    }
  }

  // 海外按数量降序
  overseas.sort(byCount);

  // 组装最终结果：热门 → 各省 → 其他 → 海外
  const groups: LocationGroup[] = [];
  if (hot.length > 0) groups.push({ label: "热门城市", locations: hot });
  groups.push(...provinceGroups);
  if (otherGroup) groups.push(otherGroup);
  if (overseas.length > 0) groups.push({ label: "海外", locations: overseas });
  return groups;
}

// ==================== API Handler ====================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const keyword = searchParams.get("keyword");
  const locationParam = searchParams.get("location"); // 逗号分隔的多选

  // --- 第一步：按 source + keyword 得到基础结果 ---
  let baseJobs;

  if (keyword) {
    baseJobs = jobStore.search(keyword);
    if (source) {
      baseJobs = baseJobs.filter((j) => j.source === source);
    }
  } else if (source) {
    baseJobs = jobStore.getBySource(source);
  } else {
    baseJobs = jobStore.getAll();
  }

  // --- 第二步：从 baseJobs 中提取地点列表（拆分归一化后去重计数） ---
  const locationCounts: Record<string, number> = {};
  for (const j of baseJobs) {
    const parts = splitAndNormalizeLocation(j.location || "");
    for (const part of parts) {
      locationCounts[part] = (locationCounts[part] || 0) + 1;
    }
  }
  const locationGroups = groupLocations(locationCounts);

  // --- 第三步：按地点筛选（支持多选，逗号分隔） ---
  let jobs = baseJobs;
  const selectedLocs = locationParam
    ? new Set(locationParam.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  if (selectedLocs && selectedLocs.size > 0) {
    jobs = jobs.filter((j) => jobMatchesLocations(j, selectedLocs));
  }

  // --- 第四步：从最终 jobs 中动态计算各数据源数量 ---
  let jobsForSourceCount;
  if (keyword) {
    jobsForSourceCount = jobStore.search(keyword);
  } else {
    jobsForSourceCount = jobStore.getAll();
  }
  if (selectedLocs && selectedLocs.size > 0) {
    jobsForSourceCount = jobsForSourceCount.filter((j) =>
      jobMatchesLocations(j, selectedLocs)
    );
  }

  const filteredCountBySource: Record<string, number> = {};
  for (const j of jobsForSourceCount) {
    filteredCountBySource[j.source] = (filteredCountBySource[j.source] || 0) + 1;
  }

  return NextResponse.json({
    success: true,
    data: {
      jobs,
      total: jobs.length,
      countBySource: filteredCountBySource,
      locationGroups,
    },
  });
}

export async function DELETE() {
  jobStore.clearAll();
  return NextResponse.json({
    success: true,
    message: "所有职位数据已清除",
  });
}
