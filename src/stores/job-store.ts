import { create } from "zustand";
import { JobPosting } from "@/types";

/** 地点分组结构（与 API 返回一致） */
export interface LocationGroup {
  label: string;
  locations: { name: string; count: number }[];
}

interface JobState {
  /** 全量职位数据 */
  jobs: JobPosting[];
  /** 经过筛选后的职位 */
  filteredJobs: JobPosting[];
  /** 搜索关键词 */
  keyword: string;
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
  }) => void;
}

export type JobStore = JobState & JobActions;

export const useJobStore = create<JobStore>((set) => ({
  // -- state --
  jobs: [],
  filteredJobs: [],
  keyword: "",
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
    }),

  setJobData: (data) =>
    set({
      jobs: data.jobs,
      filteredJobs: data.jobs,
      countBySource: data.countBySource,
      locationGroups: data.locationGroups,
    }),
}));
