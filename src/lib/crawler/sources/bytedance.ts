/**
 * 字节跳动招聘爬虫
 * 目标: https://jobs.bytedance.com/experienced/position
 *
 * 页面为 SPA (React)，需要等待 JS 渲染完成后再提取数据。
 * 列表页通过 API 请求加载，详情页面使用动态渲染。
 */
import { Page } from "playwright";
import { BaseCrawler } from "../base";
import { JobPosting, CrawlerSource } from "@/types";

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

  /** 构建职位列表页 URL */
  private buildListUrl(page: number, limit: number = 10, category?: string): string {
    const params = new URLSearchParams({
      keywords: "",
      category: category || "6704215886108035339", // 默认: 研发
      location: "",
      project: "",
      type: "",
      job_hot_flag: "",
      current: String(page),
      limit: String(limit),
      functionCategory: "",
      tag: "",
    });
    return `${this.source.baseUrl}/experienced/position?${params.toString()}`;
  }

  /**
   * 抓取职位列表
   */
  protected async crawlJobList(
    page: Page,
    maxPages: number
  ): Promise<Partial<JobPosting>[]> {
    const allJobs: Partial<JobPosting>[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = this.buildListUrl(pageNum);
      console.log(`[字节跳动] 抓取第 ${pageNum} 页: ${url}`);

      await this.safeGoto(page, url);

      // 等待职位列表渲染出来
      await page.waitForSelector(
        '[class*="positionItem"], [class*="job-card"], [class*="position-card"], a[href*="/position/"]',
        { timeout: 15000 }
      ).catch(() => {
        console.log("[字节跳动] 等待列表元素超时，尝试继续...");
      });

      // 额外等待确保页面完全渲染
      await this.randomDelay(2000, 3000);

      // 提取职位列表项
      const jobItems = await page.evaluate(() => {
        const items: Array<{
          title: string;
          detailUrl: string;
          sourceId: string;
          location: string;
        }> = [];

        // 查找所有职位链接
        const links = document.querySelectorAll('a[href*="/position/"]');
        const seen = new Set<string>();

        links.forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          // 提取职位ID
          const match = href.match(/\/position\/(\d+)/);
          if (!match) return;

          const sourceId = match[1];
          if (seen.has(sourceId)) return;
          seen.add(sourceId);

          // 从链接容器中提取信息
          const container = link.closest('[class*="item"], [class*="card"], li') || link;
          const titleEl =
            container.querySelector('[class*="title"], [class*="name"], h3, h4') ||
            link;
          const locationEl = container.querySelector(
            '[class*="location"], [class*="city"], [class*="address"]'
          );

          items.push({
            title: titleEl?.textContent?.trim() || "未知职位",
            detailUrl: href.startsWith("http")
              ? href
              : `${window.location.origin}${href}`,
            sourceId,
            location: locationEl?.textContent?.trim() || "",
          });
        });

        return items;
      });

      console.log(`[字节跳动] 第 ${pageNum} 页发现 ${jobItems.length} 个职位`);

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

      // 如果当前页没有数据，说明没有更多页了
      if (jobItems.length === 0) break;

      if (pageNum < maxPages) {
        await this.randomDelay(2000, 4000);
      }
    }

    return allJobs;
  }

  /**
   * 抓取单个职位详情
   */
  protected async crawlJobDetail(
    page: Page,
    partialJob: Partial<JobPosting>
  ): Promise<JobPosting> {
    const detailUrl = partialJob.detailUrl || "";

    // 确保 URL 包含 /detail
    const fullUrl = detailUrl.includes("/detail")
      ? detailUrl
      : `${detailUrl}/detail`;

    await this.safeGoto(page, fullUrl);

    // 等待详情内容加载
    await page.waitForSelector(
      '[class*="detail"], [class*="content"], [class*="job-"], article',
      { timeout: 15000 }
    ).catch(() => {
      console.log("[字节跳动] 等待详情元素超时，尝试继续...");
    });

    await this.randomDelay(1500, 2500);

    // 提取详情信息
    const detail = await page.evaluate(() => {
      // 辅助函数：尝试多个选择器
      const getText = (selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return "";
      };

      // 提取所有文本块
      const getAllText = (): string => {
        const blocks: string[] = [];
        document.querySelectorAll("p, li, div > span, h1, h2, h3, h4").forEach((el) => {
          const text = el.textContent?.trim();
          if (text && text.length > 5) {
            blocks.push(text);
          }
        });
        return blocks.join("\n");
      };

      // 职位名称
      const title = getText([
        'h1[class*="title"]',
        'h1[class*="name"]',
        '[class*="job-title"]',
        '[class*="position-name"]',
        "h1",
        'h2[class*="title"]',
      ]);

      // 工作地点
      const location = getText([
        '[class*="location"]',
        '[class*="city"]',
        '[class*="address"]',
        '[class*="place"]',
      ]);

      // 职位ID - 从URL中提取
      const urlMatch = window.location.pathname.match(/\/position\/(\d+)/);
      const sourceId = urlMatch ? urlMatch[1] : "";

      // 职位描述和要求 - 通常在主体内容区域
      const fullText = getAllText();

      // 尝试分离描述和要求
      let description = "";
      let requirements = "";

      // 查找包含 "职位描述" / "工作职责" / "职位要求" / "任职要求" 等关键词的区块
      const sections = document.querySelectorAll(
        '[class*="content"] > div, [class*="detail"] > div, [class*="section"], [class*="block"]'
      );

      sections.forEach((section) => {
        const text = section.textContent?.trim() || "";
        const heading = section.querySelector("h2, h3, h4, [class*='title']")?.textContent?.trim() || "";

        if (
          heading.includes("职位描述") ||
          heading.includes("工作职责") ||
          heading.includes("工作内容") ||
          text.startsWith("职位描述") ||
          text.startsWith("工作职责")
        ) {
          description = text;
        } else if (
          heading.includes("职位要求") ||
          heading.includes("任职要求") ||
          heading.includes("岗位要求") ||
          text.startsWith("职位要求") ||
          text.startsWith("任职要求")
        ) {
          requirements = text;
        }
      });

      // 如果未能通过结构分离，尝试通过关键词分割
      if (!description && !requirements && fullText) {
        const descKeywords = ["职位描述", "工作职责", "工作内容"];
        const reqKeywords = ["职位要求", "任职要求", "岗位要求"];

        let descIdx = -1;
        let reqIdx = -1;

        for (const kw of descKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
            descIdx = idx;
            break;
          }
        }
        for (const kw of reqKeywords) {
          const idx = fullText.indexOf(kw);
          if (idx !== -1) {
            reqIdx = idx;
            break;
          }
        }

        if (descIdx !== -1 && reqIdx !== -1) {
          if (descIdx < reqIdx) {
            description = fullText.slice(descIdx, reqIdx).trim();
            requirements = fullText.slice(reqIdx).trim();
          } else {
            requirements = fullText.slice(reqIdx, descIdx).trim();
            description = fullText.slice(descIdx).trim();
          }
        } else {
          // 无法分离，整体作为描述
          description = fullText;
        }
      }

      return { title, location, sourceId, description, requirements };
    });

    return {
      id: `${this.source.id}_${detail.sourceId || partialJob.sourceId}`,
      title: detail.title || partialJob.title || "未知职位",
      company: this.source.company,
      source: this.source.id,
      location: detail.location || partialJob.location || "未知",
      sourceId: detail.sourceId || partialJob.sourceId || "",
      description: detail.description || "暂无描述",
      requirements: detail.requirements || "暂无要求",
      detailUrl: fullUrl,
      crawledAt: new Date().toISOString(),
    };
  }
}
