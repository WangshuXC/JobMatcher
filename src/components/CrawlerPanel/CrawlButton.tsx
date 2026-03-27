"use client";

import { Button } from "@heroui/react";
import { Play, Loader2 } from "lucide-react";
import { useCrawlerStore } from "@/stores/crawler-store";

interface CrawlButtonProps {
  onStartCrawl: () => void;
}

export default function CrawlButton({ onStartCrawl }: CrawlButtonProps) {
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const selectedSources = useCrawlerStore((s) => s.selectedSources);
  const maxJobs = useCrawlerStore((s) => s.maxJobs);

  const isAllMode = maxJobs === 0;

  return (
    <Button
      size="lg"
      variant="primary"
      className="w-full text-base cursor-pointer"
      onPress={onStartCrawl}
      isDisabled={isRunning || selectedSources.length === 0}
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
  );
}
