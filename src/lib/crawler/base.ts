/**
 * 爬虫基类 - 所有招聘网站爬虫的抽象基类
 *
 * 新增数据源只需：
 * 1. 在 sources/ 下新建文件继承 BaseCrawler
 * 2. 实现 crawlJobList 和 crawlJobDetail 方法
 * 3. 在 registry.ts 中注册
 */
import { chromium, Browser, Page, BrowserContext } from "playwright";
import { JobPosting, CrawlerSource, CrawlResult, CrawlerStatus } from "@/types";

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
   * 抓取职位列表 - 返回基本信息和详情页URL列表
   * 子类必须实现
   */
  protected abstract crawlJobList(
    page: Page,
    maxPages: number
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
   * 执行完整的爬取流程
   */
  async crawl(maxPages: number = 1): Promise<CrawlResult> {
    const startTime = Date.now();
    let status: CrawlerStatus = "running";
    const jobs: JobPosting[] = [];

    console.log(`[${this.source.name}] 开始爬取...`);

    try {
      await this.launchBrowser();
      const page = await this.newPage();

      // 第一步：获取职位列表
      console.log(`[${this.source.name}] 正在抓取职位列表...`);
      const partialJobs = await this.crawlJobList(page, maxPages);
      console.log(`[${this.source.name}] 发现 ${partialJobs.length} 个职位`);

      // 第二步：逐个抓取详情
      for (let i = 0; i < partialJobs.length; i++) {
        const partial = partialJobs[i];
        console.log(
          `[${this.source.name}] 抓取详情 (${i + 1}/${partialJobs.length}): ${partial.title}`
        );

        try {
          const job = await this.crawlJobDetail(page, partial);
          jobs.push(job);
        } catch (err) {
          console.error(
            `[${this.source.name}] 抓取详情失败: ${partial.title}`,
            err
          );
        }

        // 请求间隔
        if (i < partialJobs.length - 1) {
          await this.randomDelay(1500, 3000);
        }
      }

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
