"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Search } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { type ReactNode } from "react";

interface SearchBarProps {
  onSearch: () => void;
  trailing?: ReactNode;
}

export default function SearchBar({ onSearch, trailing }: SearchBarProps) {
  const keyword = useJobStore((s) => s.keyword);
  const setKeyword = useJobStore((s) => s.setKeyword);

  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <TextField fullWidth>
          <Label className="sr-only">搜索职位</Label>
          <Input
            placeholder="搜索职位名称、描述或地点..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            fullWidth
            className="pl-10"
          />
        </TextField>
      </div>
      <Button variant="primary" onPress={onSearch} className="cursor-pointer">
        <Search className="h-4 w-4 mr-1" />
        搜索
      </Button>
      {trailing}
    </div>
  );
}
