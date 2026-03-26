import { create } from "zustand";
import { CrawlerSource, CategoryConfig } from "@/types";
import { getDefaultCategoryConfig } from "@/lib/crawler/categories";

interface CrawlResultData {
  source: string;
  status: string;
  jobCount: number;
  message: string;
  duration?: number;
}

/** 单个数据源的实时进度 */
export interface SourceProgress {
  /** 数据源 ID */
  sourceId: string;
  /** 状态 */
  status: "pending" | "running" | "completed" | "error";
  /** 当前已处理数 */
  current: number;
  /** 总数（0 = 未知） */
  total: number;
  /** 进度描述 */
  message: string;
  /** 已入库职位数 */
  jobCount: number;
  /** 耗时（ms，完成后才有） */
  duration?: number;
}

/** 每个数据源的关键词配置 */
export type KeywordConfig = Record<string, string>;

interface CrawlerState {
  /** 可用数据源列表 */
  sources: CrawlerSource[];
  /** 已选中的数据源 ID */
  selectedSources: string[];
  /** 爬虫是否正在运行 */
  isRunning: boolean;
  /** 爬取结果列表 */
  results: CrawlResultData[];
  /** 期望抓取的岗位数量（0 = 全部） */
  maxJobs: number;
  /** 进度提示文本 */
  progressMsg: string;
  /** 已入库的职位计数 */
  crawledCount: number;
  /** 每个数据源选中的分类 ID（key: sourceId, value: 选中的大类 ID 列表） */
  categoryConfig: CategoryConfig;
  /** 每个数据源的搜索关键词（key: sourceId, value: keyword） */
  keywordConfig: KeywordConfig;
  /** 各数据源的实时进度（key: sourceId） */
  sourceProgress: Record<string, SourceProgress>;
}

interface CrawlerActions {
  setSources: (sources: CrawlerSource[]) => void;
  toggleSource: (id: string) => void;
  setSelectedSources: (ids: string[]) => void;
  setIsRunning: (running: boolean) => void;
  addResult: (result: CrawlResultData) => void;
  clearResults: () => void;
  setMaxJobs: (n: number) => void;
  setProgressMsg: (msg: string) => void;
  setCrawledCount: (count: number) => void;
  /** 重置一次爬取的临时状态 */
  resetCrawlState: () => void;
  /** 设置某个数据源的分类选择 */
  setCategoryConfig: (sourceId: string, categoryIds: string[]) => void;
  /** 批量设置分类配置 */
  setCategoryConfigAll: (config: CategoryConfig) => void;
  /** 设置某个数据源的搜索关键词 */
  setKeywordConfig: (sourceId: string, keyword: string) => void;
  /** 更新单个数据源的进度 */
  updateSourceProgress: (sourceId: string, update: Partial<SourceProgress>) => void;
  /** 初始化所有选中源的进度为 pending */
  initSourceProgress: (sourceIds: string[]) => void;
}

export type CrawlerStore = CrawlerState & CrawlerActions;

export type { CrawlResultData };

export const useCrawlerStore = create<CrawlerStore>((set) => ({
  // -- state --
  sources: [],
  selectedSources: [],
  isRunning: false,
  results: [],
  maxJobs: 0,
  progressMsg: "",
  crawledCount: 0,
  categoryConfig: getDefaultCategoryConfig(),
  keywordConfig: {},
  sourceProgress: {},

  // -- actions --
  setSources: (sources) => set({ sources }),

  toggleSource: (id) =>
    set((s) => ({
      selectedSources: s.selectedSources.includes(id)
        ? s.selectedSources.filter((sid) => sid !== id)
        : [...s.selectedSources, id],
    })),

  setSelectedSources: (ids) => set({ selectedSources: ids }),
  setIsRunning: (running) => set({ isRunning: running }),

  addResult: (result) =>
    set((s) => ({ results: [...s.results, result] })),

  clearResults: () => set({ results: [] }),
  setMaxJobs: (n) => set({ maxJobs: n }),
  setProgressMsg: (msg) => set({ progressMsg: msg }),
  setCrawledCount: (count) => set({ crawledCount: count }),

  setCategoryConfig: (sourceId, categoryIds) =>
    set((s) => ({
      categoryConfig: { ...s.categoryConfig, [sourceId]: categoryIds },
    })),

  setCategoryConfigAll: (config) => set({ categoryConfig: config }),

  setKeywordConfig: (sourceId, keyword) =>
    set((s) => ({
      keywordConfig: { ...s.keywordConfig, [sourceId]: keyword },
    })),

  updateSourceProgress: (sourceId, update) =>
    set((s) => ({
      sourceProgress: {
        ...s.sourceProgress,
        [sourceId]: {
          ...s.sourceProgress[sourceId],
          ...update,
        },
      },
    })),

  initSourceProgress: (sourceIds) =>
    set({
      sourceProgress: Object.fromEntries(
        sourceIds.map((id) => [
          id,
          { sourceId: id, status: "pending" as const, current: 0, total: 0, message: "等待中...", jobCount: 0 },
        ])
      ),
    }),

  resetCrawlState: () =>
    set({ results: [], progressMsg: "", crawledCount: 0, sourceProgress: {} }),
}));
