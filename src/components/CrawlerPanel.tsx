"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
}

export default function CrawlerPanel({ onCrawlComplete }: CrawlerPanelProps) {
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CrawlResultData[]>([]);
  const [maxPages, setMaxPages] = useState(1);

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

  const startCrawl = async () => {
    if (selectedSources.length === 0) return;

    setIsRunning(true);
    setResults([]);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources, maxPages }),
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
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
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

        {/* 页数设置 */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-muted-foreground">
            抓取页数：
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 5].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={maxPages === n ? "default" : "outline"}
                onClick={() => setMaxPages(n)}
                disabled={isRunning}
              >
                {n} 页
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
              开始抓取 ({selectedSources.length} 个数据源)
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
              爬虫 Agent 正在工作中，请稍候...
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
