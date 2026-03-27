// ==================== 招聘类型 ====================

/** 招聘类型：社招 | 校招 */
export type RecruitType = "social" | "campus";

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
  /** 招聘类型：社招 | 校招 */
  recruitType: RecruitType;
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

// ==================== 分类配置相关类型 ====================

/** 子分类 */
export interface SubCategory {
  /** 子分类 ID（各平台的原始 ID） */
  id: string;
  /** 子分类名称 */
  name: string;
}

/** 数据源的岗位分类（大类） */
export interface JobCategory {
  /** 大类 ID（各平台的原始 ID） */
  id: string;
  /** 大类名称 */
  name: string;
  /** 子分类列表（带 ID 和名称） */
  subCategories: SubCategory[];
}

/**
 * 每个数据源的分类配置
 * key: sourceId (bytedance / tencent / alibaba)
 * value: 选中的**子分类 ID** 列表（精确到子分类粒度）
 */
export type CategoryConfig = Record<string, string[]>;

// ==================== API 相关类型 ====================

/** 爬虫请求参数 */
export interface CrawlRequest {
  sources: string[];
  keywords?: string;
  /** 期望抓取的岗位数量 */
  maxJobs?: number;
  /** 每个数据源选中的分类 ID */
  categoryConfig?: CategoryConfig;
  /** 招聘类型：社招 | 校招 */
  recruitType?: RecruitType;
}

/** 匹配请求参数 */
export interface MatchRequest {
  resumeText: string;
  topN?: number;
  /** 是否使用 LLM 精排（需配置 API Key） */
  useLLM?: boolean;
}

/** API 通用响应 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== AI / LLM 配置相关类型 ====================

/** 支持的 LLM Provider */
export type LLMProvider = "openai" | "deepseek" | "zhipu" | "qwen" | "tencent-coding" | "custom";

/** LLM 配置信息 */
export interface LLMConfig {
  /** 选中的 Provider */
  provider: LLMProvider;
  /** API Key */
  apiKey: string;
  /** 模型名称（可选，各 Provider 有默认值） */
  model?: string;
  /** 自定义 Base URL（可选） */
  baseURL?: string;
}

/** AI 设置（持久化到文件） */
export interface AISettings {
  /** LLM 配置 */
  llm?: LLMConfig;
}

/** Provider 默认配置 */
export interface ProviderDefaults {
  id: LLMProvider;
  name: string;
  defaultModel: string;
  defaultBaseURL?: string;
  placeholder: string;
}

/** LLM 精排后的匹配结果 */
export interface LLMMatchResult {
  /** 职位原始 ID（用于关联） */
  jobId: string;
  /** LLM 综合评分 0-100 */
  score: number;
  /** LLM 生成的匹配理由 */
  reason: string;
  /** 亮点分析 */
  highlights: string[];
  /** 风险/不足 */
  risks: string[];
}

/** 智能匹配 SSE 事件类型 */
export type SmartMatchEventType = "embedding_start" | "embedding_done" | "llm_start" | "llm_progress" | "llm_done" | "error";

/** 智能匹配 SSE 事件 */
export interface SmartMatchEvent {
  type: SmartMatchEventType;
  data: unknown;
}
