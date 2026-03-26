"use client";

import { Card, CardHeader, CardContent } from "@heroui/react";
import { Bot } from "lucide-react";
import SourceSelector from "./SourceSelector";
import MaxJobsControl from "./MaxJobsControl";
import CrawlButton from "./CrawlButton";
import CrawlProgress from "./CrawlProgress";
import { useCrawl } from "./useCrawl";
import { useCrawlerStore } from "@/stores/crawler-store";

export default function CrawlerPanel() {
  const { startCrawl } = useCrawl();
  const isRunning = useCrawlerStore((s) => s.isRunning);

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="flex items-center gap-2 text-xl font-semibold">
        <Bot className="h-7 w-7 text-primary" />
        智能爬虫 Agent
      </CardHeader>
      <CardContent className="space-y-6">
        <SourceSelector />
        {!isRunning && (
          <>
            <MaxJobsControl />
            <CrawlButton onStartCrawl={startCrawl} />
          </>
        )}
        <CrawlProgress />
      </CardContent>
    </Card>
  );
}
