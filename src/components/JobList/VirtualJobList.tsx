"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Chip } from "@heroui/react";
import { Building2, MapPin, Hash } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { getSourceName, getSourceColor } from "@/lib/crawler/source-meta";

const ROW_HEIGHT = 134;
const GAP = 4;

interface VirtualJobListProps {
  onSelectJob: (jobId: string) => void;
}

export default function VirtualJobList({ onSelectJob }: VirtualJobListProps) {
  "use no memo";

  const filteredJobs = useJobStore((s) => s.filteredJobs);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredJobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: GAP,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-125 overflow-y-auto overscroll-y-contain"
      role="listbox"
      aria-label="职位列表"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const job = filteredJobs[virtualRow.index];
          return (
            <div
              key={job.id}
              className="absolute left-0 w-full cursor-pointer border rounded-lg hover:bg-accent/50 transition-colors"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
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
          );
        })}
      </div>
    </div>
  );
}
