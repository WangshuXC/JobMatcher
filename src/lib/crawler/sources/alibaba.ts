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
 * 2. 使用 page.route() 拦截页面自身的 /position/search API 响应
 *    — 这样请求自带 baxia 安全上下文，不会被反爬拦截
 * 3. 通过 DOM 操作触发翻页，每次翻页都会拦截到 API 响应数据
 * 4. API 返回完整的 description + requirement，无需抓详情页
 *
 * 目前爬取的子集团（社招岗位最多的几个）:
 *   - 阿里云 (careers.aliyun.com) - 1100+ 职位
 *   - 淘天集团 (talent.taotian.com)
 *   - 阿里国际数字商业 (aidc-jobs.alibaba.com)
 *   - 菜鸟集团 (talent.cainiao.com)
 *   - 钉钉 (talent.dingtalk.com)
 *   - 通义实验室 (careers-tongyi.alibaba.com)
 */
import { Page, Response as PWResponse } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

const PAGE_SIZE = 10;

/** 阿里子站配置 */
interface AliSubsite {
  /** 子站名称 */
  name: string;
  /** 子站域名 */
  domain: string;
  /** 社招列表页路径 */
  listPath: string;
}

/** 可爬取的子站列表（按社招岗位量排序） */
const SUBSITES: AliSubsite[] = [
  {
    name: "阿里云",
    domain: "https://careers.aliyun.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "淘天集团",
    domain: "https://talent.taotian.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "阿里国际数字商业",
    domain: "https://aidc-jobs.alibaba.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "菜鸟集团",
    domain: "https://talent.cainiao.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "钉钉",
    domain: "https://talent.dingtalk.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "通义实验室",
    domain: "https://careers-tongyi.alibaba.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "高德地图",
    domain: "https://talent.amap.com",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
  {
    name: "千问C端事业群",
    domain: "https://talent.quark.cn",
    listPath: "/off-campus/position-list?lang=zh&type=experienced",
  },
];

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

/** 响应监听器接口 */
interface ResponseListener {
  waitForResponse: () => Promise<AliSearchResponse | null>;
  cleanup: () => void;
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
   * 设置响应监听器，通过 page.on('response') 监听 /position/search API 响应。
   *
   * 之前使用 page.route() + route.fetch() + route.fulfill() 拦截模式，
   * 但 route.fetch() 使用 Node.js 网络栈重新发起请求，部分子站（如淘天集团）
   * 的服务器存在 TLS 版本兼容问题，导致 SSL 握手失败（EPROTO ssl3_get_record wrong version number）。
   *
   * 改为 page.on('response') 被动监听模式，不干预原始请求/响应流，
   * 直接从浏览器返回的响应中读取数据，彻底规避 SSL 兼容性问题。
   */
  private setupResponseListener(
    page: Page
  ): ResponseListener {
    // 使用队列模式：handler 将结果推入队列，waitForResponse 从队列取出
    const dataQueue: AliSearchResponse[] = [];
    let pendingResolve: ((data: AliSearchResponse | null) => void) | null = null;

    const handler = async (response: PWResponse) => {
      const url = response.url();
      if (!url.includes("/position/search")) return;

      try {
        const body = await response.text();
        const data = JSON.parse(body) as AliSearchResponse;

        if (pendingResolve) {
          // 有等待中的 waitForResponse 调用，直接 resolve
          const resolve = pendingResolve;
          pendingResolve = null;
          resolve(data);
        } else {
          // 没有等待者，入队
          dataQueue.push(data);
        }
      } catch {
        if (pendingResolve) {
          const resolve = pendingResolve;
          pendingResolve = null;
          resolve(null);
        }
      }
    };

    page.on("response", handler);

    return {
      waitForResponse: () => {
        // 如果队列中已有数据（handler 先于 waitForResponse 调用的情况），直接返回
        if (dataQueue.length > 0) {
          return Promise.resolve(dataQueue.shift()!);
        }
        // 否则等待下一个 handler 触发
        return new Promise<AliSearchResponse | null>((resolve) => {
          pendingResolve = resolve;
        });
      },
      cleanup: () => {
        page.off("response", handler);
        pendingResolve = null;
      },
    };
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
   * 访问子站社招列表页，等待初始 API 响应
   * 返回初始数据 + 监听器
   */
  private async initSubsite(
    page: Page,
    subsite: AliSubsite
  ): Promise<{
    initialData: AliSearchResponse | null;
    listener: ResponseListener;
  } | null> {
    const url = `${subsite.domain}${subsite.listPath}`;
    console.log(`[阿里巴巴] 初始化子站 ${subsite.name}: ${url}`);

    try {
      // 先设置响应监听器
      const listener = this.setupResponseListener(page);

      // 导航到页面
      await this.safeGoto(page, url);

      // 等待初始 API 响应（页面加载时会自动发一次 position/search）
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 20000)
      );
      const initialData = await Promise.race([
        listener.waitForResponse(),
        timeoutPromise,
      ]);

      if (!initialData?.success || !initialData?.content) {
        console.log(
          `[阿里巴巴] ${subsite.name} 初始数据获取失败`
        );
        listener.cleanup();
        return null;
      }

      console.log(
        `[阿里巴巴] ${subsite.name} 初始化成功: 共 ${initialData.content.totalCount} 个职位`
      );

      return { initialData, listener };
    } catch (err) {
      console.error(`[阿里巴巴] 初始化子站 ${subsite.name} 失败:`, err);
      return null;
    }
  }

  /**
   * 在页面上触发翻页（点击"下一页"按钮）
   */
  private async clickNextPage(page: Page): Promise<boolean> {
    try {
      // 阿里招聘页面的下一页按钮
      const nextButton = await page.$(
        '.next-pagination .next-next:not(.next-btn-disabled), .next-pagination .next-next:not([disabled])'
      );
      if (!nextButton) {
        // 尝试备用选择器
        const altNext = await page.$(
          'button.next-next, .next-pagination-item.next-next'
        );
        if (!altNext) return false;
        await altNext.click();
        return true;
      }

      // 检查是否已禁用
      const isDisabled = await nextButton.evaluate(
        (el) => el.classList.contains("next-btn-disabled") || (el as HTMLButtonElement).disabled
      );
      if (isDisabled) return false;

      await nextButton.click();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从所有子站抓取职位列表
   * 通过 page.route() 拦截页面自身 API 响应 + DOM 翻页
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
      let listener: ResponseListener | null = null;
      try {
        const result = await this.initSubsite(page, subsite);
        if (!result) {
          console.log(`[阿里巴巴] 跳过 ${subsite.name}（初始化失败）`);
          continue;
        }

        const { initialData } = result;
        listener = result.listener;

        let subsiteCount = 0;
        let currentPage = 1;
        const totalCount = initialData!.content!.totalCount;
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);

        // 处理第一页数据（已通过初始加载拦截到）
        console.log(
          `[阿里巴巴] ${subsite.name} 第 1/${totalPages} 页 (共 ${totalCount} 个职位)`
        );
        const firstPageDatas = initialData!.content!.datas;
        if (!Array.isArray(firstPageDatas) || firstPageDatas.length === 0) {
          console.log(
            `[阿里巴巴] ${subsite.name} 第 1 页 datas 为空或格式异常，跳过`
          );
          listener.cleanup();
          listener = null;
          continue;
        }
        const firstPageJobs = this.processPositions(
          firstPageDatas,
          subsite,
          seenIds
        );
        allJobs.push(...firstPageJobs);
        subsiteCount += firstPageJobs.length;

        // 调用回调推送第一批数据
        if (firstPageJobs.length > 0 && this.onJobsBatch) {
          this.onJobsBatch(firstPageJobs.map((j) => this.partialToFull(j)));
        }

        // 翻页获取更多数据 — 遍历所有页面直到数据耗尽或达到 maxJobs
        while (currentPage < totalPages && allJobs.length < maxJobs) {
          currentPage++;
          console.log(
            `[阿里巴巴] ${subsite.name} 第 ${currentPage}/${totalPages} 页`
          );

          // 点击下一页
          const hasNext = await this.clickNextPage(page);
          if (!hasNext) {
            console.log(`[阿里巴巴] ${subsite.name} 无更多页面`);
            break;
          }

          // 等待 API 响应
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 15000)
          );
          const pageData = await Promise.race([
            listener.waitForResponse(),
            timeoutPromise,
          ]);

          if (!pageData?.content?.datas || pageData.content.datas.length === 0) {
            console.log(
              `[阿里巴巴] ${subsite.name} 第 ${currentPage} 页无数据，停止`
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

        listener.cleanup();
        listener = null;

        console.log(
          `[阿里巴巴] ${subsite.name} 获取 ${subsiteCount} 个社招职位`
        );
      } catch (err) {
        console.error(
          `[阿里巴巴] ${subsite.name} 爬取异常（已获取 ${allJobs.length} 个职位，继续下一子站）:`,
          err
        );
        // 确保 listener 被清理
        if (listener) {
          try { listener.cleanup(); } catch { /* ignore */ }
        }
      }

      // 子站间延迟
      await this.randomDelay(1500, 3000);
    }

    console.log(
      `\n[阿里巴巴] 总计获取 ${allJobs.length} 个社招职位`
    );
    return maxJobs < Infinity ? allJobs.slice(0, maxJobs) : allJobs;
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
