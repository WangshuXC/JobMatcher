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
import type { RecruitType } from "@/types";

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
    (type: RecruitType) => {
      setRecruitType(type);
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
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
              <button
                onClick={() => handleRecruitTypeChange("social")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  recruitType === "social"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>社招</span>
              </button>
              <button
                onClick={() => handleRecruitTypeChange("campus")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  recruitType === "campus"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>校招</span>
              </button>
            </div>
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
              <Tabs.Tab id="crawler" className="flex items-center gap-2 text-foreground">
                <Tabs.Indicator />
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">爬虫 Agent</span>
                <span className="sm:hidden">爬虫</span>
              </Tabs.Tab>
              <Tabs.Tab id="jobs" className="flex items-center gap-2 text-foreground">
                <Tabs.Indicator />
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">职位列表</span>
                <span className="sm:hidden">职位</span>
              </Tabs.Tab>
              <Tabs.Tab id="match" className="flex items-center gap-2 text-foreground">
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

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          <p>JobMatcher — 基于 Playwright 爬虫 Agent 的智能招聘匹配系统</p>
        </div>
      </footer>
    </main>
  );
}
