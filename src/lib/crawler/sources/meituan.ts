/**
 * 美团招聘爬虫
 *
 * 列表页: https://zhaopin.meituan.com/web/social?jfJgList=11001_1100102,...
 * 详情页: https://zhaopin.meituan.com/web/position/detail?jobUnionId=xxx
 *
 * 美团招聘提供两个 JSON API（均需在页面上下文中调用，API 检查 Origin/Cookie）：
 *   1. 列表 API: POST /api/official/job/getJobList
 *      请求体: { page: { pageNo, pageSize }, jobShareType: "1", jfJgList, jobType, ... }
 *      返回: { data: { list: [...], page: { pageNo, pageSize, totalPage, totalCount } }, status: 1 }
 *      列表数据包含 jobDuty（职责描述）但 jobRequirement 为 null
 *
 *   2. 详情 API: POST /api/official/job/getJobDetail
 *      请求体: { jobUnionId: "xxx", jobShareType: "1" }
 *      返回完整数据，包含 jobRequirement（岗位要求）、precedence（加分项）等
 *
 * 分类体系:
 *   jfJgList 参数为两级结构: [{ code: "大类code", subCode: ["子分类code", ...] }]
 *   大类: 11001=技术类, 11002=产品类, 11008=商业分析类, ...
 *   子分类 code 格式为大类 code 去掉前缀 "1" + 子编号，如 1100101=测试, 1100102=运维
 *   API 中 jfJgList 的格式为 "大类code_子分类code"，如 "11001_1100102"
 *
 * 优化策略:
 *   - 列表阶段并行翻页获取所有职位列表
 *   - 详情阶段并行调用详情 API 获取完整数据（含 jobRequirement）
 *   - 全程纯 API 调用，不加载任何 HTML 页面（除初始 session 建立）
 *   - 使用 page.evaluate + fetch 方式调用 API（需要页面上下文）
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

/** 列表 API 每页条数（美团 API 支持 pageSize=100） */
const PAGE_SIZE = 100;

// === API 接口类型定义 ===

/** 城市/部门等通用节点 */
interface MeituanEnumNode {
  code: string | null;
  name: string;
  children: MeituanEnumNode[] | null;
  sort: string | null;
  subCode: string | null;
  mapping: string | null;
  outerCode: string | null;
  bgNode: boolean;
}

/** 列表 API 请求体 */
interface MeituanSearchBody {
  page: { pageNo: number; pageSize: number };
  jobShareType: string;
  keywords: string;
  cityList: string[];
  department: string[];
  jfJgList: { code: string; subCode: string[] }[];
  jobType: { code: string; subCode: string[] }[];
  typeCode: string[];
  specialCode: string[];
}

/** 列表 API 返回的单条职位数据 */
interface MeituanJobPost {
  jobUnionId: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  jobType: string;
  jobSpecialCode: string;
  jobSource: string;
  jobStatus: string;
  jobFamily: string;
  jobFamilyGroup: string;
  cityList: MeituanEnumNode[];
  workYear: string | null;
  department: MeituanEnumNode[];
  desc: string | null;
  departmentIntro: string | null;
  jobDuty: string;
  jobRequirement: string | null;
  precedence: string | null;
  highLight: string | null;
  otherInfo: string | null;
  firstPostTime: number | null;
  refreshTime: number | null;
  tag: string | null;
  expiredTime: number | null;
  socialRecommendJob: boolean | null;
}

/** 列表 API 分页信息 */
interface MeituanPageInfo {
  pageNo: number;
  pageSize: number;
  totalPage: number;
  totalCount: number;
}

/** 列表 API 完整响应 */
interface MeituanSearchResponse {
  data: {
    list: MeituanJobPost[];
    page: MeituanPageInfo;
    traceId: string | null;
  };
  status: number;
  message: string;
}

/** 详情 API 返回的职位数据（比列表 API 多 jobRequirement、precedence 等完整字段） */
interface MeituanJobDetail extends MeituanJobPost {
  jobRequirement: string | null;
  precedence: string | null;
  departmentIntro: string | null;
  workYear: string;
}

/** 详情 API 完整响应 */
interface MeituanDetailResponse {
  data: MeituanJobDetail;
  status: number;
  message: string;
}

/**
 * 美团招聘的分类 ID 体系:
 * URL 中 jfJgList 格式: "大类code_子分类code"，如 "11001_1100102"
 * API 请求中 jfJgList 格式: [{ code: "11001", subCode: ["1100102", ...] }]
 *
 * 本爬虫中子分类 ID 统一使用 "大类code_子分类code" 格式（与 URL 一致），
 * 在构建 API 请求时自动拆分。
 */

/** 技术类子分类 ID（默认筛选） */
const DEFAULT_TECH_SUBCODES = [
  "1100101", // 测试
  "1100102", // 运维
  "1100105", // 算法
  "1100106", // 硬件
  "1100109", // 软件
];

export class MeituanCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "meituan",
    name: "美团",
    company: "美团",
    logo: "https://s3plus.meituan.net/zhaopin-official-website-prod/imgs/favicon.ico",
    baseUrl: "https://zhaopin.meituan.com",
    enabled: true,
  };

  // --- 私有辅助方法 ---

  /**
   * 构建列表搜索请求体
   *
   * selectedCategoryIds 格式: ["11001_1100101", "11001_1100102", ...]
   * 需要按大类 code 分组后构建 jfJgList
   */
  private buildSearchBody(
    pageNo: number,
    pageSize: number,
    categoryIds: string[],
    keyword: string
  ): MeituanSearchBody {
    // 按大类分组子分类
    const groupMap = new Map<string, string[]>();
    for (const catId of categoryIds) {
      const parts = catId.split("_");
      if (parts.length === 2) {
        const [parentCode, subCode] = parts;
        if (!groupMap.has(parentCode)) {
          groupMap.set(parentCode, []);
        }
        groupMap.get(parentCode)!.push(subCode);
      }
    }

    const jfJgList = Array.from(groupMap.entries()).map(([code, subCode]) => ({
      code,
      subCode,
    }));

    return {
      page: { pageNo, pageSize },
      jobShareType: "1",
      keywords: keyword,
      cityList: [],
      department: [],
      jfJgList,
      jobType: [{ code: this.recruitType === "campus" ? "1" : "3", subCode: [] }],
      typeCode: [],
      specialCode: [],
    };
  }

  /**
   * 调用列表搜索 API
   *
   * 使用 page.evaluate + fetch 方式（需要页面上下文以携带 Cookie）
   */
  private async fetchSearchApi(
    page: Page,
    pageNo: number,
    pageSize: number,
    categoryIds: string[],
    keyword: string
  ): Promise<MeituanSearchResponse | null> {
    const body = this.buildSearchBody(pageNo, pageSize, categoryIds, keyword);
    const apiUrl = `${this.source.baseUrl}/api/official/job/getJobList`;

    console.log(
      `[${this.source.name}] 调用列表 API: pageNo=${pageNo}, pageSize=${pageSize}`
    );

    try {
      const response = await page.evaluate(
        async ({ url, reqBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
          });
          return res.json();
        },
        { url: apiUrl, reqBody: body }
      );

      if (response?.status === 1 && response?.data) {
        return response as MeituanSearchResponse;
      }
      console.log(
        `[${this.source.name}] API 返回异常:`,
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log(`[${this.source.name}] 列表 API 调用失败:`, err);
      return null;
    }
  }

  /**
   * 调用详情 API 获取完整职位数据（含 jobRequirement）
   */
  private async fetchDetailApi(
    page: Page,
    jobUnionId: string
  ): Promise<MeituanJobDetail | null> {
    const apiUrl = `${this.source.baseUrl}/api/official/job/getJobDetail`;

    try {
      const response = await page.evaluate(
        async ({ url, body }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          return res.json();
        },
        { url: apiUrl, body: { jobUnionId, jobShareType: "1" } }
      );

      if (response?.status === 1 && response?.data) {
        return response.data as MeituanJobDetail;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 解析列表 API 返回的单条职位数据
   */
  private parsePost(post: MeituanJobPost): Partial<JobPosting> {
    const cities = post.cityList
      ?.map((c: MeituanEnumNode) => c.name)
      .filter(Boolean)
      .join("、");
    const deptName = post.department
      ?.map((d: MeituanEnumNode) => d.name)
      .filter(Boolean)
      .join(", ");
    const category = [post.jobFamily, post.jobFamilyGroup, deptName]
      .filter(Boolean)
      .join(" | ");

    return {
      title: post.name,
      source: this.source.id,
      company: this.source.company,
      sourceId: post.jobUnionId,
      detailUrl: `${this.source.baseUrl}/web/position/detail?jobUnionId=${post.jobUnionId}`,
      location: cities || "未知",
      description: post.jobDuty || "暂无描述",
      category,
    };
  }

  /**
   * Partial → 完整 JobPosting
   */
  private partialToFull(partial: Partial<JobPosting>): JobPosting {
    return {
      id: partial.id || `${this.source.id}_${partial.sourceId}`,
      title: partial.title || "未知职位",
      company: partial.company || this.source.company,
      source: this.source.id,
      location: partial.location || "未知",
      sourceId: partial.sourceId || "",
      description: partial.description || "暂无描述",
      requirements: partial.requirements || "暂无要求",
      detailUrl: partial.detailUrl || "",
      crawledAt: partial.crawledAt || new Date().toISOString(),
      category: partial.category,
      recruitType: this.recruitType,
    };
  }

  /**
   * 抓取职位列表 + 详情（核心方法）
   *
   * 策略:
   * 1. 先获取第 1 页得到 totalCount，计算总页数后并行请求所有剩余列表页
   * 2. 对收集到的职位列表，并行调用详情 API 获取 jobRequirement
   * 3. 在各阶段增量推送完整 JobPosting，返回空数组跳过 base.ts 的 crawlDetailsInParallel
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
    keyword?: string
  ): Promise<Partial<JobPosting>[]> {
    // 构建分类参数
    const categoryIds =
      selectedCategoryIds && selectedCategoryIds.length > 0
        ? selectedCategoryIds
        : DEFAULT_TECH_SUBCODES.map((sc) => `11001_${sc}`);

    let searchKeyword: string;
    if (keyword !== undefined) {
      searchKeyword = keyword;
    } else if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      searchKeyword = "";
    } else {
      searchKeyword = "";
    }

    // ========== 阶段 1：并行抓取列表页 ==========

    // 先访问首页建立 cookie/session
    const initPage = await this.newPage();
    await this.safeGoto(initPage, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    // 第 1 页：获取 totalCount
    const firstData = await this.fetchSearchApi(
      initPage,
      1,
      PAGE_SIZE,
      categoryIds,
      searchKeyword
    );

    if (
      !firstData ||
      !firstData.data.list ||
      firstData.data.list.length === 0
    ) {
      console.log(`[${this.source.name}] 第 1 页无数据，终止`);
      await initPage.close();
      return [];
    }

    const totalCount = firstData.data.page.totalCount;
    const totalPages = firstData.data.page.totalPage;
    const targetCount = Math.min(totalCount, maxJobs);
    const targetPages = Math.min(
      totalPages,
      Math.ceil(maxJobs / PAGE_SIZE)
    );
    console.log(
      `[${this.source.name}] 共 ${totalCount} 个职位，${totalPages} 页（目标 ${maxJobs === Infinity ? "全部" : maxJobs} 个）`
    );

    // 解析第 1 页的数据
    const listJobs: Partial<JobPosting>[] = [];
    for (const post of firstData.data.list) {
      if (listJobs.length >= maxJobs) break;
      listJobs.push(this.parsePost(post));
    }

    if (this.onProgress) {
      this.onProgress(
        listJobs.length,
        targetCount,
        `已抓取 ${listJobs.length}/${targetCount} 个职位`
      );
    }

    // 并行请求剩余列表页
    if (listJobs.length < maxJobs && targetPages > 1) {
      const LIST_CONCURRENCY = 5;
      const remainingPages = Array.from(
        { length: targetPages - 1 },
        (_, i) => i + 2
      );

      for (
        let i = 0;
        i < remainingPages.length && listJobs.length < maxJobs;
        i += LIST_CONCURRENCY
      ) {
        const batch = remainingPages.slice(i, i + LIST_CONCURRENCY);
        const batchNum = Math.floor(i / LIST_CONCURRENCY) + 1;
        const totalBatches = Math.ceil(remainingPages.length / LIST_CONCURRENCY);
        console.log(
          `[${this.source.name}] 并行抓取列表 批次 ${batchNum}/${totalBatches}（页 ${batch[0]}~${batch[batch.length - 1]}）`
        );

        const promises = batch.map(async (pageNum) => {
          try {
            return await this.fetchSearchApi(
              initPage,
              pageNum,
              PAGE_SIZE,
              categoryIds,
              searchKeyword
            );
          } catch (err) {
            console.error(
              `[${this.source.name}] 第 ${pageNum} 页请求失败:`,
              err
            );
            return null;
          }
        });

        const results = await Promise.all(promises);

        for (const data of results) {
          if (!data?.data?.list) continue;
          for (const post of data.data.list) {
            if (listJobs.length >= maxJobs) break;
            listJobs.push(this.parsePost(post));
          }
        }

        if (this.onProgress) {
          this.onProgress(
            listJobs.length,
            targetCount,
            `已抓取 ${listJobs.length}/${targetCount} 个职位`
          );
        }

        // 批次间短延迟
        if (
          i + LIST_CONCURRENCY < remainingPages.length &&
          listJobs.length < maxJobs
        ) {
          await this.randomDelay(300, 800);
        }
      }
    }

    await initPage.close();

    const targetJobs = listJobs.slice(0, maxJobs);

    // ========== 阶段 2：并行调用详情 API 获取 jobRequirement ==========
    console.log(
      `[${this.source.name}] 开始并行获取 ${targetJobs.length} 个职位的详情（纯 API）...`
    );

    const DETAIL_CONCURRENCY = 20;
    const completedJobs: Partial<JobPosting>[] = [];

    for (let i = 0; i < targetJobs.length; i += DETAIL_CONCURRENCY) {
      const batch = targetJobs.slice(i, i + DETAIL_CONCURRENCY);

      const detailPromises = batch.map(async (job) => {
        const page = await this.newPage();
        try {
          // 需要先访问目标域名建立页面上下文
          await this.safeGoto(page, this.source.baseUrl);

          const jobId = job.sourceId || "";
          const detail = await this.fetchDetailApi(page, jobId);

          if (detail) {
            const requirement = [
              detail.jobRequirement,
              detail.precedence
                ? `\n【加分项】\n${detail.precedence}`
                : null,
            ]
              .filter(Boolean)
              .join("");

            return {
              ...job,
              id: `${this.source.id}_${jobId}`,
              title: detail.name || job.title,
              description:
                detail.jobDuty || job.description,
              requirements: requirement || "暂无要求",
              crawledAt: new Date().toISOString(),
            } as Partial<JobPosting>;
          }

          // API 失败时使用列表数据
          return {
            ...job,
            id: `${this.source.id}_${job.sourceId}`,
            requirements: "暂无要求",
            crawledAt: new Date().toISOString(),
          } as Partial<JobPosting>;
        } finally {
          await page.close();
        }
      });

      const batchResults = await Promise.all(detailPromises);
      completedJobs.push(...batchResults);

      // 增量推送
      if (batchResults.length > 0 && this.onJobsBatch) {
        this.onJobsBatch(batchResults.map((j) => this.partialToFull(j)));
      }

      if (this.onProgress) {
        this.onProgress(
          completedJobs.length,
          targetJobs.length,
          `已抓取 ${completedJobs.length}/${targetJobs.length} 个职位`
        );
      }

      // 详情 API 批次间短延迟
      if (i + DETAIL_CONCURRENCY < targetJobs.length) {
        await this.randomDelay(200, 500);
      }
    }

    console.log(
      `[${this.source.name}] 列表+详情全部完成，共 ${completedJobs.length} 个职位`
    );

    // 返回空数组：所有数据已通过 onJobsBatch 增量推送完成
    return [];
  }

  /**
   * 抓取单个职位详情（基类接口实现）
   *
   * 由于 crawlJobList 已通过详情 API 获取完整数据并返回 []，
   * 此方法不会被调用，但仍需实现。
   */
  protected async crawlJobDetail(
    _page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    return this.partialToFull(partialJob);
  }
}
