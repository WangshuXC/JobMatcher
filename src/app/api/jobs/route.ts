/**
 * GET /api/jobs - 查询职位列表
 *
 * Query: ?source=xxx&keyword=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const keyword = searchParams.get("keyword");

  let jobs;

  if (keyword) {
    jobs = jobStore.search(keyword);
  } else if (source) {
    jobs = jobStore.getBySource(source);
  } else {
    jobs = jobStore.getAll();
  }

  return NextResponse.json({
    success: true,
    data: {
      jobs,
      total: jobs.length,
      countBySource: jobStore.countBySource(),
    },
  });
}
