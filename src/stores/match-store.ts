import { create } from "zustand";
import { MatchResult } from "@/types";

interface ResumeProfile {
  skills: string[];
  experienceYears: number;
  education: string;
  expectedRole: string[];
  preferredLocations: string[];
}

interface MatchState {
  /** 简历原始文本 */
  resumeText: string;
  /** 是否正在匹配 */
  isMatching: boolean;
  /** 匹配结果列表 */
  results: MatchResult[];
  /** 简历解析出的 profile */
  profile: ResumeProfile | null;
  /** 当前查看的匹配详情 */
  selectedMatch: MatchResult | null;
  /** 错误信息 */
  error: string;
}

interface MatchActions {
  setResumeText: (text: string) => void;
  setIsMatching: (matching: boolean) => void;
  setResults: (results: MatchResult[]) => void;
  setProfile: (profile: ResumeProfile | null) => void;
  setSelectedMatch: (match: MatchResult | null) => void;
  setError: (error: string) => void;
  /** 开始匹配前重置 */
  resetMatchState: () => void;
}

export type MatchStore = MatchState & MatchActions;

export type { ResumeProfile };

export const useMatchStore = create<MatchStore>((set) => ({
  // -- state --
  resumeText: "",
  isMatching: false,
  results: [],
  profile: null,
  selectedMatch: null,
  error: "",

  // -- actions --
  setResumeText: (text) => set({ resumeText: text }),
  setIsMatching: (matching) => set({ isMatching: matching }),
  setResults: (results) => set({ results }),
  setProfile: (profile) => set({ profile }),
  setSelectedMatch: (match) => set({ selectedMatch: match }),
  setError: (error) => set({ error }),

  resetMatchState: () =>
    set({ results: [], profile: null, error: "" }),
}));
