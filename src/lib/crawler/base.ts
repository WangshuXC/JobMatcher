/**
 * 爬虫基类 - 所有招聘网站爬虫的抽象基类
 *
 * 新增数据源只需：
 * 1. 在 sources/ 下新建文件继承 BaseCrawler
 * 2. 实现 fetchMeta、crawlJobList 和 crawlJobDetail 方法
 * 3. 在 registry.ts 中注册
 */
import { chromium, Browser, Page, BrowserContext } from "playwright";
import { JobPosting, CrawlerSource, CrawlResult, CrawlerStatus, SourceMeta } from "@/types";

/** 并行抓取的默认并发数 */
const DEFAULT_CONCURRENCY = 5;

export abstract class BaseCrawler {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

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
   * 获取数据源元数据（总页数、每页条数、总职位数）
   * 子类必须实现，通过访问招聘列表页第一页获取分页信息
   */
  abstract fetchMeta(): Promise<SourceMeta>;

  /**
   * 抓取职位列表 - 返回基本信息和详情页URL列表
   * @param page - 浏览器页面
   * @param maxJobs - 最大抓取岗位数量
   */
  protected abstract crawlJobList(
    page: Page,
    maxJobs: number
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

      for (const job of results) {
        if (job) {
          jobs.push(job);
        }
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
   * @param maxJobs - 最大抓取岗位数量（默认 10）
   * @param concurrency - 详情并行抓取并发数
   */
  async crawl(maxJobs: number = 10, concurrency: number = DEFAULT_CONCURRENCY): Promise<CrawlResult> {
    const startTime = Date.now();
    let status: CrawlerStatus = "running";
    let jobs: JobPosting[] = [];

    console.log(`[${this.source.name}] 开始爬取，目标 ${maxJobs} 个岗位...`);

    try {
      await this.launchBrowser();
      const page = await this.newPage();

      // 第一步：获取职位列表（根据 maxJobs 自动计算需要的页数）
      console.log(`[${this.source.name}] 正在抓取职位列表...`);
      const partialJobs = await this.crawlJobList(page, maxJobs);
      console.log(`[${this.source.name}] 发现 ${partialJobs.length} 个职位`);

      // 关闭列表页
      await page.close();

      // 第二步：并行抓取详情
      console.log(`[${this.source.name}] 开始并行抓取详情（并发数: ${concurrency}）...`);
      jobs = await this.crawlDetailsInParallel(partialJobs, concurrency);

      status = "completed";
      console.log(`[${this.source.name}] 爬取完成，共 ${jobs.length} 个职位`);
    } catch (err) {
      status = "error";
      console.error(`[${this.source.name}] 爬取失败:`, err);

      return {
        source: this.source.id,
        status,
        jobCount: jobs.length,
        message: `爬取失败: ${err instanceof Error ? err.message : String(err)}`,
        duration: Date.now() - startTime,
        jobs,
      };
    } finally {
      await this.closeBrowser();
    }

    return {
      source: this.source.id,
      status,
      jobCount: jobs.length,
      message: `成功抓取 ${jobs.length} 个职位`,
      duration: Date.now() - startTime,
      jobs,
    };
  }
}
