import { create } from "zustand";
import { MatchResult, LLMMatchResult } from "@/types";

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
  /** LLM 精排结果 */
  llmResults: LLMMatchResult[] | null;
  /** 简历解析出的 profile */
  profile: ResumeProfile | null;
  /** 当前查看的匹配详情 */
  selectedMatch: MatchResult | null;
  /** 错误信息 */
  error: string;
  /** 匹配进度消息 */
  progressMessage: string;
  /** 匹配方法 */
  matchMethod: "embedding+llm" | "embedding+rule" | "rule-only" | "";
  /** 语义索引总数 */
  totalIndexed: number;
  /** 已分析的职位总数 */
  totalJobsAnalyzed: number;
}

interface MatchActions {
  setResumeText: (text: string) => void;
  setIsMatching: (matching: boolean) => void;
  setResults: (results: MatchResult[]) => void;
  setLLMResults: (results: LLMMatchResult[] | null) => void;
  setProfile: (profile: ResumeProfile | null) => void;
  setSelectedMatch: (match: MatchResult | null) => void;
  setError: (error: string) => void;
  setProgressMessage: (msg: string) => void;
  setMatchMethod: (method: MatchState["matchMethod"]) => void;
  setTotalIndexed: (n: number) => void;
  setTotalJobsAnalyzed: (n: number) => void;
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
  llmResults: null,
  profile: null,
  selectedMatch: null,
  error: "",
  progressMessage: "",
  matchMethod: "",
  totalIndexed: 0,
  totalJobsAnalyzed: 0,

  // -- actions --
  setResumeText: (text) => set({ resumeText: text }),
  setIsMatching: (matching) => set({ isMatching: matching }),
  setResults: (results) => set({ results }),
  setLLMResults: (results) => set({ llmResults: results }),
  setProfile: (profile) => set({ profile }),
  setSelectedMatch: (match) => set({ selectedMatch: match }),
  setError: (error) => set({ error }),
  setProgressMessage: (msg) => set({ progressMessage: msg }),
  setMatchMethod: (method) => set({ matchMethod: method }),
  setTotalIndexed: (n) => set({ totalIndexed: n }),
  setTotalJobsAnalyzed: (n) => set({ totalJobsAnalyzed: n }),

  resetMatchState: () =>
    set({
      results: [],
      llmResults: null,
      profile: null,
      error: "",
      progressMessage: "",
      matchMethod: "",
      totalIndexed: 0,
      totalJobsAnalyzed: 0,
    }),
}));
