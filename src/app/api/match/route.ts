/**
 * POST /api/match - 智能简历匹配（增强版）
 *
 * 两阶段匹配：
 * 1. Embedding 语义召回（本地计算，始终可用）
 * 2. LLM 精排（需配置 API Key，可选）
 *
 * 使用 SSE 流式推送匹配进度
 *
 * Body: { resumeText: string, topN?: number, useLLM?: boolean }
 */
import { NextRequest } from "next/server";
import { jobStore } from "@/lib/store";
import { smartMatch } from "@/lib/ai/smart-matcher";
import { parseResume } from "@/lib/matcher";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resumeText, topN = 20, useLLM = true, recruitType } = body as {
    resumeText: string;
    topN?: number;
    useLLM?: boolean;
    recruitType?: "social" | "campus";
  };

  if (!resumeText || resumeText.trim().length < 10) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "请输入有效的简历内容（至少10个字符）",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const allJobs = jobStore.getAll(recruitType);

  if (allJobs.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "暂无职位数据，请先执行爬虫抓取职位信息",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // SSE 流式输出
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        // 解析简历（用于返回 profile）
        const resume = parseResume(resumeText);

        sendEvent("progress", { message: "简历解析完成，开始智能匹配..." });

        // 执行两阶段匹配
        const { results, llmResults, method, totalIndexed } = await smartMatch(
          resumeText,
          allJobs,
          topN,
          useLLM,
          (event) => {
            sendEvent("progress", { message: event.message, type: event.type });
          }
        );

        // 发送最终结果
        sendEvent("result", {
          resume: {
            skills: resume.skills,
            experienceYears: resume.experienceYears,
            education: resume.education,
            expectedRole: resume.expectedRole,
            preferredLocations: resume.preferredLocations,
          },
          matches: results,
          llmResults: llmResults || null,
          method,
          totalJobsAnalyzed: allJobs.length,
          totalIndexed,
        });

        sendEvent("done", { message: "匹配完成" });
      } catch (err) {
        console.error("[Match API] 匹配失败:", err);
        sendEvent("error", {
          message: err instanceof Error ? err.message : "匹配过程出错",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
