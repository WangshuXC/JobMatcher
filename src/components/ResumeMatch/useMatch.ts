"use client";

import { useCallback } from "react";
import { useMatchStore } from "@/stores/match-store";

/**
 * ResumeMatch 业务逻辑 hook
 * - 发起匹配请求
 */
export function useMatch() {
  const {
    resumeText,
    setIsMatching,
    setResults,
    setProfile,
    setError,
    resetMatchState,
  } = useMatchStore();

  const handleMatch = useCallback(async () => {
    if (!resumeText.trim()) {
      setError("请输入简历内容");
      return;
    }

    setIsMatching(true);
    resetMatchState();

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, topN: 20 }),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(data.data.resume);
        setResults(data.data.matches);
      } else {
        setError(data.error || "匹配失败");
      }
    } catch (err) {
      console.error("匹配请求失败:", err);
      setError("请求失败，请重试");
    } finally {
      setIsMatching(false);
    }
  }, [resumeText, setIsMatching, setResults, setProfile, setError, resetMatchState]);

  return { handleMatch };
}
