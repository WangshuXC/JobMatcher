"use client";

import { useCallback } from "react";
import { useMatchStore } from "@/stores/match-store";
import { useAppStore } from "@/stores/app-store";

/**
 * ResumeMatch 业务逻辑 hook
 * - 发起匹配请求（SSE 流式）
 */
export function useMatch() {
  const {
    resumeText,
    setIsMatching,
    setResults,
    setLLMResults,
    setProfile,
    setError,
    setProgressMessage,
    setMatchMethod,
    setTotalIndexed,
    setTotalJobsAnalyzed,
    resetMatchState,
  } = useMatchStore();

  const recruitType = useAppStore((s) => s.recruitType);

  const handleMatch = useCallback(async () => {
    if (!resumeText.trim()) {
      setError("请输入简历内容");
      return;
    }

    setIsMatching(true);
    resetMatchState();

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, topN: 20, useLLM: true, recruitType }),
      });

      if (!response.ok) {
        // 非 SSE 响应（如 400 错误）
        const errorData = await response.json();
        setError(errorData.error || "匹配失败");
        setIsMatching(false);
        return;
      }

      // SSE 流式读取
      const reader = response.body?.getReader();
      if (!reader) {
        setError("无法建立流式连接");
        setIsMatching(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 \n\n 分割事件
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const eventMatch = part.match(/event:\s*(\S+)/);
          const dataMatch = part.match(/data:\s*([\s\S]*)/);

          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          let data: Record<string, unknown>;

          try {
            data = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          switch (eventType) {
            case "progress":
              setProgressMessage((data.message as string) || "");
              break;

            case "result":
              setProfile(
                data.resume as {
                  skills: string[];
                  experienceYears: number;
                  education: string;
                  expectedRole: string[];
                  preferredLocations: string[];
                }
              );
              setResults(
                data.matches as Array<{
                  job: import("@/types").JobPosting;
                  score: number;
                  breakdown: import("@/types").MatchBreakdown;
                  reasons: string[];
                }>
              );
              if (data.llmResults) {
                setLLMResults(data.llmResults as import("@/types").LLMMatchResult[]);
              }
              setMatchMethod(
                (data.method as "embedding+llm" | "embedding+rule" | "rule-only") || ""
              );
              setTotalIndexed((data.totalIndexed as number) || 0);
              setTotalJobsAnalyzed((data.totalJobsAnalyzed as number) || 0);
              break;

            case "error":
              setError((data.message as string) || "匹配过程出错");
              break;

            case "done":
              // 匹配完成
              break;
          }
        }
      }
    } catch (err) {
      console.error("匹配请求失败:", err);
      setError("请求失败，请重试");
    } finally {
      setIsMatching(false);
      setProgressMessage("");
    }
  }, [
    resumeText,
    recruitType,
    setIsMatching,
    setResults,
    setLLMResults,
    setProfile,
    setError,
    setProgressMessage,
    setMatchMethod,
    setTotalIndexed,
    setTotalJobsAnalyzed,
    resetMatchState,
  ]);

  return { handleMatch };
}
