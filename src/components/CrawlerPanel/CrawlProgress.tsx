"use client";

import { motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { useCrawlerStore } from "@/stores/crawler-store";

export default function CrawlProgress() {
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const progressMsg = useCrawlerStore((s) => s.progressMsg);
  const crawledCount = useCrawlerStore((s) => s.crawledCount);

  if (!isRunning) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
  );
}
