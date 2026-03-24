/**
 * 简单的内存数据存储
 * 在生产环境中应替换为数据库 (如 PostgreSQL / MongoDB)
 */
import { JobPosting } from "@/types";

class JobStore {
  private jobs: Map<string, JobPosting> = new Map();

  /** 添加或更新职位 */
  upsert(job: JobPosting): void {
    const key = `${job.source}_${job.sourceId}`;
    this.jobs.set(key, job);
  }

  /** 批量添加 */
  upsertMany(jobs: JobPosting[]): void {
    for (const job of jobs) {
      this.upsert(job);
    }
  }

  /** 获取所有职位 */
  getAll(): JobPosting[] {
    return Array.from(this.jobs.values());
  }

  /** 按数据源筛选 */
  getBySource(source: string): JobPosting[] {
    return this.getAll().filter((j) => j.source === source);
  }

  /** 搜索职位 */
  search(keyword: string): JobPosting[] {
    const kw = keyword.toLowerCase();
    return this.getAll().filter(
      (j) =>
        j.title.toLowerCase().includes(kw) ||
        j.description.toLowerCase().includes(kw) ||
        j.requirements.toLowerCase().includes(kw) ||
        j.location.toLowerCase().includes(kw)
    );
  }

  /** 获取职位总数 */
  count(): number {
    return this.jobs.size;
  }

  /** 按数据源统计 */
  countBySource(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const job of this.jobs.values()) {
      counts[job.source] = (counts[job.source] || 0) + 1;
    }
    return counts;
  }

  /** 清除指定数据源的数据 */
  clearSource(source: string): void {
    for (const [key, job] of this.jobs.entries()) {
      if (job.source === source) {
        this.jobs.delete(key);
      }
    }
  }

  /** 清除所有数据 */
  clearAll(): void {
    this.jobs.clear();
  }
}

// 全局单例
export const jobStore = new JobStore();
