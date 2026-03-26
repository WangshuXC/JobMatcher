/**
 * 腾讯招聘爬虫
 *
 * 列表页: https://careers.tencent.com/search.html?query=at_1,ot_40001001,...&keyword=前端
 * 详情页: https://careers.tencent.com/jobdesc.html?postId=xxx
 *
 * 腾讯招聘提供两个 JSON API：
 *   1. 列表 API: GET /tencentcareer/api/post/Query?categoryId=...&pageSize=100&...
 *      返回结构化数据（标题、地点、事业群、职责描述等），但缺少「岗位要求」字段
 *   2. 详情 API: GET /tencentcareer/api/post/ByPostId?postId=xxx
 *      返回完整数据，包含 Responsibility（职责）和 Requirement（要求）
 *
 * 优化策略：
 *   - 在 crawlJobList 阶段就并行调用详情 API 获取完整数据（含 Requirement）
 *   - crawlJobDetail 直接返回已有数据，不需要任何网络请求
 *   - 全程纯 API 调用，不加载任何 HTML 页面（除初始 session 建立）
 *   - 相比旧的 DOM 解析方式（每个详情页 3-5 秒），提速 30-50 倍
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

/** 列表 API 每页条数（腾讯 API 支持较大 pageSize） */
const PAGE_SIZE = 100;

/** 腾讯列表 API 返回的职位数据结构 */
interface TencentApiPost {
  PostId: string;
  RecruitPostId: number;
  RecruitPostName: string;
  CountryName: string;
  LocationName: string;
  BGName: string;
  ComName: string;
  ProductName: string;
  CategoryName: string;
  Responsibility: string;
  LastUpdateTime: string;
  PostURL: string;
  SourceID: number;
  RequireWorkYearsName: string;
}

interface TencentApiResponse {
  Code: number;
  Data: {
    Count: number;
    Posts: TencentApiPost[];
  };
}

/** 腾讯详情 API 返回的职位数据结构（比列表 API 多 Requirement 字段） */
interface TencentDetailPost {
  PostId: string;
  RecruitPostId: number;
  RecruitPostName: string;
  CountryName: string;
  LocationName: string;
  BGName: string;
  ComName: string;
  ProductName: string;
  CategoryName: string;
  Responsibility: string;
  Requirement: string;
  LastUpdateTime: string;
  PostURL: string;
  SourceID: number;
  RequireWorkYearsName: string;
}

/** 前端相关分类 ID (技术类子分类) */
const CATEGORY_IDS = [
  "40001001", // 技术研发类
  "40001002", // 质量管理类
  "40001003", // 技术运营类
  "40001004", // 安全技术类
  "40001005", // AI、算法与大数据
  "40001006", // 企管类
];

/*
 * 腾讯招聘完整分类参考:
 *
 * 大类 parentCategoryId:
 *   40001 - 技术        (子分类: 40001001~40001006, 见上方)
 *   40002 - 设计        (子分类: 40002001 设计类, 40002002 游戏美术类)
 *   40003 - 产品        (子分类: 40003001 产品类)
 *   40004 - 营销与公关
 *   40005 - 销售、服务与支持
 *   40006 - 内容
 *   40007 - 财务
 *   40008 - 人力资源
 *   40009 - 法律与公共策略
 *   40010 - 行政支持
 *   40011 - 战略与投资
 */

export class TencentCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "tencent",
    name: "腾讯",
    company: "腾讯",
    logo: "https://careers.tencent.com/favicon.ico",
    baseUrl: "https://careers.tencent.com",
    enabled: true,
    description: "腾讯社会招聘 - 涵盖微信、QQ、云计算等业务线",
  };

  /**
   * 构建 API 查询 URL
   * attrId=1 表示社会招聘，attrId=2 表示校园招聘
   */
  private buildApiUrl(
    pageIndex: number,
    keyword: string = "前端",
    categoryIds: string[] = CATEGORY_IDS
  ): string {
    const timestamp = Date.now();
    const encodedKeyword = encodeURIComponent(keyword);
    const attrId = this.recruitType === "campus" ? 2 : 1;
    return `${this.source.baseUrl}/tencentcareer/api/post/Query?timestamp=${timestamp}&countryId=&cityId=&bgIds=&productId=&categoryId=${categoryIds.join(",")}&parentCategoryId=&attrId=${attrId}&keyword=${encodedKeyword}&pageIndex=${pageIndex}&pageSize=${PAGE_SIZE}&language=zh-cn&area=cn`;
  }

  /**
   * 构建详情页 URL
   */
  private buildDetailUrl(postId: string): string {
    return `${this.source.baseUrl}/jobdesc.html?postId=${postId}`;
  }

  /**
   * 通过 API 获取职位列表数据
   */
  private async fetchApiData(
    page: Page,
    pageIndex: number,
    keyword: string = "前端",
    categoryIds: string[] = CATEGORY_IDS
  ): Promise<TencentApiResponse | null> {
    const apiUrl = this.buildApiUrl(pageIndex, keyword, categoryIds);
    console.log(`[腾讯] 调用 API 第 ${pageIndex} 页: ${apiUrl}`);

    try {
      const response = await page.evaluate(async (url: string) => {
        const res = await fetch(url);
        return res.json();
      }, apiUrl);

      if (response?.Code === 200 && response?.Data) {
        return response as TencentApiResponse;
      }
      console.log("[腾讯] API 返回异常:", JSON.stringify(response).substring(0, 200));
      return null;
    } catch (err) {
      console.log("[腾讯] API 调用失败:", err);
      return null;
    }
  }

  /**
   * 通过 API 并行抓取职位列表 + 详情
   *
   * 策略：
   * 1. 先获取第 1 页得到 totalCount，计算总页数后并行请求所有剩余列表页
   * 2. 对收集到的职位列表，并行调用详情 API 获取 Requirement
   * 3. 在列表阶段就产出完整的 JobPosting，crawlJobDetail 直接返回
   *
   * 这样绕过了 base.ts 中 crawlDetailsInParallel 的每批 1-2s 延迟和逐个创建 page 的开销。
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
    keyword?: string
  ): Promise<Partial<JobPosting>[]> {
    const categoryIds =
      selectedCategoryIds && selectedCategoryIds.length > 0
        ? selectedCategoryIds
        : CATEGORY_IDS;
    let searchKeyword: string;
    if (keyword !== undefined) {
      searchKeyword = keyword;
    } else if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      searchKeyword = "";
    } else {
      searchKeyword = "前端";
    }

    const maxPages = Math.ceil(maxJobs / PAGE_SIZE);

    // ========== 阶段 1：并行抓取列表页 ==========

    // 先访问首页建立 cookie/session
    const initPage = await this.newPage();
    await this.safeGoto(initPage, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    // 第 1 页：获取 totalCount
    const firstData = await this.fetchApiData(initPage, 1, searchKeyword, categoryIds);
    await initPage.close();

    if (!firstData || !firstData.Data.Posts || firstData.Data.Posts.length === 0) {
      console.log("[腾讯] 第 1 页无数据，终止");
      return [];
    }

    const totalCount = firstData.Data.Count;
    const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE), maxPages);
    console.log(`[腾讯] 共 ${totalCount} 个职位，${totalPages} 页（目标 ${maxJobs} 个）`);

    // 解析第 1 页的数据
    const listJobs: Partial<JobPosting>[] = [];
    for (const post of firstData.Data.Posts) {
      if (listJobs.length >= maxJobs) break;
      listJobs.push(this.parsePost(post));
    }

    if (this.onProgress) {
      this.onProgress(listJobs.length, Math.min(totalCount, maxJobs), `已抓取 ${listJobs.length}/${Math.min(totalCount, maxJobs)} 个职位`);
    }

    // 并行请求剩余列表页
    if (listJobs.length < maxJobs && totalPages > 1) {
      const LIST_CONCURRENCY = 5;
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

      for (let i = 0; i < remainingPages.length && listJobs.length < maxJobs; i += LIST_CONCURRENCY) {
        const batch = remainingPages.slice(i, i + LIST_CONCURRENCY);
        const batchNum = Math.floor(i / LIST_CONCURRENCY) + 1;
        const totalBatches = Math.ceil(remainingPages.length / LIST_CONCURRENCY);
        console.log(`[腾讯] 并行抓取列表 批次 ${batchNum}/${totalBatches}（页 ${batch[0]}~${batch[batch.length - 1]}）`);

        const promises = batch.map(async (pageNum) => {
          const page = await this.newPage();
          try {
            await this.safeGoto(page, this.source.baseUrl);
            await this.randomDelay(300, 800);
            return await this.fetchApiData(page, pageNum, searchKeyword, categoryIds);
          } catch (err) {
            console.error(`[腾讯] 第 ${pageNum} 页请求失败:`, err);
            return null;
          } finally {
            await page.close();
          }
        });

        const results = await Promise.all(promises);

        for (const data of results) {
          if (!data?.Data?.Posts) continue;
          for (const post of data.Data.Posts) {
            if (listJobs.length >= maxJobs) break;
            listJobs.push(this.parsePost(post));
          }
        }

        if (this.onProgress) {
          this.onProgress(listJobs.length, Math.min(totalCount, maxJobs), `已抓取 ${listJobs.length}/${Math.min(totalCount, maxJobs)} 个职位`);
        }

        if (i + LIST_CONCURRENCY < remainingPages.length && listJobs.length < maxJobs) {
          await this.randomDelay(500, 1000);
        }
      }
    }

    const targetJobs = listJobs.slice(0, maxJobs);

    // ========== 阶段 2：并行调用详情 API 获取 Requirement ==========
    console.log(`[腾讯] 开始并行获取 ${targetJobs.length} 个职位的详情（纯 API）...`);

    // 分离内部职位（需要调详情 API）和外部职位（直接返回）
    const internalJobs: Partial<JobPosting>[] = [];
    const externalJobs: Partial<JobPosting>[] = [];
    for (const job of targetJobs) {
      if (job.detailUrl?.includes("careers.tencent.com/jobdesc")) {
        internalJobs.push(job);
      } else {
        // 外部链接直接补全
        externalJobs.push({
          ...job,
          id: `${this.source.id}_${job.sourceId}`,
          requirements: "暂无要求（外部链接，请查看原始页面）",
          crawledAt: new Date().toISOString(),
        });
      }
    }

    // 外部职位直接作为一批推送
    if (externalJobs.length > 0 && this.onJobsBatch) {
      this.onJobsBatch(externalJobs.map((j) => this.partialToFull(j)));
    }

    // 并行调用详情 API
    // 每个并发任务使用独立 page（page.evaluate 在同一 page 上串行执行，必须用独立 page 实现真并发）
    // Cookie/session 在 BrowserContext 级别共享，新 page 无需再访问首页
    const DETAIL_CONCURRENCY = 20;
    const completedJobs: Partial<JobPosting>[] = [...externalJobs];
    const totalInternal = internalJobs.length;

    for (let i = 0; i < totalInternal; i += DETAIL_CONCURRENCY) {
      const batch = internalJobs.slice(i, i + DETAIL_CONCURRENCY);

      const detailPromises = batch.map(async (job) => {
        const page = await this.newPage();
        try {
          const postId = job.sourceId || "";
          const detailPost = await this.fetchDetailApi(page, postId);

          if (detailPost) {
            const bgInfo = detailPost.ComName
              ? `${detailPost.BGName} - ${detailPost.ComName}`
              : detailPost.BGName;
            return {
              ...job,
              id: `${this.source.id}_${postId}`,
              title: detailPost.RecruitPostName || job.title,
              location: detailPost.LocationName || job.location,
              description: detailPost.Responsibility?.replace(/\\r\\n|\\n/g, "\n") || job.description,
              requirements: detailPost.Requirement?.replace(/\\r\\n|\\n/g, "\n") || "暂无要求",
              category: `${bgInfo} | ${detailPost.CategoryName}` || job.category,
              crawledAt: new Date().toISOString(),
            } as Partial<JobPosting>;
          }

          // API 失败时使用列表数据
          return {
            ...job,
            id: `${this.source.id}_${postId}`,
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
      if (i + DETAIL_CONCURRENCY < totalInternal) {
        await this.randomDelay(200, 500);
      }
    }

    console.log(`[腾讯] 列表+详情全部完成，共 ${completedJobs.length} 个职位`);

    // 返回空数组：所有数据已通过 onJobsBatch 增量推送完成，
    // 无需再经过 base.ts 的 crawlDetailsInParallel（避免重复推送和不必要的延迟）
    return [];
  }

  /**
   * 解析单条列表 API 返回的职位数据
   */
  private parsePost(post: TencentApiPost): Partial<JobPosting> {
    const isInternal = post.SourceID === 1;
    const detailUrl = isInternal
      ? this.buildDetailUrl(post.PostId)
      : post.PostURL;
    const bgInfo = post.ComName
      ? `${post.BGName} - ${post.ComName}`
      : post.BGName;

    return {
      title: post.RecruitPostName,
      source: this.source.id,
      company: this.source.company,
      sourceId: post.PostId,
      detailUrl,
      location: post.LocationName || "未知",
      description: post.Responsibility?.replace(/\\r\\n|\\n/g, "\n") || "",
      category: `${bgInfo} | ${post.CategoryName}`,
    };
  }

  /**
   * 将 Partial<JobPosting> 转换为完整 JobPosting
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
   * 通过详情 API 获取职位完整数据（含岗位要求 Requirement）
   *
   * API: GET /tencentcareer/api/post/ByPostId?postId=xxx
   * 比列表 API 多返回 Requirement 字段，且为纯 JSON 接口，
   * 比 DOM 解析详情页快 10-20x（~100ms vs ~3-5s）。
   */
  private async fetchDetailApi(
    page: Page,
    postId: string
  ): Promise<TencentDetailPost | null> {
    const timestamp = Date.now();
    const apiUrl = `${this.source.baseUrl}/tencentcareer/api/post/ByPostId?timestamp=${timestamp}&postId=${postId}`;

    try {
      const response = await page.evaluate(async (url: string) => {
        const res = await fetch(url);
        return res.json();
      }, apiUrl);

      if (response?.Code === 200 && response?.Data) {
        return response.Data as TencentDetailPost;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 抓取单个职位详情
   *
   * 由于 crawlJobList 阶段已通过详情 API 获取完整数据（含 Requirement），
   * 此方法直接返回已有数据，不需要任何网络请求。
   */
  protected async crawlJobDetail(
    _page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    return this.partialToFull(partialJob);
  }
}
