"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Chip, ScrollShadow } from "@heroui/react";
import { Building2, MapPin, Hash, Loader2, Sparkles } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { getSourceName, getSourceColor } from "@/lib/crawler/source-meta";
import { highlightText, getSemanticLabel } from "@/lib/search-utils";
import type { HighlightSegment } from "@/lib/search-utils";

/** 每次加载的条目数 */
const PAGE_SIZE = 30;
/** 触发加载更多的滚动底部阈值（px） */
const LOAD_MORE_THRESHOLD = 200;

/** 渲染高亮文本片段 */
function HighlightedText({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <mark key={i} className="bg-warning/30 text-foreground rounded-sm px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

interface VirtualJobListProps {
  onSelectJob: (jobId: string) => void;
}

export default function VirtualJobList({ onSelectJob }: VirtualJobListProps) {
  "use no memo";

  const filteredJobs = useJobStore((s) => s.filteredJobs);
  const parsedKeywords = useJobStore((s) => s.parsedKeywords);
  const semanticScores = useJobStore((s) => s.semanticScores);
  const searchMode = useJobStore((s) => s.searchMode);

  // 获取高亮用的关键字列表
  const highlightKeywords = useMemo(
    () => parsedKeywords?.include ?? [],
    [parsedKeywords]
  );

  // 当前展示的条目数量
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 追踪上一次 filteredJobs 长度
  const [prevLength, setPrevLength] = useState(filteredJobs.length);
  const [scrollResetFlag, setScrollResetFlag] = useState(0);
  if (filteredJobs.length !== prevLength) {
    setPrevLength(filteredJobs.length);
    if (filteredJobs.length < prevLength) {
      setDisplayCount(PAGE_SIZE);
      setScrollResetFlag((f) => f + 1);
    }
  }

  useEffect(() => {
    if (scrollResetFlag > 0) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [scrollResetFlag]);

  const displayedJobs = filteredJobs.slice(0, displayCount);
  const hasMore = displayCount < filteredJobs.length;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredJobs.length));
  }, [filteredJobs.length]);

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
      className="h-118 overflow-y-auto"
      onScroll={handleScroll}
      role="listbox"
      aria-label="职位列表"
    >
      <div className="flex flex-col gap-1">
        {displayedJobs.map((job) => {
          const jobKey = `${job.recruitType || "social"}_${job.source}_${job.sourceId}`;
          const semScore = semanticScores[jobKey];
          const semLabel = semScore != null ? getSemanticLabel(semScore) : null;
          const showSemantic = searchMode === "semantic" && semLabel && semLabel.label;

          return (
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
                      {highlightKeywords.length > 0 ? (
                        <HighlightedText
                          segments={highlightText(job.title, highlightKeywords)}
                        />
                      ) : (
                        job.title
                      )}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {showSemantic && (
                      <Chip
                        size="sm"
                        variant="soft"
                        className="text-xs"
                      >
                        <Chip.Label className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {semLabel.label}
                        </Chip.Label>
                      </Chip>
                    )}
                    <Chip
                      size="sm"
                      className={getSourceColor(job.source)}
                    >
                      <Chip.Label>{getSourceName(job.source)}</Chip.Label>
                    </Chip>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {highlightKeywords.length > 0 ? (
                    <HighlightedText
                      segments={highlightText(
                        job.description.slice(0, 120) + "...",
                        highlightKeywords
                      )}
                    />
                  ) : (
                    <>{job.description.slice(0, 120)}...</>
                  )}
                </p>
              </div>
            </div>
          );
        })}

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
