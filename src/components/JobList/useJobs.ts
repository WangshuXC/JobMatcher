"use client";

import { useEffect, useCallback, useRef } from "react";
import { useJobStore } from "@/stores/job-store";
import { useAppStore } from "@/stores/app-store";
import { parseSearchInput, serializeSearchQuery, isEmptyQuery } from "@/lib/search-utils";

/**
 * JobList 业务逻辑 hook
 * - 初始加载 & refreshTrigger 变化时拉取数据
 * - 多关键字搜索 / 语义搜索
 * - 按数据源/地点筛选
 * - 清除全部数据
 */
export function useJobs() {
  const {
    selectedSource,
    keyword,
    selectedLocations,
    refreshTrigger,
    searchMode,
    parsedKeywords,
    setInitialLoading,
    setJobData,
    setClearing,
    setSearchLoading,
    setParsedKeywords,
    clearAll,
  } = useJobStore();

  const recruitType = useAppStore((s) => s.recruitType);

  // 用 ref 保存当前筛选条件
  const filtersRef = useRef({
    source: selectedSource,
    keyword,
    locations: selectedLocations,
    recruitType,
    searchMode,
    parsedKeywords,
  });
  useEffect(() => {
    filtersRef.current = {
      source: selectedSource,
      keyword,
      locations: selectedLocations,
      recruitType,
      searchMode,
      parsedKeywords,
    };
  }, [selectedSource, keyword, selectedLocations, recruitType, searchMode, parsedKeywords]);

  /** 构建搜索参数 */
  const buildSearchParams = useCallback(
    (
      source: string | null,
      kw: string,
      locations: string[],
      opts?: { mode?: string; query?: string }
    ) => {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (locations.length > 0) params.set("location", locations.join(","));
      params.set("recruitType", filtersRef.current.recruitType);

      // 解析多关键字
      const parsed = parseSearchInput(kw);
      if (!isEmptyQuery(parsed)) {
        params.set("keywords", serializeSearchQuery(parsed));
      }

      // 语义搜索模式
      if (opts?.mode === "semantic" && opts?.query) {
        params.set("mode", "semantic");
        params.set("query", opts.query);
      }

      return params;
    },
    []
  );

  /** 通用请求函数 */
  const fetchJobs = useCallback(
    async (
      source: string | null,
      kw: string,
      locations: string[],
      opts?: { mode?: string; query?: string }
    ) => {
      const params = buildSearchParams(source, kw, locations, opts);

      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setJobData({
          jobs: data.data.jobs,
          countBySource: data.data.countBySource,
          locationGroups: data.data.locationGroups || [],
          semanticScores: data.data.semanticScores,
        });
      }
    },
    [buildSearchParams, setJobData]
  );

  // 组件挂载和 refreshTrigger 变化时拉取数据
  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setInitialLoading(true);
      const { source, keyword: kw, locations, recruitType: rt } = filtersRef.current;
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (kw) {
        const parsed = parseSearchInput(kw);
        if (!isEmptyQuery(parsed)) {
          params.set("keywords", serializeSearchQuery(parsed));
        }
      }
      if (locations.length > 0) params.set("location", locations.join(","));
      params.set("recruitType", rt);

      try {
        const response = await fetch(`/api/jobs?${params.toString()}`);
        const data = await response.json();
        if (!cancelled && data.success) {
          setJobData({
            jobs: data.data.jobs,
            countBySource: data.data.countBySource,
            locationGroups: data.data.locationGroups || [],
            semanticScores: data.data.semanticScores,
          });
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    loadJobs();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, recruitType, setInitialLoading, setJobData]);

  /** 搜索（手动触发） */
  const handleSearch = useCallback(async () => {
    const { source, keyword: kw, locations, searchMode: mode } = filtersRef.current;

    // 更新解析后的关键字
    const parsed = parseSearchInput(kw);
    setParsedKeywords(!isEmptyQuery(parsed) ? parsed : null);

    if (mode === "semantic" && kw.trim()) {
      // 语义搜索模式
      setSearchLoading(true);
      try {
        await fetchJobs(source, kw, locations, {
          mode: "semantic",
          query: kw.trim(),
        });
      } finally {
        setSearchLoading(false);
      }
    } else {
      // 关键字搜索模式
      await fetchJobs(source, kw, locations);
    }
  }, [fetchJobs, setParsedKeywords, setSearchLoading]);

  /** 按数据源/地点筛选 */
  const handleFilter = useCallback(
    (source: string | null, locations: string[]) => {
      const { keyword: kw, searchMode: mode } = filtersRef.current;
      if (mode === "semantic" && kw.trim()) {
        fetchJobs(source, kw, locations, {
          mode: "semantic",
          query: kw.trim(),
        });
      } else {
        fetchJobs(source, kw, locations);
      }
    },
    [fetchJobs]
  );

  /** 清除全部数据 */
  const handleClearAll = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/jobs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        clearAll();
      }
    } finally {
      setClearing(false);
    }
  }, [setClearing, clearAll]);

  return { handleSearch, handleFilter, handleClearAll };
}
