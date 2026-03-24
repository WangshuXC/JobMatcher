/**
 * GET /api/jobs - 查询职位列表
 * DELETE /api/jobs - 清除所有职位数据
 *
 * Query: ?source=xxx&keyword=xxx&location=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/store";
import { JobPosting } from "@/types";

/**
 * 将职位的 location 字段拆分为独立的城市列表
 * 例如 "北京、杭州" → ["北京", "杭州"]
 */
function splitLocation(loc: string): string[] {
  return loc
    .split(/[、，,/／]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 判断某个职位是否匹配指定地点
 * 会将 "北京、杭州" 拆分后逐一比对
 */
function jobMatchesLocation(job: JobPosting, location: string): boolean {
  const parts = splitLocation(job.location || "");
  return parts.includes(location);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const keyword = searchParams.get("keyword");
  const location = searchParams.get("location");

  // --- 第一步：按 source + keyword 得到基础结果 ---
  let baseJobs;

  if (keyword) {
    baseJobs = jobStore.search(keyword);
    // keyword + source 同时存在时，在搜索结果中再按 source 过滤
    if (source) {
      baseJobs = baseJobs.filter((j) => j.source === source);
    }
  } else if (source) {
    baseJobs = jobStore.getBySource(source);
  } else {
    baseJobs = jobStore.getAll();
  }

  // --- 第二步：从 baseJobs 中提取地点列表（拆分复合地点后去重计数） ---
  const locationCounts: Record<string, number> = {};
  for (const j of baseJobs) {
    const parts = splitLocation(j.location || "");
    for (const part of parts) {
      locationCounts[part] = (locationCounts[part] || 0) + 1;
    }
  }
  const filteredLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([loc]) => loc);

  // --- 第三步：按地点筛选（拆分后匹配） ---
  let jobs = baseJobs;
  if (location) {
    jobs = jobs.filter((j) => jobMatchesLocation(j, location));
  }

  // --- 第四步：从最终 jobs 中动态计算各数据源数量 ---
  let jobsForSourceCount;
  if (keyword) {
    jobsForSourceCount = jobStore.search(keyword);
  } else {
    jobsForSourceCount = jobStore.getAll();
  }
  if (location) {
    jobsForSourceCount = jobsForSourceCount.filter((j) => jobMatchesLocation(j, location));
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
      locations: filteredLocations,
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
