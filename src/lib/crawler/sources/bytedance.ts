/**
 * 字节跳动招聘爬虫
 *
 * 发现字节跳动招聘有完善的 JSON API，可直接调用无需签名：
 *
 * 列表 API (POST):
 *   POST https://jobs.bytedance.com/api/v1/search/job/posts
 *   Body: { keyword, limit, offset, job_category_id_list, portal_type, ... }
 *   返回完整的结构化数据：标题、地点、类别、职责描述、职位要求等。
 *   列表 API 已包含完整的 description + requirement，无需再访问详情页！
 *
 * 详情 API (GET, 备用):
 *   GET https://jobs.bytedance.com/api/v1/job/posts/{postId}?portal_type=2&with_recommend=true
 *
 * 关键参数：
 *   - job_category_id_list: ["6704215862603155720"] = 研发大类
 *   - portal_type: 2 = 社招
 *   - limit: 最大 50
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource, SourceMeta } from "@/types";

/** 每页最大条数（API 最大支持 50） */
const PAGE_SIZE = 50;

/** 研发大类 category ID */
const CATEGORY_RD = "6704215862603155720";

/** API 基础地址 */
const API_BASE = "https://jobs.bytedance.com/api/v1";

/** 字节跳动列表 API 请求体 */
interface BytedanceSearchBody {
  keyword: string;
  limit: number;
  offset: number;
  job_category_id_list: string[];
  tag_id_list: string[];
  location_code_list: string[];
  subject_id_list: string[];
  recruitment_id_list: string[];
  portal_type: number;
  job_function_id_list: string[];
  storefront_id_list: string[];
  portal_entrance: number;
}

/** 详情 API 返回结构 */
interface BytedanceDetailResponse {
  code: number;
  data: {
    job_post: BytedanceJobPost | null;
  };
  message: string;
}

/** API 返回的职位数据结构 */
interface BytedanceJobPost {
  id: string;
  title: string;
  sub_title: string | null;
  description: string;
  requirement: string;
  job_category: {
    id: string;
    name: string;
    en_name: string;
    i18n_name: string;
    depth: number;
    parent: {
      id: string;
      name: string;
      en_name: string;
      i18n_name: string;
    } | null;
  };
  city_info: {
    code: string;
    name: string;
    en_name: string;
    i18n_name: string;
  };
  city_list: Array<{
    code: string;
    name: string;
    en_name: string;
    i18n_name: string;
  }> | null;
  recruit_type: {
    id: string;
    name: string;
    en_name: string;
    i18n_name: string;
    parent: {
      name: string;
      en_name: string;
    } | null;
  };
  publish_time: number;
  code: string;
}

interface BytedanceSearchResponse {
  code: number;
  data: {
    job_post_list: BytedanceJobPost[];
    count: number;
  };
  message: string;
}

export class BytedanceCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "bytedance",
    name: "字节跳动",
    company: "字节跳动",
    logo: "https://lf-package-cn.feishucdn.com/obj/atsx-throne/hire-fe-prod/portal/mainland/favicon.ico",
    baseUrl: "https://jobs.bytedance.com",
    enabled: true,
    description: "字节跳动（今日头条、抖音母公司）社会招聘",
  };

  /** 构建搜索请求体 */
  private buildSearchBody(
    offset: number,
    limit: number = PAGE_SIZE,
    keyword: string = "前端"
  ): BytedanceSearchBody {
    return {
      keyword,
      limit,
      offset,
      job_category_id_list: [CATEGORY_RD],
      tag_id_list: [],
      location_code_list: [],
      subject_id_list: [],
      recruitment_id_list: [],
      portal_type: 2,
      job_function_id_list: [],
      storefront_id_list: [],
      portal_entrance: 1,
    };
  }

  /**
   * 调用列表搜索 API
   * 使用 Playwright page.evaluate 中的 fetch 来避免 CORS 问题
   */
  private async fetchSearchApi(
    page: Page,
    offset: number,
    limit: number = PAGE_SIZE,
    keyword: string = "前端"
  ): Promise<BytedanceSearchResponse | null> {
    const body = this.buildSearchBody(offset, limit, keyword);
    const apiUrl = `${API_BASE}/search/job/posts`;

    console.log(
      `[字节跳动] 调用 API: offset=${offset}, limit=${limit}, keyword=${keyword}`
    );

    try {
      const response = await page.evaluate(
        async ({ url, body }: { url: string; body: BytedanceSearchBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          return res.json();
        },
        { url: apiUrl, body }
      );

      if (response?.code === 0 && response?.data) {
        return response as BytedanceSearchResponse;
      }

      console.log(
        "[字节跳动] API 返回异常:",
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log("[字节跳动] API 调用失败:", err);
      return null;
    }
  }

  /**
   * 调用详情 API，获取单个职位的完整数据
   * 用于列表 API 返回的数据不完整时的回退方案
   */
  private async fetchDetailApi(
    page: Page,
    postId: string
  ): Promise<BytedanceJobPost | null> {
    const apiUrl = `${API_BASE}/job/posts/${postId}?portal_type=2`;

    console.log(`[字节跳动] 调用详情 API: postId=${postId}`);

    try {
      const response = await page.evaluate(
        async (url: string) => {
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          return res.json();
        },
        apiUrl
      );

      if (response?.code === 0 && response?.data?.job_post) {
        return response.data.job_post as BytedanceJobPost;
      }

      console.log(
        "[字节跳动] 详情 API 返回异常:",
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log("[字节跳动] 详情 API 调用失败:", err);
      return null;
    }
  }

  /**
   * 判断列表 API 返回的职位数据是否完整
   * description/requirement/location 任一缺失即视为不完整
   */
  private isJobDataIncomplete(partialJob: Partial<JobPosting>): boolean {
    return (
      !partialJob.description ||
      !partialJob.requirements ||
      partialJob.location === "未知"
    );
  }

  /**
   * 从详情 API 返回的 job_post 中提取补全信息
   */
  private parseDetailPost(post: BytedanceJobPost): {
    description: string;
    requirements: string;
    location: string;
    category: string;
  } {
    // 构建城市信息
    const locations: string[] = [];
    if (post.city_list && post.city_list.length > 0) {
      for (const city of post.city_list) {
        if (city.name) locations.push(city.name);
      }
    } else if (post.city_info?.name) {
      locations.push(post.city_info.name);
    }

    // 构建分类信息
    const categoryParts: string[] = [];
    if (post.job_category?.parent?.name) {
      categoryParts.push(post.job_category.parent.name);
    }
    if (post.job_category?.name) {
      categoryParts.push(post.job_category.name);
    }
    if (post.recruit_type?.name) {
      categoryParts.push(post.recruit_type.name);
    }

    return {
      description: post.description || "",
      requirements: post.requirement || "",
      location: locations.join("、") || "未知",
      category: categoryParts.join(" - ") || "",
    };
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

      const data = await this.fetchSearchApi(page, 0, 1);

      await page.close();
      await this.closeBrowser();

      if (data) {
        const totalJobs = data.data.count;
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
   *
   * 因为列表 API 已返回完整的 description + requirement，
   * 这里直接组装完整的 JobPosting（带一个特殊标记），
   * 让 crawlJobDetail 直接返回已有数据，跳过详情页抓取。
   */
  protected async crawlJobList(
    page: Page,
    maxJobs: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];

    // 先访问首页建立 cookie/session
    await this.safeGoto(page, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    // 分页获取
    for (let offset = 0; offset < maxJobs; offset += PAGE_SIZE) {
      const limit = Math.min(PAGE_SIZE, maxJobs - offset);
      const data = await this.fetchSearchApi(page, offset, limit);

      if (!data || !data.data.job_post_list || data.data.job_post_list.length === 0) {
        console.log(`[字节跳动] offset=${offset} 无数据，停止翻页`);
        break;
      }

      const pageIndex = Math.floor(offset / PAGE_SIZE) + 1;
      const totalPages = Math.ceil(maxJobs / PAGE_SIZE);
      console.log(
        `[字节跳动] 第 ${pageIndex}/${totalPages} 页获取到 ${data.data.job_post_list.length} 个职位`
      );

      for (const post of data.data.job_post_list) {
        // 构建城市信息：优先使用 city_list（多城市），否则用 city_info
        const locations: string[] = [];
        if (post.city_list && post.city_list.length > 0) {
          for (const city of post.city_list) {
            if (city.name) locations.push(city.name);
          }
        } else if (post.city_info?.name) {
          locations.push(post.city_info.name);
        }
        const location = locations.join("、") || "未知";

        // 构建分类信息：子类别 + 父类别
        const categoryParts: string[] = [];
        if (post.job_category?.parent?.name) {
          categoryParts.push(post.job_category.parent.name);
        }
        if (post.job_category?.name) {
          categoryParts.push(post.job_category.name);
        }
        if (post.recruit_type?.name) {
          categoryParts.push(post.recruit_type.name);
        }
        const category = categoryParts.join(" - ") || "";

        const detailUrl = `${this.source.baseUrl}/experienced/position/${post.id}/detail`;

        allJobs.push({
          id: `${this.source.id}_${post.id}`,
          title: post.title,
          source: this.source.id,
          company: this.source.company,
          sourceId: post.id,
          detailUrl,
          location,
          description: post.description || "",
          requirements: post.requirement || "",
          category,
          crawledAt: new Date().toISOString(),
        });

        if (allJobs.length >= maxJobs) break;
      }

      if (allJobs.length >= maxJobs) break;

      // 翻页间延迟
      await this.randomDelay(500, 1500);
    }

    return allJobs.slice(0, maxJobs);
  }

  /**
   * 抓取单个职位详情
   *
   * 优先使用列表 API 已返回的数据。
   * 当关键字段（description、requirement、location）缺失时，
   * 回退到详情 API 获取完整数据。
   */
  protected async crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    // 如果列表数据不完整，尝试通过详情 API 补全
    if (this.isJobDataIncomplete(partialJob) && partialJob.sourceId) {
      console.log(
        `[字节跳动] 职位 "${partialJob.title}" 数据不完整（location=${partialJob.location}），尝试详情 API 补全...`
      );

      const detailPost = await this.fetchDetailApi(page, partialJob.sourceId);

      if (detailPost) {
        const detail = this.parseDetailPost(detailPost);
        return {
          id: partialJob.id || `${this.source.id}_${partialJob.sourceId}`,
          title: detailPost.title || partialJob.title || "未知职位",
          company: this.source.company,
          source: this.source.id,
          location: detail.location !== "未知" ? detail.location : (partialJob.location || "未知"),
          sourceId: partialJob.sourceId || "",
          description: detail.description || partialJob.description || "暂无描述",
          requirements: detail.requirements || partialJob.requirements || "暂无要求",
          detailUrl: partialJob.detailUrl || "",
          crawledAt: partialJob.crawledAt || new Date().toISOString(),
          category: detail.category || partialJob.category,
        };
      }

      console.log(
        `[字节跳动] 详情 API 未返回有效数据，使用列表数据`
      );
    }

    // 列表 API 已提供完整数据，直接返回
    return {
      id: partialJob.id || `${this.source.id}_${partialJob.sourceId}`,
      title: partialJob.title || "未知职位",
      company: this.source.company,
      source: this.source.id,
      location: partialJob.location || "未知",
      sourceId: partialJob.sourceId || "",
      description: partialJob.description || "暂无描述",
      requirements: partialJob.requirements || "暂无要求",
      detailUrl: partialJob.detailUrl || "",
      crawledAt: partialJob.crawledAt || new Date().toISOString(),
      category: partialJob.category,
    };
  }
}
