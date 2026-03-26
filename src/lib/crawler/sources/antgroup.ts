/**
 * 蚂蚁集团招聘爬虫
 *
 * 蚂蚁集团招聘网站 (talent.antgroup.com) 与阿里巴巴子站共享同一套前端架构:
 * - 前端: React + Bigfish/Umi (new-careers-portal), 使用蚂蚁内部 tern 微前端框架
 * - 后端 API: https://hrcareersweb.antgroup.com
 * - 搜索 API: POST /api/social/position/search (JSON)
 * - CSRF 机制: cookie 名 "ctoken"（值格式为 "bigfish_ctoken_xxxx"），查询参数名 ctoken
 *
 * ⚠️ 与阿里巴巴子站的关键区别:
 * 阿里子站 (如 careers.aliyun.com) 的 /position/search 在 nginx 层直接路由到后端，
 * 所以 page.evaluate 中的 fetch('/position/search') 可以直接命中后端 API。
 * 蚂蚁的 talent.antgroup.com 使用 tern 框架，API 代理是 JS runtime 级别
 * (前端 request 客户端拦截 /api/* 转发到 hrcareersweb.antgroup.com)，
 * 不在 nginx/CDN 层面实现。因此 page.evaluate 中的原生 fetch 无法利用前端代理，
 * 请求会打到 nginx 的 SPA fallback，POST 方法返回 405 Method Not Allowed。
 *
 * 爬取策略:
 * 1. 通过 Playwright 打开社招列表页，建立完整 session + CSRF
 * 2. 使用 page.route() 拦截 /api/social/position/search 请求，转发至后端 hrcareersweb.antgroup.com
 * 3. 从 cookie 中提取 ctoken（值格式 bigfish_ctoken_xxxx），通过 page.evaluate + fetch 调用 API
 * 4. 在请求体中传入 categories + subCategories 参数精确筛选岗位
 * 5. API 返回完整的 description + requirement，无需抓详情页
 *
 * 蚂蚁集团完整分类体系 (6 大职类):
 *
 * 技术类 (categories: "131"):
 *   132 - 前端开发          133 - 后端开发          134 - 算法
 *   135 - 数据开发          136 - 测试             137 - 运维
 *   138 - 安全             139 - 客户端开发         140 - 系统架构
 *   141 - 质量保证          142 - 技术管理          176 - 数据分析
 *   407 - 信息安全          408 - 大数据            409 - 机器学习
 *   410 - 综合技术          411 - 解决方案          511 - 地图技术
 *   702 - 基础平台          703 - 无线开发          704 - 综合研发
 *   764 - 多媒体技术        769 - 游戏技术          798 - 芯片
 *   811 - 大模型            100000037 - 智能引擎     100000053 - 风控技术
 *   101300002 - 区块链       101300003 - 云原生       101300004 - 数据库
 *   101300005 - 中间件       101300006 - IoT         101300025 - 隐私计算
 *   101300034 - 数字化
 *
 * 产品类 (categories: "97"):
 *   403 - 平台型            404 - 商业型            405 - 用户型
 *   406 - 综合管理
 *
 * 运营类 (categories: "103"):
 *   108 - 商家运营          474 - 安全运营          475 - 产品运营
 *   476 - 规则管理          477 - 行业运营          478 - 内容运营
 *   479 - 频道/类目运营     480 - 无线产品运营      481 - 无线内容运营
 *   482 - 无线运营综合      483 - 运营综合          484 - 综合管理
 *   757 - 用户运营          758 - 产品运营（商业化） 834 - 经营管理
 *
 * 设计类 (categories: "112"):
 *   113 - 交互设计          114 - 视觉设计          115 - 用户体验与研究
 *   444 - 综合管理          802 - 创意设计
 *
 * 风险策略类 (categories: "143"):
 *   446 - 风险策略分析      447 - 反洗钱            448 - 合规风控
 *
 * 综合类 (categories: "157"):
 *   159 - 法务             162 - 人力资源          163 - 行政
 *   165 - 采购             168 - 综合管理          180 - 其它
 *   485 - IT              486 - 财务及内控         487 - 工程建设
 *   488 - 公司事务          489 - 培训             490 - 物流
 *
 * 与阿里巴巴爬虫的区别:
 *   - 蚂蚁是单站 (talent.antgroup.com)，无需多子站并行
 *   - API 路径不同: 蚂蚁为 /api/social/position/search，阿里为 /position/search
 *   - API 后端域名: hrcareersweb.antgroup.com (阿里各子站直接在各自域名下提供 /position/search)
 *   - CSRF 机制不同: 蚂蚁用 ctoken cookie（值 bigfish_ctoken_xxx）+ ctoken 参数，阿里用 XSRF-TOKEN + _csrf 参数
 *   - 代理方式不同: 蚂蚁使用 tern 框架 JS 级代理，需要 page.route() 模拟；阿里子站由 nginx 直接路由
 *   - channel 为 "group_official_site"
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";
import { ANTGROUP_CATEGORIES } from "../categories";

const PAGE_SIZE = 20;

/** 蚂蚁集团招聘后端 API 域名（tern 代理的实际目标） */
const BACKEND_API_BASE = "https://hrcareersweb.antgroup.com";

// === API 接口类型定义 ===

/** position/search API 请求体 */
interface AntSearchBody {
  channel: string;
  language: string;
  batchId: string;
  categories: string;
  deptCodes: string[];
  key: string;
  pageIndex: number;
  pageSize: number;
  regions: string;
  subCategories: string;
  shareType: string;
  shareId: string;
  myReferralShareCode: string;
}

/** position/search API 返回的职位数据 */
interface AntPosition {
  id: number;
  name: string;
  description: string;
  requirement: string;
  workLocations: string[];
  categories: string[];
  categoryName: string | null;
  positionType: string | null;
  department: string | null;
  experience: string | null;
  degree: string | null;
  batchName: string | null;
  batchType: string | null;
  publishTime: string | null;
  tags: string[];
}

/** position/search API 响应（顶层结构） */
interface AntSearchResponse {
  success: boolean;
  errorMsg: string | null;
  errorCode: string | null;
  content: AntPosition[] | null;
  totalCount: number;
  pageSize: number;
  currentPage: number;
}

export class AntgroupCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "antgroup",
    name: "蚂蚁集团",
    company: "蚂蚁集团",
    logo: "https://gw.alipayobjects.com/mdn/rms_5c2e9d/afts/img/A*gGPpRZRr2WYAAAAAAAAAAAAAARQnAQ",
    baseUrl: "https://talent.antgroup.com",
    enabled: true,
    description: "蚂蚁集团（支付宝母公司）社会招聘",
  };

  /**
   * 从页面 cookie 中提取 ctoken
   * cookie 名为 "ctoken"，值的格式为 "bigfish_ctoken_xxxx"
   * 蚂蚁的 API 需要在请求 URL 中附带 ctoken=<value> 参数
   */
  private async getCSRFToken(page: Page): Promise<string> {
    const cookies = await page.context().cookies(this.source.baseUrl);
    const ctokenCookie = cookies.find((c) => c.name === "ctoken");
    return ctokenCookie?.value || "";
  }

  /**
   * 构建搜索请求体
   */
  private buildSearchBody(
    pageIndex: number,
    categories: string,
    subCategories: string
  ): AntSearchBody {
    return {
      channel: "group_official_site",
      language: "zh",
      batchId: "",
      categories,
      deptCodes: [],
      key: "",
      pageIndex,
      pageSize: PAGE_SIZE,
      regions: "",
      subCategories,
      shareType: "",
      shareId: "",
      myReferralShareCode: "",
    };
  }

  /**
   * 设置 Playwright page.route() 拦截，模拟 tern 框架的 API 代理
   *
   * 拦截浏览器中对 /api/social/position/search 的请求，将其转发到
   * hrcareersweb.antgroup.com/api/social/position/search（后端实际地址）。
   * 这是因为 talent.antgroup.com 的 tern 框架代理仅在 JS runtime 层工作，
   * 原生 fetch 无法利用，需要在 Playwright 层面模拟。
   */
  private async setupApiRoute(page: Page): Promise<void> {
    await page.route("**/api/social/position/search**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      // 将域名替换为后端 API 域名，保留路径和查询参数
      const backendUrl = `${BACKEND_API_BASE}${url.pathname}${url.search}`;

      console.log(`[${this.source.name}] route 拦截: ${url.pathname} → ${backendUrl}`);

      try {
        // 使用 Playwright 的 route.fetch() 发送请求到后端（绕过 CORS 和 Referer 检查）
        const response = await route.fetch({
          url: backendUrl,
          headers: {
            ...request.headers(),
            // 设置正确的 Referer 和 Origin，通过后端的 Referer 检查
            referer: `${this.source.baseUrl}/`,
            origin: this.source.baseUrl,
          },
        });
        await route.fulfill({ response });
      } catch (err) {
        console.error(`[${this.source.name}] route 转发失败:`, err);
        await route.abort("failed");
      }
    });
  }

  /**
   * 通过 page.evaluate + fetch 主动调用搜索 API
   *
   * 在浏览器上下文中发起请求，自动携带 cookie 和安全上下文。
   * 请求路径为 /api/social/position/search（蚂蚁集团实际 API 路径），
   * 会被 setupApiRoute() 设置的 page.route() 拦截并转发到后端。
   */
  private async fetchSearchApi(
    page: Page,
    pageIndex: number,
    csrfToken: string,
    categories: string,
    subCategories: string
  ): Promise<AntSearchResponse | null> {
    const body = this.buildSearchBody(pageIndex, categories, subCategories);
    const apiUrl = `${this.source.baseUrl}/api/social/position/search?ctoken=${encodeURIComponent(csrfToken)}`;

    console.log(
      `[${this.source.name}] 调用 API: pageIndex=${pageIndex}, categories=${categories}`
    );

    try {
      const response = await page.evaluate(
        async ({ url, body }: { url: string; body: AntSearchBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain, */*",
            },
            body: JSON.stringify(body),
          });
          // 防御性处理：先检查 HTTP 状态和 Content-Type，避免非 JSON 响应导致 SyntaxError
          if (!res.ok) {
            const text = await res.text();
            return { success: false, errorMsg: `HTTP ${res.status}: ${text.substring(0, 200)}`, content: null };
          }
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await res.text();
            return { success: false, errorMsg: `Non-JSON response (${contentType}): ${text.substring(0, 200)}`, content: null };
          }
          return res.json();
        },
        { url: apiUrl, body }
      );

      if (response?.success && response?.content) {
        return response as AntSearchResponse;
      }

      console.log(
        `[${this.source.name}] API 返回异常:`,
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log(`[${this.source.name}] API 调用失败:`, err);
      return null;
    }
  }

  /**
   * 将 API 返回的位置数据转换为 JobPosting
   */
  private positionToJob(pos: AntPosition): Partial<JobPosting> {
    const location = pos.workLocations?.join("、") || "未知";
    const detailUrl = `${this.source.baseUrl}/off-campus/position-detail?lang=zh&positionId=${pos.id}`;
    const company = pos.department
      ? `蚂蚁集团 - ${pos.department}`
      : this.source.company;

    return {
      id: `${this.source.id}_${pos.id}`,
      title: pos.name,
      source: this.source.id,
      company,
      sourceId: String(pos.id),
      detailUrl,
      location,
      description: pos.description || "暂无描述",
      requirements: pos.requirement || "暂无要求",
      category: pos.categories?.join(" / ") || "",
      crawledAt: new Date().toISOString(),
    };
  }

  /**
   * 处理一批 API 返回的职位数据：过滤校招/实习，去重，转换格式
   */
  private processPositions(
    positions: AntPosition[],
    seenIds: Set<string>
  ): Partial<JobPosting>[] {
    const jobs: Partial<JobPosting>[] = [];

    if (!Array.isArray(positions)) {
      console.warn(
        `[${this.source.name}] positions 非数组:`,
        typeof positions
      );
      return jobs;
    }

    for (const pos of positions) {
      const jobId = String(pos.id);
      if (seenIds.has(jobId)) continue;
      seenIds.add(jobId);

      // 过滤校招/实习岗位，只保留社招
      // API 中 positionType 或 batchType 可能标识岗位类型
      if (
        pos.positionType === "freshman" ||
        pos.positionType === "internship" ||
        pos.positionType === "project" ||
        pos.batchType === "freshman" ||
        pos.batchType === "internship"
      ) {
        continue;
      }

      jobs.push(this.positionToJob(pos));
    }

    return jobs;
  }

  /**
   * 将 Partial<JobPosting> 转换为完整 JobPosting（用于回调）
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
   * 抓取职位列表（核心方法）
   *
   * 策略：
   * 1. 访问社招列表页建立 session + CSRF
   * 2. 按大类分组查询（用户选中的子分类 ID 按所属大类分组）
   * 3. 每个大类分组并行翻页
   * 4. 增量推送数据
   *
   * @param maxJobs - 最大抓取数量（Infinity 表示全部抓取）
   * @param selectedCategoryIds - 用户选中的子分类 ID 列表（可选）
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
  ): Promise<Partial<JobPosting>[]> {
    // 按大类分组子分类 ID（阿里系 API 要求 categories 传大类 ID，subCategories 传子分类 ID）
    interface CategoryQuery {
      categories: string;
      subCategories: string;
    }
    let queries: CategoryQuery[];

    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      const groupByParent = new Map<string, string[]>();
      for (const subId of selectedCategoryIds) {
        for (const cat of ANTGROUP_CATEGORIES) {
          if (cat.subCategories.some((s) => s.id === subId)) {
            if (!groupByParent.has(cat.id)) {
              groupByParent.set(cat.id, []);
            }
            groupByParent.get(cat.id)!.push(subId);
            break;
          }
        }
      }

      queries = [];
      for (const [parentId, subIds] of groupByParent) {
        queries.push({
          categories: parentId,
          subCategories: subIds.join(","),
        });
      }
      if (queries.length === 0) {
        // 默认查技术大类
        queries = [{ categories: "131", subCategories: "" }];
      }
    } else {
      // 未选择时，默认查询技术大类下所有子分类
      queries = [{ categories: "131", subCategories: "" }];
    }

    const allJobs: Partial<JobPosting>[] = [];
    const seenIds = new Set<string>();

    // 1. 访问社招列表页建立 session + CSRF
    const page = await this.newPage();

    // 设置 API 路由拦截：将 /position/search 请求转发至后端
    await this.setupApiRoute(page);

    const listUrl = `${this.source.baseUrl}/off-campus?lang=zh`;
    console.log(`[${this.source.name}] 初始化: ${listUrl}`);
    await this.safeGoto(page, listUrl);
    await this.randomDelay(1500, 2500);

    // 提取 CSRF token
    const csrfToken = await this.getCSRFToken(page);
    if (!csrfToken) {
      console.log(`[${this.source.name}] 未获取到 CSRF token，尝试继续...`);
    } else {
      console.log(
        `[${this.source.name}] CSRF token: ${csrfToken.substring(0, 8)}...`
      );
    }

    // 2. 按每个大类分别查询
    for (const query of queries) {
      if (allJobs.length >= maxJobs) break;

      // 第一页请求，获取 totalCount
      const firstPageData = await this.fetchSearchApi(
        page,
        1,
        csrfToken,
        query.categories,
        query.subCategories
      );

      if (
        !firstPageData?.content ||
        firstPageData.content.length === 0
      ) {
        console.log(
          `[${this.source.name}] 分类 ${query.categories} 无岗位数据，跳过`
        );
        continue;
      }

      const totalCount = firstPageData.totalCount;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      console.log(
        `[${this.source.name}] 分类 ${query.categories} 共 ${totalCount} 个岗位，${totalPages} 页`
      );

      // 处理第一页
      const firstPageJobs = this.processPositions(
        firstPageData.content,
        seenIds
      );
      allJobs.push(...firstPageJobs);

      // 增量推送第一批数据
      if (firstPageJobs.length > 0 && this.onJobsBatch) {
        this.onJobsBatch(firstPageJobs.map((j) => this.partialToFull(j)));
      }

      if (this.onProgress) {
        const targetCount = Math.min(totalCount, maxJobs);
        this.onProgress(
          allJobs.length,
          targetCount,
          `已抓取 ${allJobs.length}/${targetCount} 个职位`
        );
      }

      if (totalPages <= 1) continue;

      // 3. 并行翻页
      const LIST_CONCURRENCY = 5;
      const remainingPages = Array.from(
        { length: totalPages - 1 },
        (_, idx) => idx + 2
      );

      for (
        let pi = 0;
        pi < remainingPages.length && allJobs.length < maxJobs;
        pi += LIST_CONCURRENCY
      ) {
        const pageBatch = remainingPages.slice(pi, pi + LIST_CONCURRENCY);

        const pagePromises = pageBatch.map(async (pageIndex) => {
          try {
            return await this.fetchSearchApi(
              page,
              pageIndex,
              csrfToken,
              query.categories,
              query.subCategories
            );
          } catch (err) {
            console.error(
              `[${this.source.name}] pageIndex=${pageIndex} 请求失败:`,
              err
            );
            return null;
          }
        });

        const pageResults = await Promise.all(pagePromises);

        const batchJobs: Partial<JobPosting>[] = [];
        for (const pageData of pageResults) {
          if (
            !pageData?.content ||
            pageData.content.length === 0
          ) {
            continue;
          }
          const pageJobs = this.processPositions(
            pageData.content,
            seenIds
          );
          allJobs.push(...pageJobs);
          batchJobs.push(...pageJobs);
        }

        // 增量推送
        if (batchJobs.length > 0 && this.onJobsBatch) {
          this.onJobsBatch(batchJobs.map((j) => this.partialToFull(j)));
        }
        if (this.onProgress) {
          const targetCount = Math.min(totalCount, maxJobs);
          this.onProgress(
            allJobs.length,
            targetCount,
            `已抓取 ${allJobs.length}/${targetCount} 个职位`
          );
        }

        // 翻页批次间短延迟
        if (pi + LIST_CONCURRENCY < remainingPages.length) {
          await this.randomDelay(300, 800);
        }
      }
    }

    // 取消 route 拦截后再关闭 page，避免前端残留请求在关闭后触发 route.fetch 报错
    const unrouteApiPath = this.recruitType === "campus" ? "campus" : "social";
    await page.unroute(`**/api/${unrouteApiPath}/position/search**`);
    await page.close();

    console.log(
      `[${this.source.name}] 列表抓取完成，共 ${allJobs.length} 个职位`
    );

    // 返回空数组：所有数据已通过 onJobsBatch 增量推送完成，
    // 无需再经过 base.ts 的 crawlDetailsInParallel
    return [];
  }

  /**
   * 抓取单个职位详情
   * API 已返回完整的 description + requirement，直接返回
   */
  protected async crawlJobDetail(
    _page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    return this.partialToFull(partialJob);
  }
}
