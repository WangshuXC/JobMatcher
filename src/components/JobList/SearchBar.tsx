"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useJobStore } from "@/stores/job-store";

interface SearchBarProps {
  onSearch: () => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const keyword = useJobStore((s) => s.keyword);
  const setKeyword = useJobStore((s) => s.setKeyword);

  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索职位名称、描述或地点..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="pl-10"
        />
      </div>
      <Button onClick={onSearch} className="cursor-pointer">
        <Search className="h-4 w-4 mr-1" />
        搜索
      </Button>
    </div>
  );
}
