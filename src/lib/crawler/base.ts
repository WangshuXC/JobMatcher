/**
 * 爬虫基类 - 所有招聘网站爬虫的抽象基类
 *
 * 新增数据源只需：
 * 1. 在 sources/ 下新建文件继承 BaseCrawler
 * 2. 实现 crawlJobList 和 crawlJobDetail 方法
 * 3. 在 registry.ts 中注册
 */
import { chromium, Browser, Page, BrowserContext } from "playwright";
import { JobPosting, CrawlerSource, CrawlResult, CrawlerStatus, RecruitType } from "@/types";

/** 并行抓取的默认并发数 */
const DEFAULT_CONCURRENCY = 20;

export abstract class BaseCrawler {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  /** 当前招聘类型（由 crawl() 方法设置，子类在构建请求时读取） */
  protected recruitType: RecruitType = "social";

  /**
   * 可选的批次回调 — 每当一批职位抓取完成时调用
   * 用于实时增量存储和推送到前端
   */
  onJobsBatch?: (jobs: JobPosting[]) => void;

  /**
   * 可选的进度回调 — 报告当前源的抓取进度
   * @param current - 当前已处理数
   * @param total - 总数
   * @param message - 进度描述
   */
  onProgress?: (current: number, total: number, message: string) => void;

  /** 数据源配置信息 */
  abstract readonly source: CrawlerSource;

  /** 启动浏览器 */
  protected async launchBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "zh-CN",
    });
  }

  /** 创建新页面 */
  protected async newPage(): Promise<Page> {
    if (!this.context) {
      await this.launchBrowser();
    }
    return this.context!.newPage();
  }

  /** 关闭浏览器 */
  protected async closeBrowser(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /** 安全等待 + 超时保护 */
  protected async safeGoto(page: Page, url: string, timeout = 30000): Promise<void> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  }

  /** 随机延迟，防止被反爬 */
  protected async randomDelay(min = 1000, max = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 抓取职位列表 - 返回基本信息和详情页URL列表
   *
   * 子类可通过 `this.newPage()` 创建多个页面实例并行抓取。
   *
   * @param maxJobs - 最大抓取岗位数量
   * @param selectedCategoryIds - 用户选中的大类 ID 列表（可选，undefined 表示使用默认）
   * @param keyword - 搜索关键词（可选）
   */
  protected abstract crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
    keyword?: string
  ): Promise<Partial<JobPosting>[]>;

  /**
   * 抓取单个职位详情
   * 子类必须实现
   */
  protected abstract crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting>;

  /**
   * 并行抓取多个职位详情
   * @param partialJobs - 待抓取详情的职位列表
   * @param concurrency - 并发数
   */
  private async crawlDetailsInParallel(
    partialJobs: Partial<JobPosting>[],
    concurrency: number = DEFAULT_CONCURRENCY
  ): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    const total = partialJobs.length;

    // 分批并行抓取
    for (let i = 0; i < total; i += concurrency) {
      const batch = partialJobs.slice(i, i + concurrency);
      const batchIndex = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(total / concurrency);

      console.log(
        `[${this.source.name}] 并行抓取详情 批次 ${batchIndex}/${totalBatches}（每批 ${batch.length} 个）`
      );

      // 报告进度
      if (this.onProgress) {
        this.onProgress(i, total, `正在抓取详情 批次 ${batchIndex}/${totalBatches}`);
      }

      // 为每个任务创建独立的 page 并并发执行
      const promises = batch.map(async (partial, idx) => {
        const page = await this.newPage();
        try {
          console.log(
            `[${this.source.name}] 抓取详情 (${i + idx + 1}/${total}): ${partial.title}`
          );
          const job = await this.crawlJobDetail(page, partial);
          return job;
        } catch (err) {
          console.error(
            `[${this.source.name}] 抓取详情失败: ${partial.title}`,
            err
          );
          return null;
        } finally {
          await page.close();
        }
      });

      const results = await Promise.all(promises);

      const batchJobs: JobPosting[] = [];
      for (const job of results) {
        if (job) {
          jobs.push(job);
          batchJobs.push(job);
        }
      }

      // 每批完成后调用回调，实现增量推送
      if (batchJobs.length > 0 && this.onJobsBatch) {
        this.onJobsBatch(batchJobs);
      }

      // 报告最新进度
      if (this.onProgress) {
        this.onProgress(Math.min(i + concurrency, total), total, `已抓取详情 ${jobs.length}/${total}`);
      }

      // 批次间随机延迟防反爬
      if (i + concurrency < total) {
        await this.randomDelay(1000, 2000);
      }
    }

    return jobs;
  }

  /**
   * 执行完整的爬取流程
   *
   * 容错策略：crawlJobList 和 crawlDetailsInParallel 分别 try-catch，
   * 任何阶段中途失败都会保留已爬取的数据（通过 onJobsBatch 增量推送 + 存储）。
   *
   * @param maxJobs - 最大抓取岗位数量（0 或不传表示全部抓取）
   * @param concurrency - 详情并行抓取并发数
   * @param selectedCategoryIds - 用户选中的大类 ID 列表（可选，undefined 表示使用默认）
   * @param keyword - 搜索关键词（可选）
   * @param recruitType - 招聘类型：社招 | 校招（默认社招）
   */
  async crawl(
    maxJobs: number = 0,
    concurrency: number = DEFAULT_CONCURRENCY,
    selectedCategoryIds?: string[],
    keyword?: string,
    recruitType: RecruitType = "social"
  ): Promise<CrawlResult> {
    this.recruitType = recruitType;
    const startTime = Date.now();
    let status: CrawlerStatus = "running";
    let jobs: JobPosting[] = [];
    let errorMsg = "";
    // maxJobs <= 0 表示不限制，用 Infinity 方便比较
    const effectiveMax = maxJobs > 0 ? maxJobs : Infinity;

    // 跟踪通过 onJobsBatch 已推送的职位数（用于异常时统计）
    let pushedJobCount = 0;
    const originalCallback = this.onJobsBatch;
    if (originalCallback) {
      this.onJobsBatch = (batchJobs: JobPosting[]) => {
        pushedJobCount += batchJobs.length;
        originalCallback(batchJobs);
      };
    }

    console.log(`[${this.source.name}] 开始爬取，目标 ${maxJobs > 0 ? maxJobs + ' 个岗位' : '全部岗位'}...`);

    try {
      await this.launchBrowser();

      // 第一步：获取职位列表（子类自行管理 page 实例，可并行抓取）
      let partialJobs: Partial<JobPosting>[] = [];
      console.log(`[${this.source.name}] 正在抓取职位列表...`);

      // 报告列表抓取开始
      if (this.onProgress) {
        this.onProgress(0, 0, `正在抓取职位列表...`);
      }

      try {
        partialJobs = await this.crawlJobList(effectiveMax, selectedCategoryIds, keyword);
        console.log(`[${this.source.name}] 发现 ${partialJobs.length} 个职位`);
      } catch (err) {
        // crawlJobList 中途失败：记录错误但不终止，继续处理已获取的列表数据
        errorMsg = `列表抓取中断: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[${this.source.name}] ${errorMsg}`);
        console.log(`[${this.source.name}] 已通过增量回调推送 ${pushedJobCount} 个职位`);
      }

      // 第二步：并行抓取详情（仅对未通过 onJobsBatch 推送的数据执行）
      if (partialJobs.length > 0) {
        console.log(`[${this.source.name}] 开始并行抓取详情（并发数: ${concurrency}）...`);

        // 报告进入详情抓取阶段
        if (this.onProgress) {
          this.onProgress(0, partialJobs.length, `发现 ${partialJobs.length} 个职位，开始抓取详情...`);
        }

        try {
          jobs = await this.crawlDetailsInParallel(partialJobs, concurrency);
        } catch (err) {
          const detailErr = `详情抓取中断: ${err instanceof Error ? err.message : String(err)}`;
          errorMsg = errorMsg ? `${errorMsg}; ${detailErr}` : detailErr;
          console.error(`[${this.source.name}] ${detailErr}`);
        }
      }

      // 综合判定状态：有错误但有数据 → partial，有错误且无数据 → error，无错误 → completed
      const totalJobCount = Math.max(jobs.length, pushedJobCount);
      if (errorMsg) {
        status = totalJobCount > 0 ? "completed" : "error";
      } else {
        status = "completed";
      }

      const message = errorMsg
        ? `抓取部分完成（${totalJobCount} 个职位），${errorMsg}`
        : `成功抓取 ${totalJobCount} 个职位`;
      console.log(`[${this.source.name}] ${message}`);
    } catch (err) {
      // 浏览器启动等全局错误
      status = "error";
      errorMsg = `爬取失败: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[${this.source.name}] ${errorMsg}`);
    } finally {
      await this.closeBrowser();
      // 恢复原始回调
      this.onJobsBatch = originalCallback;
    }

    const totalJobCount = Math.max(jobs.length, pushedJobCount);
    return {
      source: this.source.id,
      status,
      jobCount: totalJobCount,
      message: errorMsg
        ? `抓取部分完成（${totalJobCount} 个职位），${errorMsg}`
        : `成功抓取 ${totalJobCount} 个职位`,
      duration: Date.now() - startTime,
      jobs,
    };
  }
}
