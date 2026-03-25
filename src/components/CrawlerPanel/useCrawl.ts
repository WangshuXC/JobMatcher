"use client";

import { useEffect, useCallback } from "react";
import { useCrawlerStore } from "@/stores/crawler-store";
import { useJobStore } from "@/stores/job-store";
import { CrawlerSource } from "@/types";

/**
 * CrawlerPanel 业务逻辑 hook
 * - 加载数据源
 * - SSE 流式爬取
 */
export function useCrawl() {
  const {
    selectedSources,
    maxJobs,
    setIsRunning,
    setSources,
    setSelectedSources,
    setProgressMsg,
    setCrawledCount,
    addResult,
    resetCrawlState,
  } = useCrawlerStore();

  const triggerRefresh = useJobStore((s) => s.triggerRefresh);

  // 加载数据源
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSources(data.data);
          setSelectedSources(data.data.map((s: CrawlerSource) => s.id));
        }
      })
      .catch((err) => console.error("加载数据源失败:", err));
  }, [setSources, setSelectedSources]);

  // 开始爬取
  const startCrawl = useCallback(async () => {
    if (selectedSources.length === 0) return;

    setIsRunning(true);
    resetCrawlState();
    setProgressMsg("正在启动爬虫...");

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources, maxJobs }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          if (!raw.trim()) continue;

          const eventMatch = raw.match(/^event:\s*(.+)$/m);
          const dataMatch = raw.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1].trim();
          let eventData;
          try {
            eventData = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          switch (eventType) {
            case "progress":
              setProgressMsg(eventData.message || "");
              break;
            case "jobs":
              setCrawledCount(eventData.totalJobs || 0);
              triggerRefresh();
              break;
            case "result":
              addResult({
                source: eventData.source,
                status: eventData.status,
                jobCount: eventData.jobCount,
                message: eventData.message,
                duration: eventData.duration,
              });
              setProgressMsg("");
              break;
            case "done":
              setCrawledCount(eventData.totalJobs || 0);
              triggerRefresh();
              break;
            case "error":
              console.error("爬取错误:", eventData.error);
              break;
          }
        }
      }
    } catch (err) {
      console.error("爬取失败:", err);
    } finally {
      setIsRunning(false);
      setProgressMsg("");
    }
  }, [
    selectedSources,
    maxJobs,
    setIsRunning,
    resetCrawlState,
    setProgressMsg,
    setCrawledCount,
    addResult,
    triggerRefresh,
  ]);

  return { startCrawl };
}
