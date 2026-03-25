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

  resetCrawlState: () =>
    set({ results: [], progressMsg: "", crawledCount: 0 }),
}));
