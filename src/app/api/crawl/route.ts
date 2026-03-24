/**
 * POST /api/crawl - 执行爬虫抓取
 *
 * Body: { sources: string[], maxJobs?: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCrawler } from "@/lib/crawler/registry";
import { jobStore } from "@/lib/store";
import { CrawlResult } from "@/types";

export const maxDuration = 300; // 最大执行时间 300 秒（并行抓取详情速度更快，但总体时间可能更长）

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sources, maxJobs = 10 } = body as {
    sources: string[];
    maxJobs?: number;
  };

  if (!sources || sources.length === 0) {
    return NextResponse.json(
      { success: false, error: "请至少选择一个数据源" },
      { status: 400 }
    );
  }

  const results: CrawlResult[] = [];

  for (const sourceId of sources) {
    const crawler = getCrawler(sourceId);
    if (!crawler) {
      results.push({
        source: sourceId,
        status: "error",
        jobCount: 0,
        message: `未找到数据源: ${sourceId}`,
        jobs: [],
      });
      continue;
    }

    const result = await crawler.crawl(maxJobs);
    results.push(result);

    // 存储抓取结果
    if (result.jobs.length > 0) {
      jobStore.upsertMany(result.jobs);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      results,
      totalJobs: jobStore.count(),
      countBySource: jobStore.countBySource(),
    },
  });
}
