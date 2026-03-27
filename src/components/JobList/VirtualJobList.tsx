"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Chip, ScrollShadow } from "@heroui/react";
import { Building2, MapPin, Hash, Loader2 } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { getSourceName, getSourceColor } from "@/lib/crawler/source-meta";

/** 每次加载的条目数 */
const PAGE_SIZE = 30;
/** 触发加载更多的滚动底部阈值（px） */
const LOAD_MORE_THRESHOLD = 200;

interface VirtualJobListProps {
  onSelectJob: (jobId: string) => void;
}

export default function VirtualJobList({ onSelectJob }: VirtualJobListProps) {
  "use no memo";

  const filteredJobs = useJobStore((s) => s.filteredJobs);

  // 当前展示的条目数量
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 追踪上一次 filteredJobs 长度，使用 React 推荐的 "store previous props" 模式
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevLength, setPrevLength] = useState(filteredJobs.length);
  // 递增计数器，用于触发滚动到顶部的 effect
  const [scrollResetFlag, setScrollResetFlag] = useState(0);
  if (filteredJobs.length !== prevLength) {
    setPrevLength(filteredJobs.length);
    // 数据变少（筛选/清除）→ 重置并滚动到顶部；数据变多（SSE push）→ 不动
    if (filteredJobs.length < prevLength) {
      setDisplayCount(PAGE_SIZE);
      setScrollResetFlag((f) => f + 1);
    }
  }

  // 筛选条件切换时滚动到顶部
  useEffect(() => {
    if (scrollResetFlag > 0) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [scrollResetFlag]);

  // 实际展示的切片
  const displayedJobs = filteredJobs.slice(0, displayCount);
  const hasMore = displayCount < filteredJobs.length;

  // 加载更多
  const loadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredJobs.length));
  }, [filteredJobs.length]);

  // 滚动到底部自动加载
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceToBottom < LOAD_MORE_THRESHOLD && hasMore) {
        loadMore();
      }
    },
    [hasMore, loadMore]
  );

  return (
    <ScrollShadow
      ref={scrollRef}
      hideScrollBar
      className="h-125 overflow-y-auto"
      onScroll={handleScroll}
      role="listbox"
      aria-label="职位列表"
    >
      <div className="flex flex-col gap-1">
        {displayedJobs.map((job) => (
          <div
            key={job.id}
            className="w-full cursor-pointer border rounded-lg hover:bg-accent/50 transition-colors"
            role="option"
            aria-selected={false}
            tabIndex={0}
            onClick={() => onSelectJob(job.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectJob(job.id);
              }
            }}
          >
            <div className="w-full p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">
                    {job.title}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {job.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location || "未知"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      {job.sourceId}
                    </span>
                  </div>
                </div>
                <Chip
                  size="sm"
                  className={`shrink-0 ${getSourceColor(job.source)}`}
                >
                  <Chip.Label>{getSourceName(job.source)}</Chip.Label>
                </Chip>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {job.description.slice(0, 120)}...
              </p>
            </div>
          </div>
        ))}

        {/* 加载更多提示 */}
        {hasMore && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">向下滚动加载更多...</span>
          </div>
        )}
      </div>
    </ScrollShadow>
  );
}
