"use client";

import { useCallback } from "react";
import { Tabs } from "@heroui/react";
import { Bot, Briefcase, Brain, Sparkles, GraduationCap, Building2 } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { useAppStore } from "@/stores/app-store";
import CrawlerPanel from "@/components/CrawlerPanel";
import JobList from "@/components/JobList";
import ResumeMatch from "@/components/ResumeMatch";
import type { Key } from "react";

export default function HomePage() {
  const triggerRefresh = useJobStore((s) => s.triggerRefresh);
  const recruitType = useAppStore((s) => s.recruitType);
  const setRecruitType = useAppStore((s) => s.setRecruitType);

  const handleSelectionChange = useCallback(
    (key: Key) => {
      if (key === "jobs") {
        triggerRefresh();
      }
    },
    [triggerRefresh]
  );

  const handleRecruitTypeChange = useCallback(
    (key: Key) => {
      setRecruitType(key as "social" | "campus");
      triggerRefresh();
    },
    [setRecruitType, triggerRefresh]
  );

  return (
    <main className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">JobMatcher</h1>
              </div>
            </div>

            {/* 社招/校招切换 */}
            <Tabs
              selectedKey={recruitType}
              onSelectionChange={handleRecruitTypeChange}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="招聘类型切换">
                  <Tabs.Tab id="social" className={`flex items-center gap-1.5 cursor-pointer ${
                    recruitType === "social"
                      ? "text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}>
                    <Tabs.Indicator />
                    <Building2 className="h-3.5 w-3.5" />
                    <span>社招</span>
                  </Tabs.Tab>
                  <Tabs.Tab id="campus" className={`flex items-center gap-1.5 cursor-pointer ${
                    recruitType === "campus"
                      ? "text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}>
                    <Tabs.Indicator />
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>校招</span>
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Tabs
          defaultSelectedKey="crawler"
          onSelectionChange={handleSelectionChange}
          className="space-y-6"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="功能导航">
              <Tabs.Tab id="crawler" className="flex items-center gap-2 text-foreground cursor-pointer">
                <Tabs.Indicator />
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">爬虫 Agent</span>
                <span className="sm:hidden">爬虫</span>
              </Tabs.Tab>
              <Tabs.Tab id="jobs" className="flex items-center gap-2 text-foreground cursor-pointer">
                <Tabs.Indicator />
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">职位列表</span>
                <span className="sm:hidden">职位</span>
              </Tabs.Tab>
              <Tabs.Tab id="match" className="flex items-center gap-2 text-foreground cursor-pointer">
                <Tabs.Indicator />
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">智能匹配</span>
                <span className="sm:hidden">匹配</span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="crawler">
            <CrawlerPanel />
          </Tabs.Panel>

          <Tabs.Panel id="jobs">
            <JobList />
          </Tabs.Panel>

          <Tabs.Panel id="match">
            <ResumeMatch />
          </Tabs.Panel>
        </Tabs>
      </div>
    </main>
  );
}
