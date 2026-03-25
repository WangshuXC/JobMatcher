import { create } from "zustand";
import { CrawlerSource } from "@/types";

interface CrawlResultData {
  source: string;
  status: string;
  jobCount: number;
  message: string;
  duration?: number;
}

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

  resetCrawlState: () =>
    set({ results: [], progressMsg: "", crawledCount: 0 }),
}));
