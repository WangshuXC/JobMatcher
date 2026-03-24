/**
 * GET /api/sources - 获取所有数据源配置
 */
import { NextResponse } from "next/server";
import { getAllSources } from "@/lib/crawler/registry";

export async function GET() {
  const sources = getAllSources();
  return NextResponse.json({ success: true, data: sources });
}
