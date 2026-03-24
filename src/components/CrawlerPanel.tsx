"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Bot,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import { CrawlerSource } from "@/types";

interface CrawlResultData {
  source: string;
  status: string;
  jobCount: number;
  message: string;
  duration?: number;
}

interface CrawlerPanelProps {
  onCrawlComplete: () => void;
  /** 实时增量更新回调 — 每当新一批职位到达时触发 */
  onJobsUpdate?: () => void;
}

export default function CrawlerPanel({ onCrawlComplete, onJobsUpdate }: CrawlerPanelProps) {
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CrawlResultData[]>([]);
  /** maxJobs: 0 表示全部抓取，> 0 表示限制数量 */
  const [maxJobs, setMaxJobs] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [crawledCount, setCrawledCount] = useState(0);

  // 加载数据源
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSources(data.data);
          // 默认全选
          setSelectedSources(data.data.map((s: CrawlerSource) => s.id));
        }
      })
      .catch((err) => console.error("加载数据源失败:", err));
  }, []);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /** maxJobs === 0 表示全部抓取模式 */
  const isAllMode = maxJobs === 0;

  /** 滑块上限 */
  const sliderMax = 500;

  /**
   * 开始爬取 — 使用 SSE 流式消费结果
   */
  const startCrawl = async () => {
    if (selectedSources.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setProgressMsg("正在启动爬虫...");
    setCrawledCount(0);

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

        // 解析 SSE 事件（以 \n\n 分隔）
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // 最后一段可能不完整

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
              // 一批新职位到达
              setCrawledCount(eventData.totalJobs || 0);
              // 通知父组件刷新 JobList
              onJobsUpdate?.();
              break;

            case "result":
              // 某个数据源爬取完毕
              setResults((prev) => [
                ...prev,
                {
                  source: eventData.source,
                  status: eventData.status,
                  jobCount: eventData.jobCount,
                  message: eventData.message,
                  duration: eventData.duration,
                },
              ]);
              setProgressMsg("");
              break;

            case "done":
              setCrawledCount(eventData.totalJobs || 0);
              onCrawlComplete();
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
  };

  // 计算滑块步长
  const getSliderStep = (): number => {
    if (sliderMax <= 20) return 1;
    if (sliderMax <= 100) return 5;
    return 10;
  };

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Bot className="h-6 w-6 text-primary" />
          智能爬虫 Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 数据源选择 */}
        <div>
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">
            选择招聘数据源
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sources.map((source, index) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                    selectedSources.includes(source.id)
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                  disabled={isRunning}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{source.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {source.description}
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 抓取岗位数设置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">
              抓取岗位数量
            </label>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {isAllMode ? "全部抓取" : `${maxJobs} 个岗位`}
            </span>
          </div>

          {/* 滑块 — 仅在非全部模式下显示 */}
          {!isAllMode && (
            <Slider
              value={[maxJobs]}
              onValueChange={(values) => setMaxJobs(Array.isArray(values) ? values[0] : values)}
              min={1}
              max={sliderMax}
              step={getSliderStep()}
              disabled={isRunning}
              className="w-full"
            />
          )}

          {/* 快捷按钮 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={isAllMode ? "default" : "outline"}
              onClick={() => setMaxJobs(0)}
              disabled={isRunning}
              className="cursor-pointer text-xs px-3"
            >
              全部
            </Button>
            {[10, 20, 50, 100, 200].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={!isAllMode && maxJobs === n ? "default" : "outline"}
                onClick={() => setMaxJobs(n)}
                disabled={isRunning}
                className="cursor-pointer text-xs px-3"
              >
                {n} 个
              </Button>
            ))}
          </div>
        </div>

        {/* 开始按钮 */}
        <Button
          size="lg"
          className="w-full text-base cursor-pointer"
          onClick={startCrawl}
          disabled={isRunning || selectedSources.length === 0}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              正在抓取中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              开始抓取{isAllMode ? "全部" : ` ${maxJobs} 个`}岗位
            </>
          )}
        </Button>

        {/* 进度条 */}
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Progress value={null} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {progressMsg || "爬虫 Agent 正在抓取中..."}
              {crawledCount > 0 && (
                <span className="ml-2 text-primary font-medium">
                  已入库 {crawledCount} 个职位
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* 结果显示 */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-muted-foreground">
                抓取结果
              </h3>
              {results.map((result, index) => (
                <motion.div
                  key={result.source}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {result.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">
                        {sources.find((s) => s.id === result.source)?.name ||
                          result.source}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {result.jobCount} 个职位
                    </Badge>
                    {result.duration && (
                      <Badge variant="outline">
                        {(result.duration / 1000).toFixed(1)}s
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
