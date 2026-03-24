/**
 * 阿里巴巴集团招聘爬虫
 * 目标: https://talent.alibaba.com/off-campus/position-list
 *
 * 预设架构 - 可根据实际页面结构完善
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource, SourceMeta } from "@/types";

const PAGE_SIZE = 20;

export class AlibabaCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "alibaba",
    name: "阿里巴巴",
    company: "阿里巴巴集团",
    logo: "https://talent.alibaba.com/favicon.ico",
    baseUrl: "https://talent.alibaba.com",
    enabled: true,
    description: "阿里巴巴集团社会招聘 - 涵盖淘宝、天猫、阿里云等业务",
  };

  private buildListUrl(page: number): string {
    return `${this.source.baseUrl}/off-campus/position-list?lang=zh&type=experienced&page=${page}`;
  }

  /**
   * 获取数据源元数据
   */
  async fetchMeta(): Promise<SourceMeta> {
    try {
      await this.launchBrowser();
      const page = await this.newPage();

      const url = this.buildListUrl(1);
      console.log(`[阿里巴巴] 获取元数据: ${url}`);

      await this.safeGoto(page, url);
      await this.randomDelay(3000, 5000);

      await page.waitForSelector(
        '[class*="position"], [class*="job-list"], [class*="card"], a[href*="position"]',
        { timeout: 15000 }
      ).catch(() => {
        console.log("[阿里巴巴] 等待列表元素超时");
      });

      const meta = await page.evaluate((pageSize: number) => {
        let totalJobs = 0;
        let totalPages = 0;

        // 尝试从分页组件获取
        const paginationEls = document.querySelectorAll(
          '[class*="pagination"] li, [class*="pager"] li, [class*="page"] a, [class*="page"] button'
        );
        if (paginationEls.length > 0) {
          let maxPage = 1;
          paginationEls.forEach((el) => {
            const text = el.textContent?.trim() || "";
            const num = parseInt(text, 10);
            if (!isNaN(num) && num > maxPage) {
              maxPage = num;
            }
          });
          totalPages = maxPage;
          totalJobs = maxPage * pageSize;
        }

        // 尝试从文字中获取
        if (totalJobs === 0) {
          const allText = document.body.innerText;
          const totalMatch = allText.match(/共\s*(\d+)\s*个|共\s*(\d+)\s*条|共(\d+)个|总计\s*(\d+)|找到\s*(\d+)\s*个|(\d+)\s*个职位/);
          if (totalMatch) {
            const num = parseInt(totalMatch[1] || totalMatch[2] || totalMatch[3] || totalMatch[4] || totalMatch[5] || totalMatch[6], 10);
            if (!isNaN(num) && num > 0) {
              totalJobs = num;
              totalPages = Math.ceil(num / pageSize);
            }
          }
        }

        // 兜底
        if (totalJobs === 0) {
          const cards = document.querySelectorAll(
            '[class*="position-item"], [class*="job-card"], a[href*="position-detail"]'
          );
          const seen = new Set<string>();
          cards.forEach((card) => {
            const link = card.tagName === "A" ? (card as HTMLAnchorElement) : card.querySelector("a");
            if (!link) return;
            const href = link.href;
            const match = href.match(/position[/-]detail[/=]?(\w+)/i) || href.match(/positionId=(\w+)/i);
            if (match) seen.add(match[1]);
          });
          totalJobs = seen.size >= pageSize ? seen.size * 10 : seen.size;
          totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
        }

        return { totalJobs, totalPages };
      }, PAGE_SIZE);

      await page.close();
      await this.closeBrowser();

      return {
        sourceId: this.source.id,
        totalJobs: meta.totalJobs,
        pageSize: PAGE_SIZE,
        totalPages: meta.totalPages,
        success: true,
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

  protected async crawlJobList(
    page: Page,
    maxJobs: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];
    const maxPages = Math.ceil(maxJobs / PAGE_SIZE);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = this.buildListUrl(pageNum);
      console.log(`[阿里巴巴] 抓取第 ${pageNum}/${maxPages} 页: ${url}`);

      await this.safeGoto(page, url);
      await this.randomDelay(3000, 5000);

      await page.waitForSelector(
        '[class*="position"], [class*="job-list"], [class*="card"], a[href*="position"]',
        { timeout: 15000 }
      ).catch(() => {
        console.log("[阿里巴巴] 等待列表元素超时，尝试继续...");
      });

      const jobItems = await page.evaluate((baseUrl) => {
        const items: Array<{
          title: string;
          detailUrl: string;
          sourceId: string;
          location: string;
        }> = [];

        const cards = document.querySelectorAll(
          '[class*="position-item"], [class*="job-card"], a[href*="position-detail"]'
        );
        const seen = new Set<string>();

        cards.forEach((card) => {
          const link = card.tagName === "A"
            ? (card as HTMLAnchorElement)
            : card.querySelector("a");
          if (!link) return;

          const href = link.href;
          const match = href.match(/position[/-]detail[/=]?(\w+)/i) ||
            href.match(/positionId=(\w+)/i);
          if (!match) return;

          const sourceId = match[1];
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          const titleEl = card.querySelector('[class*="name"], [class*="title"], h3, h4');
          const locationEl = card.querySelector('[class*="location"], [class*="city"]');

          items.push({
            title: titleEl?.textContent?.trim() || "未知职位",
            detailUrl: href.startsWith("http") ? href : `${baseUrl}${href}`,
            sourceId,
            location: locationEl?.textContent?.trim() || "",
          });
        });

        return items;
      }, this.source.baseUrl);

      console.log(`[阿里巴巴] 第 ${pageNum} 页发现 ${jobItems.length} 个职位`);

      for (const item of jobItems) {
        allJobs.push({
          title: item.title,
          source: this.source.id,
          company: this.source.company,
          sourceId: item.sourceId,
          detailUrl: item.detailUrl,
          location: item.location,
        });

        if (allJobs.length >= maxJobs) break;
      }

      if (allJobs.length >= maxJobs || jobItems.length === 0) break;

      if (pageNum < maxPages) {
        await this.randomDelay(2000, 4000);
      }
    }

    return allJobs.slice(0, maxJobs);
  }

  protected async crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    const detailUrl = partialJob.detailUrl || "";
    await this.safeGoto(page, detailUrl);
    await this.randomDelay(2000, 3000);

    await page.waitForSelector(
      '[class*="detail"], [class*="position-detail"], [class*="job"]',
      { timeout: 15000 }
    ).catch(() => {
      console.log("[阿里巴巴] 等待详情元素超时");
    });

    const detail = await page.evaluate(() => {
      const getText = (selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return "";
      };

      const title = getText([
        'h1[class*="title"]',
        '[class*="position-name"]',
        '[class*="job-title"]',
        "h1",
      ]);

      const location = getText([
        '[class*="location"]',
        '[class*="city"]',
      ]);

      const contentEl = document.querySelector(
        '[class*="detail-content"], [class*="job-detail"], [class*="position-desc"]'
      );
      const fullText = contentEl?.textContent?.trim() || "";

      let description = "";
      let requirements = "";

      const reqIdx = fullText.search(/职位要求|任职要求|岗位要求/);
      if (reqIdx !== -1) {
        description = fullText.slice(0, reqIdx).trim();
        requirements = fullText.slice(reqIdx).trim();
      } else {
        description = fullText;
      }

      return { title, location, description, requirements };
    });

    return {
      id: `${this.source.id}_${partialJob.sourceId}`,
      title: detail.title || partialJob.title || "未知职位",
      company: this.source.company,
      source: this.source.id,
      location: detail.location || partialJob.location || "未知",
      sourceId: partialJob.sourceId || "",
      description: detail.description || "暂无描述",
      requirements: detail.requirements || "暂无要求",
      detailUrl,
      crawledAt: new Date().toISOString(),
    };
  }
}
