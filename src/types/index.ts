// ==================== 职位相关类型 ====================

/** 职位信息 */
export interface JobPosting {
  /** 唯一标识 */
  id: string;
  /** 职位名称 */
  title: string;
  /** 公司名称 */
  company: string;
  /** 数据源标识 (如 bytedance, tencent, alibaba) */
  source: string;
  /** 工作地点 */
  location: string;
  /** 原始职位ID (来源平台的ID) */
  sourceId: string;
  /** 职位描述 */
  description: string;
  /** 职位要求 */
  requirements: string;
  /** 职位详情页URL */
  detailUrl: string;
  /** 抓取时间 */
  crawledAt: string;
  /** 职位类别 */
  category?: string;
  /** 薪资范围 */
  salary?: string;
}

/** 爬虫数据源配置 */
export interface CrawlerSource {
  /** 数据源唯一标识 */
  id: string;
  /** 数据源名称 */
  name: string;
  /** 公司名称 */
  company: string;
  /** Logo URL */
  logo?: string;
  /** 基础URL */
  baseUrl: string;
  /** 是否启用 */
  enabled: boolean;
  /** 描述信息 */
  description: string;
}

/** 爬虫执行状态 */
export type CrawlerStatus = "idle" | "running" | "completed" | "error";

/** 爬虫执行结果 */
export interface CrawlResult {
  source: string;
  status: CrawlerStatus;
  jobCount: number;
  message: string;
  duration?: number;
  jobs: JobPosting[];
}

/** 爬虫进度事件 */
export interface CrawlProgress {
  source: string;
  status: CrawlerStatus;
  current: number;
  total: number;
  message: string;
}

// ==================== 简历匹配相关类型 ====================

/** 简历信息 */
export interface ResumeData {
  /** 原始文本 */
  rawText: string;
  /** 解析后的技能标签 */
  skills: string[];
  /** 工作经验年限 */
  experienceYears: number;
  /** 教育背景 */
  education: string;
  /** 期望职位关键词 */
  expectedRole: string[];
  /** 期望工作地点 */
  preferredLocations: string[];
}

/** 匹配结果 */
export interface MatchResult {
  job: JobPosting;
  /** 总匹配分数 0-100 */
  score: number;
  /** 各维度得分 */
  breakdown: MatchBreakdown;
  /** 匹配理由 */
  reasons: string[];
}

/** 匹配分数明细 */
export interface MatchBreakdown {
  /** 技能匹配度 0-100 */
  skillMatch: number;
  /** 地点匹配度 0-100 */
  locationMatch: number;
  /** 经验匹配度 0-100 */
  experienceMatch: number;
  /** 职位相关度 0-100 */
  roleRelevance: number;
}

// ==================== API 相关类型 ====================

/** 爬虫请求参数 */
export interface CrawlRequest {
  sources: string[];
  keywords?: string;
  /** 期望抓取的岗位数量 */
  maxJobs?: number;
}

/** 匹配请求参数 */
export interface MatchRequest {
  resumeText: string;
  topN?: number;
}

/** API 通用响应 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
