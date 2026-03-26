/**
 * 京东招聘爬虫
 *
 * 列表页: https://zhaopin.jd.com/web/job/job_info_list/3
 *
 * 京东招聘提供三个 JSON API（均使用 form-urlencoded 格式）：
 *   1. 列表 API: POST /web/job/job_list
 *      请求体: pageIndex, pageSize, workCityJson, jobTypeJson, jobSearch, depTypeJson
 *      返回: 直接为职位数组（无包装），每条包含 workContent（职责）和 qualification（要求）
 *
 *   2. 总数 API: POST /web/job/job_count
 *      请求体: workCityJson, jobTypeJson, jobSearch, depTypeJson
 *      返回: 直接为数字（如 3488）
 *
 *   3. 分类参数 API: POST /web/job/job_allparams
 *      返回: { workCityList, deptList, jobTypeList }
 *
 * 分类体系:
 *   jobTypeJson 参数: 职位类型 code 数组，如 ["YANFA"] 表示研发类
 *     YANFA=研发类, YUNGYUN=运营类, ZHINENG=职能类, CAIXIAO=采销类,
 *     JINRONGYW=金融业务类, KEFU=客服类
 *   depTypeJson 参数: 部门 code 数组，如 ["00013807"] 表示京东零售
 *
 * 优化策略:
 *   - 列表 API 已返回完整数据（workContent + qualification），无需详情 API
 *   - 先调用 job_count 获取总数，再并行翻页获取所有数据
 *   - pageSize 最大支持 100
 *   - 使用 page.evaluate + fetch 方式调用 API（需页面上下文以携带 Cookie）
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

/** 列表 API 每页条数（京东 API 最大支持 100） */
const PAGE_SIZE = 100;

// === API 接口类型定义 ===

/** 列表 API 返回的单条职位数据 */
interface JDJobPost {
  id: number;
  positionId: number;
  positionCode: string;
  positionName: string;
  positionNameOpen: string;
  positionDeptName: string;
  positionDeptCode: string;
  positionDeptCodeFullpath: string;
  jobType: string;
  jobTypeCode: string;
  workCity: string;
  workCityCode: string;
  workContent: string;
  qualification: string;
  publishTime: number;
  formatPublishTime: string;
  isHot: number;
  positionCollectionId: number;
  positionLevel: string;
  positionLevelCode: string;
  positionSubsequence: string;
  positionType: string;
  lvlCode: string;
  lvlName: string;
  reqNumber: string;
  requirementId: number;
  appTime: number | null;
  applicantErp: string;
  recCount: number;
  recLeader: string;
  reportLeader: string;
  reqDepartment: string;
  reqName: string;
}

/**
 * 京东招聘的分类体系:
 * - jobTypeCode: 职位类型代码，如 YANFA=研发类, YUNGYUN=运营类
 * - depTypeCode: 部门代码，如 00013807=京东零售
 *
 * 本项目的分类映射:
 *   大类 = jobTypeCode (如 "YANFA")
 *   子分类 = depType 部门（但京东分类比较扁平，只有一级职位类型，没有子分类）
 *
 * 为与项目两级分类体系一致，我们将 jobTypeCode 作为大类 ID，
 * 由于京东没有子分类概念，每个大类下只有一个子分类（与大类同名）
 */

/** 默认筛选的职位类型（研发类） */
const DEFAULT_JOB_TYPE_CODES = ["YANFA"];

export class JDCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "jd",
    name: "京东",
    company: "京东",
    logo: "https://zhaopin.jd.com/favicon.ico",
    baseUrl: "https://zhaopin.jd.com",
    enabled: true,
    description: "京东社会招聘 - 涵盖零售、物流、科技、健康等业务线",
  };

  // --- 私有辅助方法 ---

  /**
   * 构建列表搜索请求体（URL 编码格式）
   *
   * selectedCategoryIds 格式: ["YANFA", "YUNGYUN", ...]
   * 直接对应 jobTypeJson
   */
  private buildSearchParams(
    pageIndex: number,
    pageSize: number,
    categoryIds: string[],
    keyword: string
  ): string {
    const params = new URLSearchParams();
    params.set("pageIndex", String(pageIndex));
    params.set("pageSize", String(pageSize));
    params.set("workCityJson", "[]");
    params.set("jobTypeJson", JSON.stringify(categoryIds));
    params.set("jobSearch", keyword);
    params.set("depTypeJson", "[]");
    return params.toString();
  }

  /**
   * 构建总数请求体
   */
  private buildCountParams(
    categoryIds: string[],
    keyword: string
  ): string {
    const params = new URLSearchParams();
    params.set("workCityJson", "[]");
    params.set("jobTypeJson", JSON.stringify(categoryIds));
    params.set("jobSearch", keyword);
    params.set("depTypeJson", "[]");
    return params.toString();
  }

  /**
   * 调用总数 API 获取满足条件的职位总数
   */
  private async fetchJobCount(
    page: Page,
    categoryIds: string[],
    keyword: string
  ): Promise<number> {
    const body = this.buildCountParams(categoryIds, keyword);
    const apiUrl = `${this.source.baseUrl}/web/job/job_count`;

    try {
      const response = await page.evaluate(
        async ({ url, reqBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: reqBody,
          });
          return res.json();
        },
        { url: apiUrl, reqBody: body }
      );

      if (typeof response === "number") {
        return response;
      }
      console.log(
        `[${this.source.name}] job_count 返回异常:`,
        JSON.stringify(response).substring(0, 200)
      );
      return 0;
    } catch (err) {
      console.log(`[${this.source.name}] job_count 调用失败:`, err);
      return 0;
    }
  }

  /**
   * 调用列表搜索 API
   *
   * 使用 page.evaluate + fetch 方式（需要页面上下文以携带 Cookie）
   * 返回值直接为职位数组（京东 API 无包装层）
   */
  private async fetchSearchApi(
    page: Page,
    pageIndex: number,
    pageSize: number,
    categoryIds: string[],
    keyword: string
  ): Promise<JDJobPost[] | null> {
    const body = this.buildSearchParams(pageIndex, pageSize, categoryIds, keyword);
    const apiUrl = `${this.source.baseUrl}/web/job/job_list`;

    console.log(
      `[${this.source.name}] 调用列表 API: pageIndex=${pageIndex}, pageSize=${pageSize}`
    );

    try {
      const response = await page.evaluate(
        async ({ url, reqBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: reqBody,
          });
          return res.json();
        },
        { url: apiUrl, reqBody: body }
      );

      if (Array.isArray(response)) {
        return response as JDJobPost[];
      }
      console.log(
        `[${this.source.name}] API 返回异常（非数组）:`,
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log(`[${this.source.name}] 列表 API 调用失败:`, err);
      return null;
    }
  }

  /**
   * 解析列表 API 返回的单条职位数据
   */
  private parsePost(post: JDJobPost): Partial<JobPosting> {
    const category = [post.jobType, post.positionDeptName]
      .filter(Boolean)
      .join(" | ");

    return {
      id: `${this.source.id}_${post.requirementId}`,
      title: post.positionNameOpen || post.positionName,
      source: this.source.id,
      company: this.source.company,
      sourceId: String(post.requirementId),
      detailUrl: `${this.source.baseUrl}/web/job/job_info_list/3`,
      location: post.workCity || "未知",
      description: post.workContent || "暂无描述",
      requirements: post.qualification || "暂无要求",
      category,
      crawledAt: new Date().toISOString(),
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
    };
  }

  /**
   * 抓取职位列表（核心方法）
   *
   * 策略:
   * 1. 先调用 job_count 获取总数
   * 2. 第 1 页获取首批数据并增量推送
   * 3. 并行请求剩余所有列表页
   * 4. 列表 API 已包含完整数据（workContent + qualification），无需详情阶段
   * 5. 返回空数组跳过 base.ts 的 crawlDetailsInParallel
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
        : DEFAULT_JOB_TYPE_CODES;

    let searchKeyword: string;
    if (keyword !== undefined) {
      searchKeyword = keyword;
    } else if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      searchKeyword = "";
    } else {
      searchKeyword = "";
    }

    // ========== 阶段 1：获取总数并抓取第 1 页 ==========

    // 先访问首页建立 cookie/session
    const initPage = await this.newPage();
    await this.safeGoto(initPage, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    // 获取总数
    const totalCount = await this.fetchJobCount(initPage, categoryIds, searchKeyword);
    if (totalCount === 0) {
      console.log(`[${this.source.name}] 无匹配职位，终止`);
      await initPage.close();
      return [];
    }

    const targetCount = Math.min(totalCount, maxJobs);
    const targetPages = Math.ceil(targetCount / PAGE_SIZE);
    console.log(
      `[${this.source.name}] 共 ${totalCount} 个职位，${targetPages} 页（目标 ${maxJobs === Infinity ? "全部" : maxJobs} 个）`
    );

    // 第 1 页
    const firstData = await this.fetchSearchApi(
      initPage,
      1,
      PAGE_SIZE,
      categoryIds,
      searchKeyword
    );

    if (!firstData || firstData.length === 0) {
      console.log(`[${this.source.name}] 第 1 页无数据，终止`);
      await initPage.close();
      return [];
    }

    // 解析第 1 页的数据
    const allJobs: Partial<JobPosting>[] = [];
    for (const post of firstData) {
      if (allJobs.length >= maxJobs) break;
      allJobs.push(this.parsePost(post));
    }

    // 增量推送第 1 页
    if (allJobs.length > 0 && this.onJobsBatch) {
      this.onJobsBatch(allJobs.map((j) => this.partialToFull(j)));
    }
    if (this.onProgress) {
      this.onProgress(
        allJobs.length,
        targetCount,
        `已抓取 ${allJobs.length}/${targetCount} 个职位`
      );
    }

    // ========== 阶段 2：并行请求剩余列表页 ==========

    if (allJobs.length < maxJobs && targetPages > 1) {
      const LIST_CONCURRENCY = 5;
      const remainingPages = Array.from(
        { length: targetPages - 1 },
        (_, i) => i + 2
      );

      for (
        let i = 0;
        i < remainingPages.length && allJobs.length < maxJobs;
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

        const batchJobs: Partial<JobPosting>[] = [];
        for (const data of results) {
          if (!Array.isArray(data)) continue;
          for (const post of data) {
            if (allJobs.length >= maxJobs) break;
            const job = this.parsePost(post);
            allJobs.push(job);
            batchJobs.push(job);
          }
        }

        // 增量推送
        if (batchJobs.length > 0 && this.onJobsBatch) {
          this.onJobsBatch(batchJobs.map((j) => this.partialToFull(j)));
        }
        if (this.onProgress) {
          this.onProgress(
            allJobs.length,
            targetCount,
            `已抓取 ${allJobs.length}/${targetCount} 个职位`
          );
        }

        // 批次间短延迟
        if (
          i + LIST_CONCURRENCY < remainingPages.length &&
          allJobs.length < maxJobs
        ) {
          await this.randomDelay(300, 800);
        }
      }
    }

    await initPage.close();

    console.log(
      `[${this.source.name}] 列表抓取完成，共 ${allJobs.length} 个职位`
    );

    // 列表 API 已返回完整数据（workContent + qualification），无需详情阶段
    // 返回空数组跳过 base.ts 的 crawlDetailsInParallel
    return [];
  }

  /**
   * 抓取单个职位详情（基类接口实现）
   *
   * 由于 crawlJobList 已通过 onJobsBatch 推送完整数据并返回 []，
   * 此方法不会被调用，但仍需实现。
   */
  protected async crawlJobDetail(
    _page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    return this.partialToFull(partialJob);
  }
}
