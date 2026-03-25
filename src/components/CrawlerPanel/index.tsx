"use client";

import { Card, CardHeader, CardContent } from "@heroui/react";
import { Bot } from "lucide-react";
import SourceSelector from "./SourceSelector";
import MaxJobsControl from "./MaxJobsControl";
import CrawlButton from "./CrawlButton";
import CrawlProgress from "./CrawlProgress";
import CrawlResults from "./CrawlResults";
import { useCrawl } from "./useCrawl";

export default function CrawlerPanel() {
  const { startCrawl } = useCrawl();

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="flex items-center gap-2 text-xl font-semibold">
        <Bot className="h-6 w-6 text-primary" />
        智能爬虫 Agent
      </CardHeader>
      <CardContent className="space-y-6">
        <SourceSelector />
        <MaxJobsControl />
        <CrawlButton onStartCrawl={startCrawl} />
        <CrawlProgress />
        <CrawlResults />
      </CardContent>
    </Card>
  );
}
