/**
 * POST /api/match - 简历智能匹配
 *
 * Body: { resumeText: string, topN?: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/store";
import { parseResume, matchJobs } from "@/lib/matcher";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resumeText, topN = 20 } = body as {
    resumeText: string;
    topN?: number;
  };

  if (!resumeText || resumeText.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: "请输入有效的简历内容（至少10个字符）" },
      { status: 400 }
    );
  }

  const allJobs = jobStore.getAll();

  if (allJobs.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "暂无职位数据，请先执行爬虫抓取职位信息",
      },
      { status: 400 }
    );
  }

  // 解析简历
  const resumeData = parseResume(resumeText);

  // 执行匹配
  const results = matchJobs(resumeData, allJobs, topN);

  return NextResponse.json({
    success: true,
    data: {
      resume: {
        skills: resumeData.skills,
        experienceYears: resumeData.experienceYears,
        education: resumeData.education,
        expectedRole: resumeData.expectedRole,
        preferredLocations: resumeData.preferredLocations,
      },
      matches: results,
      totalJobsAnalyzed: allJobs.length,
    },
  });
}
