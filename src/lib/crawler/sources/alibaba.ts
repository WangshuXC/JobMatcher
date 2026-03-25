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

const PAGE_SIZE = 10;

/** 技术类大类 ID */
const CATEGORY_TECH = "130";

/** 前端开发子类 ID */
const SUB_CATEGORY_FRONTEND = "133";

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
    pageIndex: number
  ): AliSearchBody {
    return {
      channel: subsite.channel,
      language: "zh",
      batchId: "",
      categories: CATEGORY_TECH,
      deptCodes: [],
      key: "",
      pageIndex,
      pageSize: PAGE_SIZE,
      regions: "",
      subCategories: SUB_CATEGORY_FRONTEND,
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
    csrfToken: string
  ): Promise<AliSearchResponse | null> {
    const body = this.buildSearchBody(subsite, pageIndex);
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
    };
  }

  /**
   * 从所有子站抓取职位列表
   * 通过 page.evaluate + fetch 主动调用 API，精确筛选前端岗位
   *
   * @param maxJobs - 最大抓取数量（Infinity 表示全部抓取）
   */
  protected async crawlJobList(
    page: Page,
    maxJobs: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];
    const seenIds = new Set<string>();

    for (const subsite of SUBSITES) {
      if (allJobs.length >= maxJobs) break;

      console.log(`\n[阿里巴巴] === ${subsite.name} ===`);

      // 每个子站独立 try-catch，一个子站异常不影响后续子站
      try {
        // 访问子站列表页，建立 session + CSRF
        const url = `${subsite.domain}${subsite.listPath}`;
        console.log(`[阿里巴巴] 初始化子站 ${subsite.name}: ${url}`);
        await this.safeGoto(page, url);
        await this.randomDelay(1000, 2000);

        // 提取当前子站域名下的 CSRF token
        const csrfToken = await this.getCSRFToken(page, subsite.domain);
        if (!csrfToken) {
          console.log(
            `[阿里巴巴] ${subsite.name} 未获取到 CSRF token，跳过`
          );
          continue;
        }
        console.log(
          `[阿里巴巴] ${subsite.name} CSRF token: ${csrfToken.substring(0, 8)}...`
        );

        // 第一页请求，获取 totalCount
        const firstPageData = await this.fetchSearchApi(
          page,
          subsite,
          1,
          csrfToken
        );

        if (
          !firstPageData?.content?.datas ||
          firstPageData.content.datas.length === 0
        ) {
          console.log(
            `[阿里巴巴] ${subsite.name} 无前端岗位数据，跳过`
          );
          continue;
        }

        const totalCount = firstPageData.content.totalCount;
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        console.log(
          `[阿里巴巴] ${subsite.name} 共 ${totalCount} 个前端岗位，${totalPages} 页`
        );

        let subsiteCount = 0;

        // 处理第一页
        const firstPageJobs = this.processPositions(
          firstPageData.content.datas,
          subsite,
          seenIds
        );
        allJobs.push(...firstPageJobs);
        subsiteCount += firstPageJobs.length;

        // 调用回调推送第一批数据
        if (firstPageJobs.length > 0 && this.onJobsBatch) {
          this.onJobsBatch(firstPageJobs.map((j) => this.partialToFull(j)));
        }

        // 翻页获取更多数据
        for (
          let pageIndex = 2;
          pageIndex <= totalPages && allJobs.length < maxJobs;
          pageIndex++
        ) {
          console.log(
            `[阿里巴巴] ${subsite.name} 第 ${pageIndex}/${totalPages} 页`
          );

          const pageData = await this.fetchSearchApi(
            page,
            subsite,
            pageIndex,
            csrfToken
          );

          if (
            !pageData?.content?.datas ||
            pageData.content.datas.length === 0
          ) {
            console.log(
              `[阿里巴巴] ${subsite.name} 第 ${pageIndex} 页无数据，停止`
            );
            break;
          }

          const pageJobs = this.processPositions(
            pageData.content.datas,
            subsite,
            seenIds
          );
          allJobs.push(...pageJobs);
          subsiteCount += pageJobs.length;

          // 调用回调推送这批数据
          if (pageJobs.length > 0 && this.onJobsBatch) {
            this.onJobsBatch(pageJobs.map((j) => this.partialToFull(j)));
          }

          if (allJobs.length >= maxJobs) break;

          // 翻页延迟
          await this.randomDelay(800, 1500);
        }

        console.log(
          `[阿里巴巴] ${subsite.name} 获取 ${subsiteCount} 个前端岗位`
        );
      } catch (err) {
        console.error(
          `[阿里巴巴] ${subsite.name} 爬取异常（已获取 ${allJobs.length} 个职位，继续下一子站）:`,
          err
        );
      }

      // 子站间延迟
      await this.randomDelay(1500, 3000);
    }

    console.log(
      `\n[阿里巴巴] 总计获取 ${allJobs.length} 个前端岗位`
    );
    return maxJobs < Infinity ? allJobs.slice(0, maxJobs) : allJobs;
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
