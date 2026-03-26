/**
 * 腾讯招聘爬虫
 *
 * 列表页: https://careers.tencent.com/search.html?query=at_1,ot_40001001,...&keyword=前端
 * 详情页: https://careers.tencent.com/jobdesc.html?postId=xxx
 *
 * 发现腾讯招聘有 JSON API，可直接调用：
 *   GET /tencentcareer/api/post/Query?categoryId=...&attrId=1&keyword=...&pageIndex=1&pageSize=10&language=zh-cn&area=cn
 * 返回结构化数据（标题、地点、事业群、职责描述等），无需解析 HTML 列表。
 *
 * 详情页 DOM 结构：
 *   - `.job-recruit-title` → 职位标题
 *   - `.job-recruit-location` → 地点
 *   - `.recruit-tips` → 事业群/子公司 | 类别 | 经验 | 更新时间
 *   - `.duty.work-module .duty-text` → 岗位职责
 *   - `.requirement.work-module .duty-text` → 岗位要求
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";
const PAGE_SIZE = 10;

/** 腾讯 API 返回的职位数据结构 */
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
   * attrId=1 表示社会招聘
   */
  private buildApiUrl(
    pageIndex: number,
    keyword: string = "前端",
    categoryIds: string[] = CATEGORY_IDS
  ): string {
    const timestamp = Date.now();
    const encodedKeyword = encodeURIComponent(keyword);
    return `${this.source.baseUrl}/tencentcareer/api/post/Query?timestamp=${timestamp}&countryId=&cityId=&bgIds=&productId=&categoryId=${categoryIds.join(",")}&parentCategoryId=&attrId=1&keyword=${encodedKeyword}&pageIndex=${pageIndex}&pageSize=${PAGE_SIZE}&language=zh-cn&area=cn`;
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
   * 通过 API 并行抓取职位列表
   *
   * 策略：先获取第 1 页得到 totalCount，计算总页数后并行请求所有剩余页面。
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
    keyword?: string
  ): Promise<Partial<JobPosting>[]> {
    // selectedCategoryIds 现在直接是子分类 ID 列表，无需展开
    // 腾讯 API 的 categoryId 参数直接接受子分类 ID
    const categoryIds =
      selectedCategoryIds && selectedCategoryIds.length > 0
        ? selectedCategoryIds
        : CATEGORY_IDS;
    // 优先使用用户传入的关键词；如果有自定义分类但没传 keyword，则不限关键词；否则默认搜"前端"
    let searchKeyword: string;
    if (keyword !== undefined) {
      searchKeyword = keyword;
    } else if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      searchKeyword = "";
    } else {
      searchKeyword = "前端";
    }

    const maxPages = Math.ceil(maxJobs / PAGE_SIZE);

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
    const allJobs: Partial<JobPosting>[] = [];
    for (const post of firstData.Data.Posts) {
      if (allJobs.length >= maxJobs) break;
      allJobs.push(this.parsePost(post));
    }

    if (this.onProgress) {
      this.onProgress(allJobs.length, Math.min(totalCount, maxJobs), `已抓取列表 第 1/${totalPages} 页`);
    }

    if (allJobs.length >= maxJobs || totalPages <= 1) {
      return allJobs.slice(0, maxJobs);
    }

    // 并行请求剩余页面（每批 LIST_CONCURRENCY 个并发）
    const LIST_CONCURRENCY = 5;
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    for (let i = 0; i < remainingPages.length && allJobs.length < maxJobs; i += LIST_CONCURRENCY) {
      const batch = remainingPages.slice(i, i + LIST_CONCURRENCY);
      const batchNum = Math.floor(i / LIST_CONCURRENCY) + 1;
      const totalBatches = Math.ceil(remainingPages.length / LIST_CONCURRENCY);
      console.log(`[腾讯] 并行抓取列表 批次 ${batchNum}/${totalBatches}（页 ${batch[0]}~${batch[batch.length - 1]}）`);

      const promises = batch.map(async (pageNum) => {
        const page = await this.newPage();
        try {
          // 每个 page 需要先访问首页建立 session
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
          if (allJobs.length >= maxJobs) break;
          allJobs.push(this.parsePost(post));
        }
      }

      if (this.onProgress) {
        this.onProgress(allJobs.length, Math.min(totalCount, maxJobs), `已抓取列表 批次 ${batchNum}/${totalBatches}`);
      }

      // 批次间短延迟
      if (i + LIST_CONCURRENCY < remainingPages.length && allJobs.length < maxJobs) {
        await this.randomDelay(500, 1000);
      }
    }

    return allJobs.slice(0, maxJobs);
  }

  /**
   * 解析单条 API 返回的职位数据
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
   * 抓取单个职位详情
   *
   * 详情页 DOM 结构:
   *   - `.job-recruit-title` → 标题
   *   - `.job-recruit-location` → 地点
   *   - `.recruit-tips` → 事业群 | 类别 | 经验 | 日期
   *   - `.duty.work-module .duty-text` → 岗位职责
   *   - `.requirement.work-module .duty-text` → 岗位要求
   */
  protected async crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    const detailUrl = partialJob.detailUrl || "";

    // 外部链接（如 Workday），直接使用 API 已有数据
    if (!detailUrl.includes("careers.tencent.com/jobdesc")) {
      console.log(`[腾讯] 外部链接，跳过详情抓取: ${detailUrl}`);
      return {
        id: `${this.source.id}_${partialJob.sourceId}`,
        title: partialJob.title || "未知职位",
        company: this.source.company,
        source: this.source.id,
        location: partialJob.location || "未知",
        sourceId: partialJob.sourceId || "",
        description: partialJob.description || "暂无描述",
        requirements: "暂无要求（外部链接，请查看原始页面）",
        detailUrl,
        crawledAt: new Date().toISOString(),
        category: partialJob.category,
      };
    }

    await this.safeGoto(page, detailUrl);

    // 等待详情页关键元素加载
    await page.waitForSelector(
      ".duty.work-module, .requirement.work-module, .job-recruit-title",
      { timeout: 15000 }
    ).catch(() => {
      console.log("[腾讯] 等待详情元素超时，尝试继续...");
    });

    await this.randomDelay(1500, 2500);

    const detail = await page.evaluate(() => {
      // 标题
      const titleEl = document.querySelector(".job-recruit-title");
      const title = titleEl?.textContent?.trim() || "";

      // 地点
      const locationEl = document.querySelector(".job-recruit-location");
      // 排除 icon-location 子元素的文本
      let location = "";
      if (locationEl) {
        location = locationEl.textContent?.trim() || "";
      }

      // 事业群/子公司信息 (.recruit-tips)
      const tipsEl = document.querySelector(".recruit-tips");
      let department = "";
      if (tipsEl) {
        // 取第一个 span 的文本作为事业群/子公司
        const firstSpan = tipsEl.querySelector("span");
        department = firstSpan?.textContent?.trim() || "";
      }

      // 岗位职责 (.duty.work-module .duty-text)
      const dutyEl = document.querySelector(".duty.work-module .duty-text");
      const description = dutyEl?.textContent?.trim() || "";

      // 岗位要求 (.requirement.work-module .duty-text)
      const reqEl = document.querySelector(".requirement.work-module .duty-text");
      const requirements = reqEl?.textContent?.trim() || "";

      return { title, location, department, description, requirements };
    });

    return {
      id: `${this.source.id}_${partialJob.sourceId}`,
      title: detail.title || partialJob.title || "未知职位",
      company: this.source.company,
      source: this.source.id,
      location: detail.location || partialJob.location || "未知",
      sourceId: partialJob.sourceId || "",
      description: detail.description || partialJob.description || "暂无描述",
      requirements: detail.requirements || "暂无要求",
      detailUrl,
      crawledAt: new Date().toISOString(),
      category: partialJob.category,
    };
  }
}
