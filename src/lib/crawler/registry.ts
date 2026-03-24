/**
 * 爬虫注册表
 *
 * 所有数据源在这里集中注册和管理。
 * 新增数据源只需要：
 * 1. 在 sources/ 下创建新的爬虫类 (继承 BaseCrawler)
 * 2. 在此文件中 import 并注册
 */
import { BaseCrawler } from "./base";
import { CrawlerSource } from "@/types";
import { BytedanceCrawler } from "./sources/bytedance";
import { TencentCrawler } from "./sources/tencent";
import { AlibabaCrawler } from "./sources/alibaba";

/** 爬虫实例注册表 */
const crawlerRegistry: Map<string, BaseCrawler> = new Map();

/** 注册所有爬虫 */
function registerAllCrawlers(): void {
  const crawlers: BaseCrawler[] = [
    new BytedanceCrawler(),
    new TencentCrawler(),
    new AlibabaCrawler(),
    // === 新增数据源在此处添加 ===
    // new XiaomiCrawler(),
    // new MeituanCrawler(),
    // new JDCrawler(),
  ];

  for (const crawler of crawlers) {
    crawlerRegistry.set(crawler.source.id, crawler);
  }
}

// 初始化
registerAllCrawlers();

/** 获取指定数据源的爬虫 */
export function getCrawler(sourceId: string): BaseCrawler | undefined {
  return crawlerRegistry.get(sourceId);
}

/** 获取所有已注册的爬虫 */
export function getAllCrawlers(): BaseCrawler[] {
  return Array.from(crawlerRegistry.values());
}

/** 获取所有数据源配置 */
export function getAllSources(): CrawlerSource[] {
  return getAllCrawlers().map((c) => c.source);
}

/** 获取启用的数据源配置 */
export function getEnabledSources(): CrawlerSource[] {
  return getAllSources().filter((s) => s.enabled);
}
