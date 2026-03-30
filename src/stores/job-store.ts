import { create } from "zustand";
import type { JobPosting, SearchMode, SortBy, SearchQuery, LocationGroup } from "@/types";

interface JobState {
  /** 全量职位数据 */
  jobs: JobPosting[];
  /** 经过筛选后的职位 */
  filteredJobs: JobPosting[];
  /** 搜索关键词（输入框原始值） */
  keyword: string;
  /** 解析后的搜索查询结构 */
  parsedKeywords: SearchQuery | null;
  /** 搜索模式 */
  searchMode: SearchMode;
  /** 排序方式 */
  sortBy: SortBy;
  /** 语义搜索分数 Map（key 为职位 dedup key） */
  semanticScores: Record<string, number>;
  /** 语义搜索正在加载 */
  searchLoading: boolean;
  /** 选中的数据源 */
  selectedSource: string | null;
  /** 选中的地点列表（多选） */
  selectedLocations: string[];
  /** 各数据源职位计数 */
  countBySource: Record<string, number>;
  /** 分组的地点列表 */
  locationGroups: LocationGroup[];
  /** 是否正在初始加载 */
  initialLoading: boolean;
  /** 是否正在清除数据 */
  clearing: boolean;
  /** 当前查看的职位详情 */
  selectedJob: JobPosting | null;
  /** 刷新触发器（递增计数） */
  refreshTrigger: number;
}

interface JobActions {
  setJobs: (jobs: JobPosting[]) => void;
  setFilteredJobs: (jobs: JobPosting[]) => void;
  setKeyword: (keyword: string) => void;
  setParsedKeywords: (parsed: SearchQuery | null) => void;
  setSearchMode: (mode: SearchMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSemanticScores: (scores: Record<string, number>) => void;
  setSearchLoading: (loading: boolean) => void;
  setSelectedSource: (source: string | null) => void;
  setSelectedLocations: (locations: string[]) => void;
  setCountBySource: (counts: Record<string, number>) => void;
  setLocationGroups: (groups: LocationGroup[]) => void;
  setInitialLoading: (loading: boolean) => void;
  setClearing: (clearing: boolean) => void;
  setSelectedJob: (job: JobPosting | null) => void;
  /** 触发 JobList 刷新 */
  triggerRefresh: () => void;
  /** 清除所有职位数据和筛选条件 */
  clearAll: () => void;
  /** 一次性设置从 API 返回的数据 */
  setJobData: (data: {
    jobs: JobPosting[];
    countBySource: Record<string, number>;
    locationGroups: LocationGroup[];
    semanticScores?: Record<string, number>;
  }) => void;
}

export type JobStoreType = JobState & JobActions;

export const useJobStore = create<JobStoreType>((set) => ({
  // -- state --
  jobs: [],
  filteredJobs: [],
  keyword: "",
  parsedKeywords: null,
  searchMode: "keyword",
  sortBy: "relevance",
  semanticScores: {},
  searchLoading: false,
  selectedSource: null,
  selectedLocations: [],
  countBySource: {},
  locationGroups: [],
  initialLoading: true,
  clearing: false,
  selectedJob: null,
  refreshTrigger: 0,

  // -- actions --
  setJobs: (jobs) => set({ jobs }),
  setFilteredJobs: (jobs) => set({ filteredJobs: jobs }),
  setKeyword: (keyword) => set({ keyword }),
  setParsedKeywords: (parsed) => set({ parsedKeywords: parsed }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSemanticScores: (scores) => set({ semanticScores: scores }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setSelectedLocations: (locations) => set({ selectedLocations: locations }),
  setCountBySource: (counts) => set({ countBySource: counts }),
  setLocationGroups: (groups) => set({ locationGroups: groups }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setClearing: (clearing) => set({ clearing: clearing }),
  setSelectedJob: (job) => set({ selectedJob: job }),

  triggerRefresh: () =>
    set((s) => ({ refreshTrigger: s.refreshTrigger + 1 })),

  clearAll: () =>
    set({
      jobs: [],
      filteredJobs: [],
      countBySource: {},
      locationGroups: [],
      selectedSource: null,
      selectedLocations: [],
      keyword: "",
      parsedKeywords: null,
      semanticScores: {},
      searchLoading: false,
    }),

  setJobData: (data) =>
    set({
      jobs: data.jobs,
      filteredJobs: data.jobs,
      countBySource: data.countBySource,
      locationGroups: data.locationGroups,
      semanticScores: data.semanticScores || {},
    }),
}));
