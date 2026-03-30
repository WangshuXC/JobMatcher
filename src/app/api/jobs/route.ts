/**
 * GET /api/jobs - 查询职位列表
 * DELETE /api/jobs - 清除所有职位数据
 *
 * Query 参数:
 *   - source: 数据源筛选
 *   - keyword: 单关键字搜索（向后兼容）
 *   - keywords: JSON 编码的多关键字搜索 { include: string[], exclude: string[], operator: "AND"|"OR" }
 *   - location: 地点筛选（多选，逗号分隔）
 *   - recruitType: 招聘类型
 *   - mode: 搜索模式 "keyword"（默认）| "semantic"
 *   - query: 语义搜索的查询文本
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/store";
import { JobPosting, RecruitType } from "@/types";
import {
  isChinaLocation,
  getProvince,
} from "@/lib/china-location";
import { embed } from "@/lib/ai/embedding";
import { embeddingStore } from "@/lib/ai/embedding-store";

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
  const keywordsJson = searchParams.get("keywords");
  const locationParam = searchParams.get("location");
  const recruitType = (searchParams.get("recruitType") || "social") as RecruitType;
  const mode = searchParams.get("mode") || "keyword";
  const query = searchParams.get("query");

  // --- 语义搜索模式 ---
  if (mode === "semantic" && query) {
    try {
      return await handleSemanticSearch({
        query,
        source,
        keywordsJson,
        keyword,
        locationParam,
        recruitType,
      });
    } catch (err) {
      console.error("[API/jobs] 语义搜索失败，降级到关键字搜索:", err);
    }
  }

  // --- 关键字搜索模式 ---
  let baseJobs: JobPosting[];

  if (keywordsJson) {
    try {
      const parsed = JSON.parse(keywordsJson) as {
        include: string[];
        exclude: string[];
        operator: "AND" | "OR";
      };
      baseJobs = jobStore.searchMulti(
        parsed.include || [],
        parsed.exclude || [],
        parsed.operator || "AND",
        recruitType
      );
      if (source) {
        baseJobs = baseJobs.filter((j) => j.source === source);
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid keywords JSON" },
        { status: 400 }
      );
    }
  } else if (keyword) {
    baseJobs = jobStore.search(keyword, recruitType);
    if (source) {
      baseJobs = baseJobs.filter((j) => j.source === source);
    }
  } else if (source) {
    baseJobs = jobStore.getBySource(source, recruitType);
  } else {
    baseJobs = jobStore.getAll(recruitType);
  }

  return buildResponse(baseJobs, { keywordsJson, keyword, locationParam, recruitType });
}

// ==================== 语义搜索 ====================

async function handleSemanticSearch(params: {
  query: string;
  source: string | null;
  keywordsJson: string | null;
  keyword: string | null;
  locationParam: string | null;
  recruitType: RecruitType;
}) {
  const { query, source, keywordsJson, keyword, locationParam, recruitType } = params;

  // 1. 获取候选职位 key 列表
  let candidateKeys = jobStore.getAllKeys(recruitType);
  if (source) {
    const sourceJobs = jobStore.getBySource(source, recruitType);
    const sourceKeySet = new Set(
      sourceJobs.map((j) => `${j.recruitType || "social"}_${j.source}_${j.sourceId}`)
    );
    candidateKeys = candidateKeys.filter((k) => sourceKeySet.has(k));
  }

  // 2. 将查询文本转为 embedding 向量
  const queryVector = await embed(query);

  // 3. 语义召回 Top 100
  const recalled = embeddingStore.recall(queryVector, candidateKeys, 100);

  // 4. 构建语义分数 Map 并获取召回职位
  const semanticScores: Record<string, number> = {};
  const recalledKeys: string[] = [];
  for (const { key, similarity } of recalled) {
    semanticScores[key] = similarity;
    recalledKeys.push(key);
  }

  let recalledJobs = jobStore.getByKeys(recalledKeys, recruitType);

  // 5. 如有关键字，在召回集上叠加关键字过滤
  if (keywordsJson) {
    try {
      const parsed = JSON.parse(keywordsJson) as {
        include: string[];
        exclude: string[];
        operator: "AND" | "OR";
      };
      const includeLower = (parsed.include || []).map((kw: string) => kw.toLowerCase());
      const excludeLower = (parsed.exclude || []).map((kw: string) => kw.toLowerCase());
      const op = parsed.operator || "AND";

      recalledJobs = recalledJobs.filter((j) => {
        const text = `${j.title} ${j.description} ${j.requirements} ${j.location}`.toLowerCase();
        if (excludeLower.some((kw: string) => text.includes(kw))) return false;
        if (includeLower.length === 0) return true;
        return op === "AND"
          ? includeLower.every((kw: string) => text.includes(kw))
          : includeLower.some((kw: string) => text.includes(kw));
      });
    } catch {
      // ignore parse error
    }
  } else if (keyword) {
    const kw = keyword.toLowerCase();
    recalledJobs = recalledJobs.filter((j) => {
      const text = `${j.title} ${j.description} ${j.requirements} ${j.location}`.toLowerCase();
      return text.includes(kw);
    });
  }

  // 6. 按语义相似度排序
  recalledJobs.sort((a, b) => {
    const keyA = `${a.recruitType || "social"}_${a.source}_${a.sourceId}`;
    const keyB = `${b.recruitType || "social"}_${b.source}_${b.sourceId}`;
    return (semanticScores[keyB] || 0) - (semanticScores[keyA] || 0);
  });

  return buildResponse(recalledJobs, {
    keywordsJson,
    keyword,
    locationParam,
    recruitType,
    semanticScores,
  });
}

// ==================== 公共响应构建 ====================

function buildResponse(
  baseJobs: JobPosting[],
  params: {
    keywordsJson?: string | null;
    keyword?: string | null;
    locationParam?: string | null;
    recruitType: RecruitType;
    semanticScores?: Record<string, number>;
  }
) {
  const { keywordsJson, keyword, locationParam, recruitType, semanticScores } = params;

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
  let jobsForSourceCount: JobPosting[];
  if (keywordsJson) {
    try {
      const parsed = JSON.parse(keywordsJson) as {
        include: string[];
        exclude: string[];
        operator: "AND" | "OR";
      };
      jobsForSourceCount = jobStore.searchMulti(
        parsed.include || [],
        parsed.exclude || [],
        parsed.operator || "AND",
        recruitType
      );
    } catch {
      jobsForSourceCount = jobStore.getAll(recruitType);
    }
  } else if (keyword) {
    jobsForSourceCount = jobStore.search(keyword, recruitType);
  } else {
    jobsForSourceCount = jobStore.getAll(recruitType);
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
      ...(semanticScores ? { semanticScores } : {}),
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
