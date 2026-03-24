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
import { JobPosting, CrawlerSource, SourceMeta } from "@/types";

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

/** 前端相关分类 ID */
const CATEGORY_IDS = "40001001,40001002,40001003,40001004,40001005,40001006";

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
  private buildApiUrl(pageIndex: number, keyword: string = "前端"): string {
    const timestamp = Date.now();
    const encodedKeyword = encodeURIComponent(keyword);
    return `${this.source.baseUrl}/tencentcareer/api/post/Query?timestamp=${timestamp}&countryId=&cityId=&bgIds=&productId=&categoryId=${CATEGORY_IDS}&parentCategoryId=&attrId=1&keyword=${encodedKeyword}&pageIndex=${pageIndex}&pageSize=${PAGE_SIZE}&language=zh-cn&area=cn`;
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
    keyword: string = "前端"
  ): Promise<TencentApiResponse | null> {
    const apiUrl = this.buildApiUrl(pageIndex, keyword);
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
   * 获取数据源元数据
   */
  async fetchMeta(): Promise<SourceMeta> {
    try {
      await this.launchBrowser();
      const page = await this.newPage();

      // 先访问首页建立 cookie/session
      await this.safeGoto(page, this.source.baseUrl);
      await this.randomDelay(1000, 2000);

      const data = await this.fetchApiData(page, 1);

      await page.close();
      await this.closeBrowser();

      if (data) {
        const totalJobs = data.Data.Count;
        return {
          sourceId: this.source.id,
          totalJobs,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(totalJobs / PAGE_SIZE),
          success: true,
        };
      }

      return {
        sourceId: this.source.id,
        totalJobs: 0,
        pageSize: PAGE_SIZE,
        totalPages: 0,
        success: false,
        error: "API 返回空数据",
      };
    } catch (err) {
      await this.closeBrowser();
      return {
        sourceId: this.source.id,
        totalJobs: 0,
        pageSize: PAGE_SIZE,
        totalPages: 0,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 通过 API 抓取职位列表
   */
  protected async crawlJobList(
    page: Page,
    maxJobs: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];
    const maxPages = Math.ceil(maxJobs / PAGE_SIZE);

    // 先访问首页建立 cookie/session
    await this.safeGoto(page, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const data = await this.fetchApiData(page, pageNum);

      if (!data || !data.Data.Posts || data.Data.Posts.length === 0) {
        console.log(`[腾讯] 第 ${pageNum} 页无数据，停止翻页`);
        break;
      }

      console.log(`[腾讯] 第 ${pageNum}/${maxPages} 页获取到 ${data.Data.Posts.length} 个职位`);

      for (const post of data.Data.Posts) {
        // 判断是否为腾讯内部详情页（SourceID=1）还是外部链接（如 Workday）
        const isInternal = post.SourceID === 1;
        const detailUrl = isInternal
          ? this.buildDetailUrl(post.PostId)
          : post.PostURL;

        // 事业群信息: BGName + ComName (如果有子公司)
        const bgInfo = post.ComName
          ? `${post.BGName} - ${post.ComName}`
          : post.BGName;

        allJobs.push({
          title: post.RecruitPostName,
          source: this.source.id,
          company: this.source.company,
          sourceId: post.PostId,
          detailUrl,
          location: post.LocationName || "未知",
          // API 已经提供了职责描述，存入 description
          description: post.Responsibility?.replace(/\\r\\n|\\n/g, "\n") || "",
          category: `${bgInfo} | ${post.CategoryName}`,
        });

        if (allJobs.length >= maxJobs) break;
      }

      if (allJobs.length >= maxJobs) break;

      // 翻页间延迟
      if (pageNum < maxPages) {
        await this.randomDelay(1000, 2000);
      }
    }

    return allJobs.slice(0, maxJobs);
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
