"use client";

import { Button, Chip, Input, Label, TextField } from "@heroui/react";
import { Search, Sparkles, X } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { parseSearchInput } from "@/lib/search-utils";
import { type ReactNode, useCallback } from "react";

interface SearchBarProps {
  onSearch: () => void;
  trailing?: ReactNode;
}

export default function SearchBar({ onSearch, trailing }: SearchBarProps) {
  const keyword = useJobStore((s) => s.keyword);
  const setKeyword = useJobStore((s) => s.setKeyword);
  const setParsedKeywords = useJobStore((s) => s.setParsedKeywords);
  const searchMode = useJobStore((s) => s.searchMode);
  const setSearchMode = useJobStore((s) => s.setSearchMode);
  const searchLoading = useJobStore((s) => s.searchLoading);
  const parsedKeywords = useJobStore((s) => s.parsedKeywords);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setKeyword(value);
      // 实时解析关键字，用于 Chip 展示
      const parsed = parseSearchInput(value);
      setParsedKeywords(parsed.include.length > 0 || parsed.exclude.length > 0 ? parsed : null);
    },
    [setKeyword, setParsedKeywords]
  );

  const handleRemoveKeyword = useCallback(
    (word: string, type: "include" | "exclude") => {
      if (!parsedKeywords) return;
      const newInclude = type === "include"
        ? parsedKeywords.include.filter((k) => k !== word)
        : parsedKeywords.include;
      const newExclude = type === "exclude"
        ? parsedKeywords.exclude.filter((k) => k !== word)
        : parsedKeywords.exclude;

      // 根据 operator 重建输入字符串
      const sep = parsedKeywords.operator === "OR" ? " | " : " ";
      const parts = [
        ...newInclude,
        ...newExclude.map((k) => `-${k}`),
      ];
      const newValue = parts.join(sep);
      setKeyword(newValue);
      const reParsed = parseSearchInput(newValue);
      setParsedKeywords(reParsed.include.length > 0 || reParsed.exclude.length > 0 ? reParsed : null);
    },
    [parsedKeywords, setKeyword, setParsedKeywords]
  );

  const toggleSearchMode = useCallback(() => {
    setSearchMode(searchMode === "keyword" ? "semantic" : "keyword");
  }, [searchMode, setSearchMode]);

  const hasKeywords = parsedKeywords && (parsedKeywords.include.length > 0 || parsedKeywords.exclude.length > 0);

  return (
    <div className="flex flex-col gap-2">
      {/* 搜索栏主行 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <TextField fullWidth>
            <Label className="sr-only">搜索职位</Label>
            <Input
              placeholder={
                searchMode === "semantic"
                  ? "语义搜索：输入职位描述、技能要求..."
                  : "搜索：多关键字空格分隔，| 为或，-排除"
              }
              value={keyword}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              fullWidth
              className="pl-10"
            />
          </TextField>
        </div>

        {/* 语义搜索开关 */}
        <span title={searchMode === "semantic" ? "切换到关键字搜索" : "切换到语义搜索（AI）"}>
          <Button
            variant={searchMode === "semantic" ? "primary" : "ghost"}
            onPress={toggleSearchMode}
            className="cursor-pointer px-3"
            aria-label={searchMode === "semantic" ? "切换到关键字搜索" : "切换到语义搜索（AI）"}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </span>

        <Button
          variant="primary"
          onPress={onSearch}
          isDisabled={searchLoading}
          className="cursor-pointer"
        >
          {searchLoading ? (
            <span className="animate-spin mr-1">⏳</span>
          ) : (
            <Search className="h-4 w-4 mr-1" />
          )}
          {searchLoading ? "搜索中..." : "搜索"}
        </Button>
        {trailing}
      </div>

      {/* 搜索模式提示 + 关键字标签 */}
      {(searchMode === "semantic" || hasKeywords) && (
        <div className="flex flex-wrap items-center gap-2 ml-1">
          {searchMode === "semantic" && (
            <Chip variant="primary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1 inline" />
              语义搜索
            </Chip>
          )}

          {hasKeywords && parsedKeywords.include.length > 1 && (
            <span className="text-xs text-default-400">
              {parsedKeywords.operator === "OR" ? "或匹配：" : "且匹配："}
            </span>
          )}

          {parsedKeywords?.include.map((kw) => (
            <Chip
              key={`inc-${kw}`}
              variant="secondary"
              className="text-xs"
            >
              {kw}
              <button
                onClick={() => handleRemoveKeyword(kw, "include")}
                className="ml-1 hover:text-danger cursor-pointer"
                aria-label={`删除关键字 ${kw}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Chip>
          ))}

          {parsedKeywords?.exclude.map((kw) => (
            <Chip
              key={`exc-${kw}`}
              variant="soft"
              className="text-xs"
            >
              <span className="text-danger mr-0.5">-</span>
              {kw}
              <button
                onClick={() => handleRemoveKeyword(kw, "exclude")}
                className="ml-1 hover:text-danger cursor-pointer"
                aria-label={`删除排除关键字 ${kw}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
