"use client";

import { useEffect, useCallback, useRef } from "react";
import { useJobStore } from "@/stores/job-store";

/**
 * JobList 业务逻辑 hook
 * - 初始加载 & refreshTrigger 变化时拉取数据
 * - 搜索 / 筛选
 * - 清除全部数据
 */
export function useJobs() {
  const {
    selectedSource,
    keyword,
    selectedLocations,
    refreshTrigger,
    setInitialLoading,
    setJobData,
    setClearing,
    clearAll,
  } = useJobStore();

  // 用 ref 保存当前筛选条件，以便 refreshTrigger 触发时能读取最新值
  const filtersRef = useRef({ source: selectedSource, keyword, locations: selectedLocations });
  useEffect(() => {
    filtersRef.current = { source: selectedSource, keyword, locations: selectedLocations };
  }, [selectedSource, keyword, selectedLocations]);

  /** 通用请求函数 */
  const fetchJobs = useCallback(
    async (source: string | null, kw: string, locations: string[]) => {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (kw) params.set("keyword", kw);
      if (locations.length > 0) params.set("location", locations.join(","));

      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setJobData({
          jobs: data.data.jobs,
          countBySource: data.data.countBySource,
          locationGroups: data.data.locationGroups || [],
        });
      }
    },
    [setJobData]
  );

  // 组件挂载和 refreshTrigger 变化时拉取数据
  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setInitialLoading(true);
      const { source, keyword: kw, locations } = filtersRef.current;
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (kw) params.set("keyword", kw);
      if (locations.length > 0) params.set("location", locations.join(","));

      try {
        const response = await fetch(`/api/jobs?${params.toString()}`);
        const data = await response.json();
        if (!cancelled && data.success) {
          setJobData({
            jobs: data.data.jobs,
            countBySource: data.data.countBySource,
            locationGroups: data.data.locationGroups || [],
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
  }, [refreshTrigger, setInitialLoading, setJobData]);

  /** 搜索 */
  const handleSearch = useCallback(() => {
    const { source, keyword: kw, locations } = filtersRef.current;
    fetchJobs(source, kw, locations);
  }, [fetchJobs]);

  /** 按数据源/地点筛选 */
  const handleFilter = useCallback(
    (source: string | null, locations: string[]) => {
      fetchJobs(source, filtersRef.current.keyword, locations);
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
