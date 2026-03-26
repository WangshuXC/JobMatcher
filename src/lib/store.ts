/**
 * 职位数据存储 - 内存 Map + 本地 JSON 文件持久化
 *
 * - 启动时自动从 data/jobs.json 加载已有数据
 * - 每次写入操作（upsert / clear）后自动同步到文件
 * - 支持按 recruitType（社招/校招）筛选数据
 * - 旧数据兼容：无 recruitType 字段的数据自动标记为 "social"
 */
import { JobPosting, RecruitType } from "@/types";
import fs from "fs";
import path from "path";

/** 数据文件路径：项目根目录 data/jobs.json */
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "jobs.json");

/** 生成存储 key：recruitType_source_sourceId */
function makeKey(job: JobPosting): string {
  return `${job.recruitType || "social"}_${job.source}_${job.sourceId}`;
}

class JobStore {
  private jobs: Map<string, JobPosting> = new Map();
  private loaded = false;

  /** 确保 data 目录存在 */
  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /** 从本地文件加载数据到内存（仅在首次访问时执行一次） */
  private loadFromFile(): void {
    if (this.loaded) return;
    this.loaded = true;

    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const arr: JobPosting[] = JSON.parse(raw);
        for (const job of arr) {
          // 旧数据兼容：无 recruitType 字段的数据自动标记为 "social"
          if (!job.recruitType) {
            job.recruitType = "social";
          }
          const key = makeKey(job);
          this.jobs.set(key, job);
        }
        console.log(`[JobStore] 从文件加载了 ${arr.length} 个职位`);
      }
    } catch (err) {
      console.error("[JobStore] 加载数据文件失败:", err);
    }
  }

  /** 将内存数据同步写入本地文件 */
  private saveToFile(): void {
    try {
      this.ensureDataDir();
      const arr = Array.from(this.jobs.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), "utf-8");
    } catch (err) {
      console.error("[JobStore] 写入数据文件失败:", err);
    }
  }

  /** 按 recruitType 过滤的内部辅助方法 */
  private filterByRecruitType(jobs: JobPosting[], recruitType?: RecruitType): JobPosting[] {
    if (!recruitType) return jobs;
    return jobs.filter((j) => (j.recruitType || "social") === recruitType);
  }

  /** 添加或更新职位 */
  upsert(job: JobPosting): void {
    this.loadFromFile();
    const key = makeKey(job);
    this.jobs.set(key, job);
    this.saveToFile();
  }

  /** 批量添加 */
  upsertMany(jobs: JobPosting[]): void {
    this.loadFromFile();
    for (const job of jobs) {
      const key = makeKey(job);
      this.jobs.set(key, job);
    }
    this.saveToFile();
  }

  /** 获取所有职位（可选按 recruitType 筛选） */
  getAll(recruitType?: RecruitType): JobPosting[] {
    this.loadFromFile();
    const all = Array.from(this.jobs.values());
    return this.filterByRecruitType(all, recruitType);
  }

  /** 按数据源筛选（可选按 recruitType 筛选） */
  getBySource(source: string, recruitType?: RecruitType): JobPosting[] {
    return this.getAll(recruitType).filter((j) => j.source === source);
  }

  /** 搜索职位（可选按 recruitType 筛选） */
  search(keyword: string, recruitType?: RecruitType): JobPosting[] {
    const kw = keyword.toLowerCase();
    return this.getAll(recruitType).filter(
      (j) =>
        j.title.toLowerCase().includes(kw) ||
        j.description.toLowerCase().includes(kw) ||
        j.requirements.toLowerCase().includes(kw) ||
        j.location.toLowerCase().includes(kw)
    );
  }

  /** 获取职位总数（可选按 recruitType 筛选） */
  count(recruitType?: RecruitType): number {
    return this.getAll(recruitType).length;
  }

  /** 按数据源统计（可选按 recruitType 筛选） */
  countBySource(recruitType?: RecruitType): Record<string, number> {
    const jobs = this.getAll(recruitType);
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      counts[job.source] = (counts[job.source] || 0) + 1;
    }
    return counts;
  }

  /** 清除指定数据源的数据（可选按 recruitType 筛选） */
  clearSource(source: string, recruitType?: RecruitType): void {
    this.loadFromFile();
    for (const [key, job] of this.jobs.entries()) {
      if (job.source === source) {
        if (!recruitType || (job.recruitType || "social") === recruitType) {
          this.jobs.delete(key);
        }
      }
    }
    this.saveToFile();
  }

  /** 获取所有去重的地点列表（按数量降序，自动拆分复合地点，可选按 recruitType 筛选） */
  getLocations(recruitType?: RecruitType): string[] {
    const jobs = this.getAll(recruitType);
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const parts = (job.location || "")
        .split(/[、，,/／]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        counts[part] = (counts[part] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([loc]) => loc);
  }

  /** 清除所有数据 */
  clearAll(): void {
    this.loadFromFile();
    this.jobs.clear();
    this.saveToFile();
  }
}

// 全局单例
export const jobStore = new JobStore();
