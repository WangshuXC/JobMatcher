/**
 * POST /api/crawl - 执行爬虫抓取（SSE 流式返回）
 *
 * Body: { sources: string[], maxJobs?: number }
 *
 * 返回 Server-Sent Events 流:
 * - event: jobs     — 一批新职位数据 { source, jobs: JobPosting[] }
 * - event: progress — 爬虫进度 { source, status, message }
 * - event: result   — 某个数据源爬取完毕 { source, status, jobCount, message, duration }
 * - event: done     — 全部完成 { totalJobs, countBySource }
 * - event: error    — 错误 { error }
 */
import { NextRequest } from "next/server";
import { getCrawler } from "@/lib/crawler/registry";
import { jobStore } from "@/lib/store";
import { JobPosting } from "@/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sources, maxJobs = 0 } = body as {
    sources: string[];
    maxJobs?: number;
  };

  if (!sources || sources.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "请至少选择一个数据源" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      /** 发送 SSE 事件 */
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        for (const sourceId of sources) {
          const crawler = getCrawler(sourceId);
          if (!crawler) {
            send("result", {
              source: sourceId,
              status: "error",
              jobCount: 0,
              message: `未找到数据源: ${sourceId}`,
            });
            continue;
          }

          send("progress", {
            source: sourceId,
            status: "running",
            message: `开始抓取 ${crawler.source.name}...`,
          });

          // 设置增量回调：每批职位完成后立即存储 + 推送
          crawler.onJobsBatch = (jobs: JobPosting[]) => {
            // 增量存储到 jobStore（upsertMany 按 source_sourceId 去重）
            jobStore.upsertMany(jobs);

            // 推送这批新数据到前端
            send("jobs", {
              source: sourceId,
              jobs,
              totalJobs: jobStore.count(),
              countBySource: jobStore.countBySource(),
            });
          };

          const result = await crawler.crawl(maxJobs);

          // 如果有些 jobs 没有通过 onJobsBatch 推送过（比如老爬虫没设置回调的情况），
          // 在这里补充存储
          if (result.jobs.length > 0) {
            jobStore.upsertMany(result.jobs);
          }

          send("result", {
            source: result.source,
            status: result.status,
            jobCount: result.jobCount,
            message: result.message,
            duration: result.duration,
          });
        }

        // 全部完成
        send("done", {
          totalJobs: jobStore.count(),
          countBySource: jobStore.countBySource(),
        });
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : String(err),
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
