"use client";

import { Button } from "@heroui/react";
import { ArrowUpDown, Clock } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import type { SortBy } from "@/types";

export default function SortControl() {
  const sortBy = useJobStore((s) => s.sortBy);
  const setSortBy = useJobStore((s) => s.setSortBy);
  const filteredJobs = useJobStore((s) => s.filteredJobs);
  const keyword = useJobStore((s) => s.keyword);
  const searchMode = useJobStore((s) => s.searchMode);

  const options: { value: SortBy; label: string; icon: React.ReactNode }[] = [
    { value: "relevance", label: "相关度", icon: <ArrowUpDown className="h-3.5 w-3.5" /> },
    { value: "time", label: "时间", icon: <Clock className="h-3.5 w-3.5" /> },
  ];

  // 无搜索条件时不显示排序
  if (!keyword.trim() && searchMode === "keyword") return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        找到 <span className="font-semibold text-foreground">{filteredJobs.length}</span> 个匹配职位
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">排序：</span>
        {options.map((opt) => (
          <Button
            key={opt.value}
            variant={sortBy === opt.value ? "primary" : "ghost"}
            size="sm"
            onPress={() => setSortBy(opt.value)}
            className="cursor-pointer text-xs h-7 px-2"
          >
            {opt.icon}
            <span className="ml-1">{opt.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
