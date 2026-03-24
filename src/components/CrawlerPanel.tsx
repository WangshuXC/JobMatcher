"use client";

import { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
  Database,
} from "lucide-react";
import { CrawlerSource, SourceMeta } from "@/types";

interface CrawlResultData {
  source: string;
  status: string;
  jobCount: number;
  message: string;
  duration?: number;
}

interface CrawlerPanelProps {
  onCrawlComplete: () => void;
}

export default function CrawlerPanel({ onCrawlComplete }: CrawlerPanelProps) {
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CrawlResultData[]>([]);
  const [maxJobs, setMaxJobs] = useState(10);

  // 元数据相关
  const [metaMap, setMetaMap] = useState<Record<string, SourceMeta>>({});
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);

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

  // 获取选中数据源的元数据
  const fetchMeta = useCallback(async () => {
    if (selectedSources.length === 0) return;

    setIsFetchingMeta(true);
    try {
      const response = await fetch("/api/sources/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources }),
      });

      const data = await response.json();
      if (data.success) {
        const newMetaMap: Record<string, SourceMeta> = {};
        for (const meta of data.data as SourceMeta[]) {
          newMetaMap[meta.sourceId] = meta;
        }
        setMetaMap(newMetaMap);
        setMetaLoaded(true);
      }
    } catch (err) {
      console.error("获取元数据失败:", err);
    } finally {
      setIsFetchingMeta(false);
    }
  }, [selectedSources]);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    // 切换数据源后清除已加载的元数据标记
    setMetaLoaded(false);
  };

  // 计算选中源的最大可抓取数
  const getMaxAvailableJobs = (): number => {
    if (!metaLoaded) return 200; // 默认最大值
    let minTotal = Infinity;
    for (const sourceId of selectedSources) {
      const meta = metaMap[sourceId];
      if (meta && meta.success && meta.totalJobs > 0) {
        minTotal = Math.min(minTotal, meta.totalJobs);
      }
    }
    return minTotal === Infinity ? 200 : minTotal;
  };

  const maxAvailable = getMaxAvailableJobs();

  // 限制 maxJobs 不超过可用范围
  useEffect(() => {
    if (metaLoaded && maxJobs > maxAvailable) {
      setMaxJobs(Math.min(maxJobs, maxAvailable));
    }
  }, [metaLoaded, maxAvailable, maxJobs]);

  const startCrawl = async () => {
    if (selectedSources.length === 0) return;

    setIsRunning(true);
    setResults([]);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources, maxJobs }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.data.results);
        onCrawlComplete();
      }
    } catch (err) {
      console.error("爬取失败:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // 计算滑块步长
  const getSliderStep = (): number => {
    if (maxAvailable <= 20) return 1;
    if (maxAvailable <= 100) return 5;
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
            {sources.map((source, index) => {
              const meta = metaMap[source.id];
              return (
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
                        {/* 元数据信息 */}
                        {meta && meta.success && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Database className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary font-medium">
                              约 {meta.totalJobs} 个岗位 · {meta.totalPages} 页 · 每页 {meta.pageSize} 条
                            </span>
                          </div>
                        )}
                        {meta && !meta.success && (
                          <p className="text-xs text-destructive mt-1.5">
                            获取信息失败
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 获取元数据按钮 */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMeta}
            disabled={isFetchingMeta || isRunning || selectedSources.length === 0}
            className="cursor-pointer"
          >
            {isFetchingMeta ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在获取岗位信息...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {metaLoaded ? "刷新岗位信息" : "获取可抓取岗位信息"}
              </>
            )}
          </Button>
          {metaLoaded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-muted-foreground"
            >
              ✅ 已获取各数据源岗位总数信息
            </motion.span>
          )}
        </div>

        {/* 抓取岗位数设置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">
              抓取岗位数量
            </label>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {maxJobs} 个岗位
              {metaLoaded && (
                <span className="text-muted-foreground font-normal ml-1">
                  / 最多 {maxAvailable} 个
                </span>
              )}
            </span>
          </div>

          {/* 滑块 */}
          <Slider
            value={[maxJobs]}
            onValueChange={(values) => setMaxJobs(Array.isArray(values) ? values[0] : values)}
            min={1}
            max={metaLoaded ? maxAvailable : 200}
            step={getSliderStep()}
            disabled={isRunning}
            className="w-full"
          />

          {/* 快捷按钮 */}
          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 20, 50, 100].filter((n) => !metaLoaded || n <= maxAvailable).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={maxJobs === n ? "default" : "outline"}
                onClick={() => setMaxJobs(n)}
                disabled={isRunning}
                className="cursor-pointer text-xs px-3"
              >
                {n} 个
              </Button>
            ))}
            {metaLoaded && maxAvailable > 100 && (
              <Button
                size="sm"
                variant={maxJobs === maxAvailable ? "default" : "outline"}
                onClick={() => setMaxJobs(maxAvailable)}
                disabled={isRunning}
                className="cursor-pointer text-xs px-3"
              >
                全部 ({maxAvailable})
              </Button>
            )}
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
              正在并行抓取中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              开始抓取 {maxJobs} 个岗位（{selectedSources.length} 个数据源）
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
              爬虫 Agent 正在并行抓取详情页，请稍候...
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
