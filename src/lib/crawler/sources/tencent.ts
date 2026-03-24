/**
 * 腾讯招聘爬虫
 * 目标: https://careers.tencent.com/search.html
 *
 * 预设架构 - 可根据实际页面结构完善
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

export class TencentCrawler extends BaseCrawler {
  readonly source: CrawlerSource = {
    id: "tencent",
    name: "腾讯",
    company: "腾讯",
    logo: "https://careers.tencent.com/favicon.ico",
    baseUrl: "https://careers.tencent.com",
    enabled: true,
    description: "腾讯社会招聘 - 涵盖微信、QQ、云计算等业务线",
  };

  private buildListUrl(pageIndex: number): string {
    return `${this.source.baseUrl}/search.html?keyword=&locationId=&postId=&categoryId=&parentCategoryId=&attrId=1&index=${pageIndex}`;
  }

  protected async crawlJobList(
    page: Page,
    maxPages: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = this.buildListUrl(pageNum);
      console.log(`[腾讯] 抓取第 ${pageNum} 页: ${url}`);

      await this.safeGoto(page, url);
      await this.randomDelay(3000, 5000);

      // 等待列表渲染
      await page.waitForSelector(
        '[class*="recruit-list"], [class*="recruit-wrap"], .recruit-list a, a[href*="position"]',
        { timeout: 15000 }
      ).catch(() => {
        console.log("[腾讯] 等待列表元素超时，尝试继续...");
      });

      const jobItems = await page.evaluate((baseUrl) => {
        const items: Array<{
          title: string;
          detailUrl: string;
          sourceId: string;
          location: string;
        }> = [];

        // 腾讯招聘列表结构
        const cards = document.querySelectorAll(
          '[class*="recruit-list"] a, .recruit-wrap a, a[href*="position"]'
        );
        const seen = new Set<string>();

        cards.forEach((card) => {
          const href = (card as HTMLAnchorElement).href;
          const match = href.match(/position[/=](\w+)/i);
          if (!match) return;

          const sourceId = match[1];
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          const titleEl = card.querySelector(
            '[class*="name"], [class*="title"], h3, h4'
          );
          const locationEl = card.querySelector(
            '[class*="city"], [class*="location"]'
          );

          items.push({
            title: titleEl?.textContent?.trim() || "未知职位",
            detailUrl: href.startsWith("http") ? href : `${baseUrl}${href}`,
            sourceId,
            location: locationEl?.textContent?.trim() || "",
          });
        });

        return items;
      }, this.source.baseUrl);

      console.log(`[腾讯] 第 ${pageNum} 页发现 ${jobItems.length} 个职位`);

      for (const item of jobItems) {
        allJobs.push({
          title: item.title,
          source: this.source.id,
          company: this.source.company,
          sourceId: item.sourceId,
          detailUrl: item.detailUrl,
          location: item.location,
        });
      }

      if (jobItems.length === 0) break;

      if (pageNum < maxPages) {
        await this.randomDelay(2000, 4000);
      }
    }

    return allJobs;
  }

  protected async crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    const detailUrl = partialJob.detailUrl || "";
    await this.safeGoto(page, detailUrl);
    await this.randomDelay(2000, 3000);

    await page.waitForSelector(
      '[class*="detail"], [class*="recruit-detail"], [class*="position"]',
      { timeout: 15000 }
    ).catch(() => {
      console.log("[腾讯] 等待详情元素超时");
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
        'h1[class*="name"]',
        '[class*="job-title"]',
        '[class*="position-name"]',
        "h1",
      ]);

      const location = getText([
        '[class*="location"]',
        '[class*="city"]',
      ]);

      // 获取描述和要求
      const sections = document.querySelectorAll(
        '[class*="detail-content"] > div, [class*="job-detail"] > div'
      );
      let description = "";
      let requirements = "";

      sections.forEach((section) => {
        const text = section.textContent?.trim() || "";
        if (text.includes("工作职责") || text.includes("职位描述")) {
          description = text;
        } else if (text.includes("工作要求") || text.includes("任职要求")) {
          requirements = text;
        }
      });

      if (!description && !requirements) {
        const content = document.querySelector(
          '[class*="detail-content"], [class*="job-detail"]'
        );
        description = content?.textContent?.trim() || "";
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
