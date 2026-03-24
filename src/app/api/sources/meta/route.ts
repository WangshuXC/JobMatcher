/**
 * POST /api/sources/meta - 获取指定数据源的元数据（总页数、每页条数、总职位数）
 *
 * Body: { sources: string[] }
 * 会启动 Playwright 浏览器访问各招聘源的第一页来获取分页信息
 */
import { NextRequest, NextResponse } from "next/server";
import { getCrawler } from "@/lib/crawler/registry";
import { SourceMeta } from "@/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sources } = body as { sources: string[] };

  if (!sources || sources.length === 0) {
    return NextResponse.json(
      { success: false, error: "请至少选择一个数据源" },
      { status: 400 }
    );
  }

  // 并行获取所有数据源的元数据
  const metaPromises = sources.map(async (sourceId): Promise<SourceMeta> => {
    const crawler = getCrawler(sourceId);
    if (!crawler) {
      return {
        sourceId,
        totalJobs: 0,
        pageSize: 10,
        totalPages: 0,
        success: false,
        error: `未找到数据源: ${sourceId}`,
      };
    }
    return crawler.fetchMeta();
  });

  const results = await Promise.all(metaPromises);

  return NextResponse.json({
    success: true,
    data: results,
  });
}
