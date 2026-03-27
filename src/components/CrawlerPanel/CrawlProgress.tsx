"use client";

import { ProgressBar, Label, Chip } from "@heroui/react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { useCrawlerStore, SourceProgress } from "@/stores/crawler-store";

/** 格式化耗时 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return `${minutes}m${remainSec}s`;
}

/** 获取数据源显示名称 */
function getSourceName(sourceId: string, sources: { id: string; name: string }[]): string {
  return sources.find((s) => s.id === sourceId)?.name || sourceId;
}

/** 单个数据源的进度行 */
function SourceProgressItem({
  progress,
  sourceName,
}: {
  progress: SourceProgress;
  sourceName: string;
}) {
  const { status, current, total, message, jobCount, duration } = progress;
  const isIndeterminate = total === 0;
  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
      {/* 头部行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "pending" && (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          {status === "running" && (
            <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
          )}
          {status === "completed" && (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          )}
          {status === "error" && (
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
          )}

          <div>
            <span
              className={`text-sm font-medium ${
                status === "pending"
                  ? "text-muted-foreground"
                  : status === "error"
                    ? "text-destructive"
                    : "text-foreground"
              }`}
            >
              {sourceName}
            </span>
            {/* 完成/错误状态下的消息显示在名称下方 */}
            {(status === "completed" || status === "error") && message && (
              <p className="text-xs text-muted-foreground truncate max-w-60">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* 右侧 Chip / 统计 */}
        <div className="flex items-center gap-2">
          {(status === "completed" || status === "error") && (
            <Chip  variant="secondary">
              <Chip.Label>{jobCount} 个职位</Chip.Label>
            </Chip>
          )}
          {status === "completed" && duration != null && (
            <Chip  variant="soft">
              <Chip.Label>{formatDuration(duration)}</Chip.Label>
            </Chip>
          )}
          {status === "running" && jobCount > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">{jobCount}</span> 个职位
            </span>
          )}
          {status === "running" && total > 0 && (
            <span className="text-xs text-muted-foreground">{percentage}%</span>
          )}
          {status === "pending" && (
            <span className="text-xs text-muted-foreground">等待中</span>
          )}
        </div>
      </div>

      {/* 进度条：仅 running 状态显示 */}
      {status === "running" && (
        <ProgressBar
          aria-label={`${sourceName} 抓取进度`}
          size="sm"
          color="default"
          isIndeterminate={isIndeterminate}
          value={isIndeterminate ? undefined : percentage}
          className="w-full"
        >
          <div className="flex justify-between items-center mb-0.5">
            <Label className="text-xs text-muted-foreground truncate max-w-[80%]">
              {message}
            </Label>
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}
    </div>
  );
}

export default function CrawlProgress() {
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const sourceProgress = useCrawlerStore((s) => s.sourceProgress);
  const sources = useCrawlerStore((s) => s.sources);
  const crawledCount = useCrawlerStore((s) => s.crawledCount);

  const progressEntries = Object.values(sourceProgress);

  // 不在运行且没有进度数据，不显示
  if (!isRunning && progressEntries.length === 0) return null;

  // 按状态排序：running → pending → completed → error
  const statusOrder = { running: 0, pending: 1, completed: 2, error: 3 };
  const sorted = [...progressEntries].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  const completedCount = sorted.filter((p) => p.status === "completed").length;
  const totalSources = sorted.length;

  return (
    <div className="space-y-2">
      {/* 总进度概览 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isRunning ? "正在抓取..." : "抓取完成"}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            数据源 {completedCount}/{totalSources}
          </span>
          {crawledCount > 0 && (
            <span>
              共 <span className="text-primary font-medium">{crawledCount}</span> 个职位
            </span>
          )}
        </div>
      </div>

      {/* 各源进度卡片 */}
      <div className="space-y-2">
        {sorted.map((progress) => (
          <SourceProgressItem
            key={progress.sourceId}
            progress={progress}
            sourceName={getSourceName(progress.sourceId, sources)}
          />
        ))}
      </div>
    </div>
  );
}
