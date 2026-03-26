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
 *   - job_category_id_list: 通过精确的子类 ID 筛选，而非关键词模糊搜索
 *   - portal_type: 2 = 社招
 *   - limit: 最大 50
 *
 * 分类体系（选择"研发"大类时，前端会展开为以下所有子类 ID）：
 *   - 6704215886108035339 = 前端开发（默认只爬取此子类）
 *   - 6704215862557018372, 6704215888985327886, ...
 *   - 共 15 个子类覆盖研发全部方向
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

/** 每页最大条数（API 最大支持 50） */
const PAGE_SIZE = 50;

/** 前端开发子类 category ID */
const CATEGORY_FRONTEND = "6704215886108035339";

/*
 * 字节跳动招聘完整分类参考:
 *
 * 大类 (根级):
 *   6704215862603155720 - 研发    (子分类: 见上方 CATEGORY_RD_ALL)
 *   6704215864629004552 - 产品    (子分类见下方)
 *   6704215882479962371 - 运营    (子分类见下方)
 *   6704215901438216462 - 市场    (子分类见下方)
 *   6704215913488451847 - 职能/支持 (子分类见下方)
 *   6709824272505768200 - 销售    (子分类见下方)
 *   6709824272514156812 - 设计    (子分类见下方)
 *
 * 产品 (6704215864629004552):
 *   6704215864591255820 - 产品经理
 *   6704215924712409352 - 商业产品（广告）
 *   6704216224387041544 - 数据分析
 *
 * 运营 (6704215882479962371):
 *   6704215882438019342 - 商业运营
 *   6704215955154667787 - 用户运营
 *   6704216057269192973 - 产品运营
 *   6709824273306880267 - 客服
 *   6863074795655792910 - 项目管理
 *
 * 市场 (6704215901438216462):
 *   6704215901392079117 - 广告投放
 *   6704216021651163395 - 营销策划
 *   6704216430973290760 - 品牌
 *   6704216870330829070 - 政府关系
 *   6704216950135851275 - 商务拓展BD
 *   6704217388763580683 - 媒介公关
 *
 * 职能/支持 (6704215913488451847):
 *   6704215913454897421 - 法务
 *   6704216232129726734 - 战略
 *   6704216386916321540 - 人力
 *   6704216480889702664 - 财务
 *   6704217005358057732 - IT支持
 *   6704219468463081735 - 采购
 *   6850051245856524558 - 内审
 *
 * 销售 (6709824272505768200):
 *   6704215938645887239 - 销售
 *   6704215966085024003 - 销售支持
 *   6709824272459630861 - 销售专员
 *   6709824273038444807 - 销售管理
 *
 * 设计 (6709824272514156812):
 *   6704216194292910348 - UI
 *   6704216925762750724 - 交互设计
 *   6709824272627403020 - 视觉设计
 *   6709824272996501772 - 用户研究
 *   6709824273332046088 - 多媒体设计
 *   6850051246036879630 - 游戏美术
 */

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

  /**
   * 构建搜索请求体
   *
   * 使用精确的分类 ID 筛选，不依赖关键词模糊搜索。
   * 默认只筛选「前端开发」子类，传入 CATEGORY_RD_ALL 可获取全部研发岗位。
   */
  private buildSearchBody(
    offset: number,
    limit: number = PAGE_SIZE,
    categoryIds: string[] = [CATEGORY_FRONTEND]
  ): BytedanceSearchBody {
    return {
      keyword: "",
      limit,
      offset,
      job_category_id_list: categoryIds,
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
    categoryIds: string[] = [CATEGORY_FRONTEND]
  ): Promise<BytedanceSearchResponse | null> {
    const body = this.buildSearchBody(offset, limit, categoryIds);
    const apiUrl = `${API_BASE}/search/job/posts`;

    console.log(
      `[字节跳动] 调用 API: offset=${offset}, limit=${limit}, categories=${categoryIds.length}个`
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
   * 通过 API 并行抓取职位列表
   *
   * 策略：先获取第 1 页得到 totalCount，计算总页数后并行请求所有剩余页面。
   * 因为列表 API 已返回完整的 description + requirement，
   * 这里直接组装完整的 JobPosting，让 crawlJobDetail 直接返回已有数据。
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
  ): Promise<Partial<JobPosting>[]> {
    // selectedCategoryIds 现在直接是子分类 ID 列表，无需展开
    const categoryIds =
      selectedCategoryIds && selectedCategoryIds.length > 0
        ? selectedCategoryIds
        : [CATEGORY_FRONTEND];

    // 先访问首页建立 cookie/session
    const initPage = await this.newPage();
    await this.safeGoto(initPage, this.source.baseUrl);
    await this.randomDelay(1000, 2000);

    // 第 1 页：获取 totalCount
    const firstData = await this.fetchSearchApi(initPage, 0, PAGE_SIZE, categoryIds);
    await initPage.close();

    if (!firstData || !firstData.data.job_post_list || firstData.data.job_post_list.length === 0) {
      console.log("[字节跳动] 第 1 页无数据，终止");
      return [];
    }

    const totalCount = firstData.data.count;
    const totalPages = Math.ceil(Math.min(totalCount, maxJobs) / PAGE_SIZE);
    console.log(`[字节跳动] 共 ${totalCount} 个职位，${totalPages} 页（目标 ${maxJobs} 个）`);

    // 解析第 1 页的数据
    const allJobs: Partial<JobPosting>[] = [];
    for (const post of firstData.data.job_post_list) {
      if (allJobs.length >= maxJobs) break;
      allJobs.push(this.parsePost(post));
    }

    if (this.onProgress) {
      this.onProgress(allJobs.length, Math.min(totalCount, maxJobs), `已抓取列表 第 1/${totalPages} 页`);
    }

    if (allJobs.length >= maxJobs || totalPages <= 1) {
      return allJobs.slice(0, maxJobs);
    }

    // 并行请求剩余页面
    const LIST_CONCURRENCY = 5;
    const remainingOffsets = Array.from(
      { length: totalPages - 1 },
      (_, i) => (i + 1) * PAGE_SIZE
    );

    for (let i = 0; i < remainingOffsets.length && allJobs.length < maxJobs; i += LIST_CONCURRENCY) {
      const batch = remainingOffsets.slice(i, i + LIST_CONCURRENCY);
      const batchNum = Math.floor(i / LIST_CONCURRENCY) + 1;
      const totalBatches = Math.ceil(remainingOffsets.length / LIST_CONCURRENCY);
      console.log(`[字节跳动] 并行抓取列表 批次 ${batchNum}/${totalBatches}`);

      const promises = batch.map(async (offset) => {
        const page = await this.newPage();
        try {
          await this.safeGoto(page, this.source.baseUrl);
          await this.randomDelay(300, 800);
          const limit = Math.min(PAGE_SIZE, maxJobs - offset);
          return await this.fetchSearchApi(page, offset, limit, categoryIds);
        } catch (err) {
          console.error(`[字节跳动] offset=${offset} 请求失败:`, err);
          return null;
        } finally {
          await page.close();
        }
      });

      const results = await Promise.all(promises);

      for (const data of results) {
        if (!data?.data?.job_post_list) continue;
        for (const post of data.data.job_post_list) {
          if (allJobs.length >= maxJobs) break;
          allJobs.push(this.parsePost(post));
        }
      }

      if (this.onProgress) {
        this.onProgress(allJobs.length, Math.min(totalCount, maxJobs), `已抓取列表 批次 ${batchNum}/${totalBatches}`);
      }

      // 批次间短延迟
      if (i + LIST_CONCURRENCY < remainingOffsets.length && allJobs.length < maxJobs) {
        await this.randomDelay(300, 800);
      }
    }

    return allJobs.slice(0, maxJobs);
  }

  /**
   * 解析单条 API 返回的职位数据
   */
  private parsePost(post: BytedanceJobPost): Partial<JobPosting> {
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

    return {
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
    };
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
