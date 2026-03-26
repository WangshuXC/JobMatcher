/**
 * 阿里巴巴集团招聘爬虫
 *
 * 阿里招聘按子集团独立建站，但共享统一的前端架构 (new-careers-portal):
 * - 前端: React + Recore
 * - 搜索 API: POST /position/search (JSON, 需要 XSRF-TOKEN)
 * - 每个子站的 window.__sysconfig 包含 circleCode、channel 等配置
 *
 * 爬取策略:
 * 1. 通过 Playwright 打开子站社招列表页，建立完整 session + CSRF
 * 2. 从 cookie 中提取 XSRF-TOKEN，通过 page.evaluate + fetch 主动调用 API
 * 3. 在请求体中传入 categories + subCategories 精确筛选前端岗位
 * 4. API 返回完整的 description + requirement，无需抓详情页
 *
 * 分类参数:
 *   - categories: "130" = 技术类
 *   - subCategories: "133" = 前端开发
 *
 * 目前爬取的子集团（社招岗位最多的几个）:
 *   - 阿里云 (careers.aliyun.com)
 *   - 淘天集团 (talent.taotian.com)
 *   - 阿里国际数字商业 (aidc-jobs.alibaba.com)
 *   - 菜鸟集团 (talent.cainiao.com)
 *   - 钉钉 (talent.dingtalk.com)
 *   - 通义实验室 (careers-tongyi.alibaba.com)
 *   - 高德地图 (talent.amap.com)
 *   - 千问C端事业群 (talent.quark.cn)
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";
import { ALIBABA_CATEGORIES } from "../categories";

const PAGE_SIZE = 20;

/** 技术类大类 ID */
const CATEGORY_TECH = "130";

/** 前端开发子类 ID */
const SUB_CATEGORY_FRONTEND = "133";

/*
 * 阿里巴巴招聘完整分类参考 (来源: /category/list API):
 *
 * 技术类 (categories: "130"):
 *   133 - 前端             135 - 运维             136 - 开发
 *   137 - 质量保证          407 - 安全             408 - 数据
 *   409 - 算法             410 - 综合             411 - 综合管理
 *   511 - 地图             702 - 基础平台          703 - 无线（端）
 *   704 - 综合             747 - 研究             764 - 多媒体技术
 *   769 - 游戏技术          798 - 芯片             811 - 方案与服务
 *
 * 产品类 (categories: "97"):
 *   403 - 平台型           404 - 商业型           405 - 用户型
 *   406 - 综合管理
 *
 * 运营类 (categories: "103"):
 *   108 - 商家运营          474 - 安全运营          475 - 产品运营
 *   476 - 规则管理          477 - 行业运营          478 - 内容运营
 *   479 - 频道/类目运营     480 - 无线产品运营      481 - 无线内容运营
 *   482 - 无线运营综合      483 - 运营综合          484 - 综合管理
 *   529 - 现场娱乐运营      757 - 用户运营          758 - 产品运营
 *   759 - 商家商品运营      763 - 商业伙伴运营      834 - 经营管理
 *   846 - 行业运营（商业化）  847 - 商家运营（商业化）
 *
 * 设计类 (categories: "112"):
 *   113 - 交互             114 - 视觉             115 - 用户体验与研究
 *   444 - 综合管理          802 - 创意设计
 *
 * 数据类 (categories: "143"):
 *   446 - 商业数据分析      447 - 网站运营数据分析    448 - 综合管理
 *
 * 市场拓展 (categories: "124"):
 *   126 - 市场             445 - BD               716 - 技术业务发展
 *   812 - 行业             824 - 大客户BD          825 - 行业/区域BD
 *
 * 销售类 (categories: "152"):
 *   156 - 销售策划          461 - Incall           462 - 产品运营
 *   463 - 电销             464 - 渠道管理          465 - 外贸服务
 *   466 - 销售品控          467 - 业务运营          468 - 业务支持
 *   469 - 运营             470 - 在线销售          471 - 直销
 *   472 - 资源管理          473 - 综合管理          512 - 票务策划
 *   513 - 票务管理
 *
 * 综合类 (categories: "157"):
 *   159 - 法务             162 - 人力资源          163 - 行政
 *   165 - 采购             168 - 综合管理          180 - 其它
 *   485 - IT              486 - 财务及内控         487 - 工程建设
 *   488 - 公司事务          489 - 培训             490 - 物流
 *
 * 客服类 (categories: "117"):
 *   427 - 服务安全          428 - 服务运营          429 - 技术服务
 *   430 - 交易保障          431 - 客服培训          432 - 客户接待
 *   433 - 客户支持          434 - 流程优化          435 - 品质提升
 *   436 - 热线&在线        437 - 商家管理          438 - 外包运营
 *   439 - 现场管理          440 - 业务分析与运营     441 - 质量保证
 *   442 - 综合服务          443 - 综合管理
 */

/** 阿里子站配置 */
interface AliSubsite {
  /** 子站名称 */
  name: string;
  /** 子站域名 */
  domain: string;
  /** 社招列表页路径（用于建立 session） */
  listPath: string;
  /** 子站的 channel 标识 */
  channel: string;
}

/** 可爬取的子站列表（按社招岗位量排序） */
const SUBSITES: AliSubsite[] = [
  {
    name: "阿里云",
    domain: "https://careers.aliyun.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "淘天集团",
    domain: "https://talent.taotian.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "阿里国际数字商业",
    domain: "https://aidc-jobs.alibaba.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "菜鸟集团",
    domain: "https://talent.cainiao.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "钉钉",
    domain: "https://talent.dingtalk.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "通义实验室",
    domain: "https://careers-tongyi.alibaba.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "高德地图",
    domain: "https://talent.amap.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
  {
    name: "千问C端事业群",
    domain: "https://talent.quark.cn",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
    channel: "group_official_site",
  },
];

/** position/search API 请求体 */
interface AliSearchBody {
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
interface AliPosition {
  id: number;
  name: string;
  description: string;
  requirement: string;
  workLocations: string[];
  categoryName: string;
  categoryType: string;
  department: string | null;
  experience: string | null;
  degree: string | null;
  circleNames: string[];
  circleCodeList: string[];
  batchName: string | null;
  modifyTime: number;
}

/** position/search API 响应 */
interface AliSearchResponse {
  success: boolean;
  errorMsg: string | null;
  content: {
    datas: AliPosition[];
    totalCount: number;
    pageSize: number;
    pageIndex: number;
  } | null;
}

export class AlibabaCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "alibaba",
    name: "阿里巴巴",
    company: "阿里巴巴集团",
    logo: "https://talent.alibaba.com/favicon.ico",
    baseUrl: "https://talent.alibaba.com",
    enabled: true,
    description: "阿里巴巴集团社会招聘 - 涵盖阿里云、淘天、国际商业、菜鸟等子集团",
  };

  /**
   * 从页面 cookie 中提取 XSRF-TOKEN
   * 阿里的 API 需要在请求 URL 中附带 _csrf 参数
   *
   * 注意：必须按子站域名过滤 cookie，否则会跨域复用第一个子站的 token，
   * 导致后续子站请求 403 Forbidden。
   */
  private async getCSRFToken(
    page: Page,
    subsiteDomain: string
  ): Promise<string> {
    // 传入子站域名，只获取该域名下的 cookie
    const cookies = await page.context().cookies(subsiteDomain);
    const xsrfCookie = cookies.find((c) => c.name === "XSRF-TOKEN");
    return xsrfCookie?.value || "";
  }

  /**
   * 构建搜索请求体
   */
  private buildSearchBody(
    subsite: AliSubsite,
    pageIndex: number,
    categories: string = CATEGORY_TECH,
    subCategories: string = SUB_CATEGORY_FRONTEND
  ): AliSearchBody {
    return {
      channel: subsite.channel,
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
   * 通过 page.evaluate + fetch 主动调用搜索 API
   * 在浏览器上下文中发起请求，自动携带 cookie 和 baxia 安全上下文
   */
  private async fetchSearchApi(
    page: Page,
    subsite: AliSubsite,
    pageIndex: number,
    csrfToken: string,
    categories: string = CATEGORY_TECH,
    subCategories: string = SUB_CATEGORY_FRONTEND
  ): Promise<AliSearchResponse | null> {
    const body = this.buildSearchBody(subsite, pageIndex, categories, subCategories);
    const apiUrl = `${subsite.domain}/position/search?_csrf=${encodeURIComponent(csrfToken)}`;

    console.log(
      `[阿里巴巴] ${subsite.name} 调用 API: pageIndex=${pageIndex}`
    );

    try {
      const response = await page.evaluate(
        async ({ url, body }: { url: string; body: AliSearchBody }) => {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json, text/plain, */*",
            },
            body: JSON.stringify(body),
          });
          return res.json();
        },
        { url: apiUrl, body }
      );

      if (response?.success && response?.content) {
        return response as AliSearchResponse;
      }

      console.log(
        `[阿里巴巴] ${subsite.name} API 返回异常:`,
        JSON.stringify(response).substring(0, 200)
      );
      return null;
    } catch (err) {
      console.log(`[阿里巴巴] ${subsite.name} API 调用失败:`, err);
      return null;
    }
  }

  /**
   * 将 API 返回的位置数据转换为 JobPosting
   */
  private positionToJob(
    pos: AliPosition,
    subsite: AliSubsite
  ): Partial<JobPosting> {
    const location = pos.workLocations?.join("、") || "未知";
    const detailUrl = `${subsite.domain}/off-campus/position-detail?lang=zh&positionId=${pos.id}`;
    const company = pos.circleNames?.join(" / ") || subsite.name;

    return {
      id: `${this.source.id}_${pos.id}`,
      title: pos.name,
      source: this.source.id,
      company: `阿里巴巴 - ${company}`,
      sourceId: String(pos.id),
      detailUrl,
      location,
      description: pos.description || "暂无描述",
      requirements: pos.requirement || "暂无要求",
      category: pos.categoryName || "",
      crawledAt: new Date().toISOString(),
    };
  }

  /**
   * 处理一批 API 返回的职位数据：过滤校招/实习，去重，转换格式
   */
  private processPositions(
    positions: AliPosition[],
    subsite: AliSubsite,
    seenIds: Set<string>
  ): Partial<JobPosting>[] {
    const jobs: Partial<JobPosting>[] = [];

    // 防御性检查：API 返回的 datas 可能为 undefined/null/非数组
    if (!Array.isArray(positions)) {
      console.warn(
        `[阿里巴巴] ${subsite.name} positions 非数组:`,
        typeof positions
      );
      return jobs;
    }

    for (const pos of positions) {
      const jobId = String(pos.id);
      if (seenIds.has(jobId)) continue;
      seenIds.add(jobId);

      // 过滤校招/实习岗位，只保留社招
      if (
        pos.categoryType === "freshman" ||
        pos.categoryType === "internship" ||
        pos.categoryType === "project"
      ) {
        continue;
      }

      jobs.push(this.positionToJob(pos, subsite));
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
      company: partial.company || "阿里巴巴集团",
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
   * 从所有子站并行抓取职位列表
   *
   * 策略：
   * 1. 并行初始化多个子站（每个子站独立 page + session + CSRF）
   * 2. 每个子站内并行翻页
   * 3. 增量推送数据
   *
   * @param maxJobs - 最大抓取数量（Infinity 表示全部抓取）
   * @param selectedCategoryIds - 用户选中的大类 ID 列表（可选）
   */
  protected async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
  ): Promise<Partial<JobPosting>[]> {
    // selectedCategoryIds 现在直接是子分类 ID 列表
    // 阿里 API 需要按大类分组查询：categories 传大类 ID，subCategories 传子分类 ID
    interface CategoryQuery {
      categories: string;
      subCategories: string;
    }
    let queries: CategoryQuery[];

    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      // 按大类分组子分类 ID
      const groupByParent = new Map<string, string[]>();
      for (const subId of selectedCategoryIds) {
        for (const cat of ALIBABA_CATEGORIES) {
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
        queries = [{ categories: CATEGORY_TECH, subCategories: SUB_CATEGORY_FRONTEND }];
      }
    } else {
      queries = [{ categories: CATEGORY_TECH, subCategories: SUB_CATEGORY_FRONTEND }];
    }

    const allJobs: Partial<JobPosting>[] = [];
    const seenIds = new Set<string>();

    // 并行处理子站（控制并发数）
    const SUBSITE_CONCURRENCY = 4;

    for (let i = 0; i < SUBSITES.length && allJobs.length < maxJobs; i += SUBSITE_CONCURRENCY) {
      const subsiteBatch = SUBSITES.slice(i, i + SUBSITE_CONCURRENCY);
      console.log(`\n[阿里巴巴] === 并行处理子站批次: ${subsiteBatch.map((s) => s.name).join(", ")} ===`);

      const subsitePromises = subsiteBatch.map(async (subsite) => {
        const subsiteJobs: Partial<JobPosting>[] = [];

        try {
          // 每个子站创建独立 page，建立 session + CSRF
          const page = await this.newPage();
          const typeParam = this.recruitType === "campus" ? "campus" : "experienced";
          const url = `${subsite.domain}/off-campus/position-list?lang=zh&type=${typeParam}`;
          console.log(`[阿里巴巴] 初始化子站 ${subsite.name}: ${url}`);
          await this.safeGoto(page, url);
          await this.randomDelay(1000, 2000);

          // 提取当前子站域名下的 CSRF token
          const csrfToken = await this.getCSRFToken(page, subsite.domain);
          if (!csrfToken) {
            console.log(`[阿里巴巴] ${subsite.name} 未获取到 CSRF token，跳过`);
            await page.close();
            return subsiteJobs;
          }
          console.log(`[阿里巴巴] ${subsite.name} CSRF token: ${csrfToken.substring(0, 8)}...`);

          // 按每个大类分别查询
          for (const query of queries) {
            // 第一页请求，获取 totalCount
            const firstPageData = await this.fetchSearchApi(
              page, subsite, 1, csrfToken, query.categories, query.subCategories
            );

            if (!firstPageData?.content?.datas || firstPageData.content.datas.length === 0) {
              console.log(`[阿里巴巴] ${subsite.name} 分类 ${query.categories} 无岗位数据，跳过`);
              continue;
            }

            const totalCount = firstPageData.content.totalCount;
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            console.log(`[阿里巴巴] ${subsite.name} 分类 ${query.categories} 共 ${totalCount} 个岗位，${totalPages} 页`);

            // 处理第一页
            const firstPageJobs = this.processPositions(firstPageData.content.datas, subsite, seenIds);
            subsiteJobs.push(...firstPageJobs);

            // 调用回调推送第一批数据
            if (firstPageJobs.length > 0 && this.onJobsBatch) {
              this.onJobsBatch(firstPageJobs.map((j) => this.partialToFull(j)));
            }

            if (totalPages <= 1) continue;

            // 并行翻页（子站内）
            const LIST_PAGE_CONCURRENCY = 5;
            const remainingPages = Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2);

            for (let pi = 0; pi < remainingPages.length; pi += LIST_PAGE_CONCURRENCY) {
              const pageBatch = remainingPages.slice(pi, pi + LIST_PAGE_CONCURRENCY);

              const pagePromises = pageBatch.map(async (pageIndex) => {
                // 复用同一个 page 的 session（串行请求同 page）
                // 对于阿里，由于 CSRF token 绑定到 cookie，我们需要在同一 page 上发请求
                return this.fetchSearchApi(
                  page, subsite, pageIndex, csrfToken, query.categories, query.subCategories
                );
              });

              const pageResults = await Promise.all(pagePromises);

              for (const pageData of pageResults) {
                if (!pageData?.content?.datas || pageData.content.datas.length === 0) continue;
                const pageJobs = this.processPositions(pageData.content.datas, subsite, seenIds);
                subsiteJobs.push(...pageJobs);

                if (pageJobs.length > 0 && this.onJobsBatch) {
                  this.onJobsBatch(pageJobs.map((j) => this.partialToFull(j)));
                }
              }

              // 翻页批次间短延迟
              if (pi + LIST_PAGE_CONCURRENCY < remainingPages.length) {
                await this.randomDelay(200, 500);
              }
            }
          }

          await page.close();
        } catch (err) {
          console.error(`[阿里巴巴] ${subsite.name} 爬取异常:`, err);
        }

        console.log(`[阿里巴巴] ${subsite.name} 获取 ${subsiteJobs.length} 个岗位`);
        return subsiteJobs;
      });

      const subsiteResults = await Promise.all(subsitePromises);

      for (const jobs of subsiteResults) {
        allJobs.push(...jobs);
      }

      // 报告进度
      if (this.onProgress) {
        this.onProgress(allJobs.length, 0, `已抓取 ${allJobs.length} 个职位（${Math.min(i + SUBSITE_CONCURRENCY, SUBSITES.length)}/${SUBSITES.length} 个子站）`);
      }

      // 子站批次间延迟
      if (i + SUBSITE_CONCURRENCY < SUBSITES.length && allJobs.length < maxJobs) {
        await this.randomDelay(500, 1000);
      }
    }

    console.log(`\n[阿里巴巴] 总计获取 ${allJobs.length} 个岗位`);

    // 返回空数组：所有数据已通过 onJobsBatch 增量推送完成，
    // 无需再经过 base.ts 的 crawlDetailsInParallel（避免重复推送）
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
