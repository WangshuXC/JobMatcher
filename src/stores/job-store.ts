import { create } from "zustand";
import { JobPosting } from "@/types";

interface JobState {
  /** 全量职位数据 */
  jobs: JobPosting[];
  /** 经过筛选后的职位 */
  filteredJobs: JobPosting[];
  /** 搜索关键词 */
  keyword: string;
  /** 选中的数据源 */
  selectedSource: string | null;
  /** 选中的地点 */
  selectedLocation: string;
  /** 各数据源职位计数 */
  countBySource: Record<string, number>;
  /** 可选地点列表 */
  locations: string[];
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
  setSelectedSource: (source: string | null) => void;
  setSelectedLocation: (location: string) => void;
  setCountBySource: (counts: Record<string, number>) => void;
  setLocations: (locations: string[]) => void;
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
    locations: string[];
  }) => void;
}

export type JobStore = JobState & JobActions;

export const useJobStore = create<JobStore>((set) => ({
  // -- state --
  jobs: [],
  filteredJobs: [],
  keyword: "",
  selectedSource: null,
  selectedLocation: "__all__",
  countBySource: {},
  locations: [],
  initialLoading: true,
  clearing: false,
  selectedJob: null,
  refreshTrigger: 0,

  // -- actions --
  setJobs: (jobs) => set({ jobs }),
  setFilteredJobs: (jobs) => set({ filteredJobs: jobs }),
  setKeyword: (keyword) => set({ keyword }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setCountBySource: (counts) => set({ countBySource: counts }),
  setLocations: (locations) => set({ locations }),
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
      locations: [],
      selectedSource: null,
      selectedLocation: "__all__",
      keyword: "",
    }),

  setJobData: (data) =>
    set({
      jobs: data.jobs,
      filteredJobs: data.jobs,
      countBySource: data.countBySource,
      locations: data.locations,
    }),
}));
