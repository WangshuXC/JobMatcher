"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Briefcase, Brain, Sparkles } from "lucide-react";
import CrawlerPanel from "@/components/CrawlerPanel";
import JobList from "@/components/JobList";
import ResumeMatch from "@/components/ResumeMatch";

export default function HomePage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCrawlComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <main className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                JobMatcher
              </h1>
              <p className="text-sm text-muted-foreground">
                AI 驱动的招聘信息聚合与智能简历匹配平台
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="crawler" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger
              value="crawler"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">爬虫 Agent</span>
              <span className="sm:hidden">爬虫</span>
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">职位列表</span>
              <span className="sm:hidden">职位</span>
            </TabsTrigger>
            <TabsTrigger
              value="match"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">智能匹配</span>
              <span className="sm:hidden">匹配</span>
            </TabsTrigger>
          </TabsList>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <TabsContent value="crawler">
              <CrawlerPanel onCrawlComplete={handleCrawlComplete} />
            </TabsContent>

            <TabsContent value="jobs">
              <JobList refreshTrigger={refreshTrigger} />
            </TabsContent>

            <TabsContent value="match">
              <ResumeMatch />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          <p>JobMatcher — 基于 Playwright 爬虫 Agent 的智能招聘匹配系统</p>
          <p className="mt-1">
            支持字节跳动、腾讯、阿里巴巴等大厂招聘数据聚合
          </p>
        </div>
      </footer>
    </main>
  );
}
