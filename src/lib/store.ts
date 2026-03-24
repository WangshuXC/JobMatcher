/**
 * 职位数据存储 - 内存 Map + 本地 JSON 文件持久化
 *
 * - 启动时自动从 data/jobs.json 加载已有数据
 * - 每次写入操作（upsert / clear）后自动同步到文件
 * - 对外 API 接口与原来完全一致，调用方无需修改
 */
import { JobPosting } from "@/types";
import fs from "fs";
import path from "path";

/** 数据文件路径：项目根目录 data/jobs.json */
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "jobs.json");

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
          const key = `${job.source}_${job.sourceId}`;
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

  /** 添加或更新职位 */
  upsert(job: JobPosting): void {
    this.loadFromFile();
    const key = `${job.source}_${job.sourceId}`;
    this.jobs.set(key, job);
    this.saveToFile();
  }

  /** 批量添加 */
  upsertMany(jobs: JobPosting[]): void {
    this.loadFromFile();
    for (const job of jobs) {
      const key = `${job.source}_${job.sourceId}`;
      this.jobs.set(key, job);
    }
    this.saveToFile();
  }

  /** 获取所有职位 */
  getAll(): JobPosting[] {
    this.loadFromFile();
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
    this.loadFromFile();
    return this.jobs.size;
  }

  /** 按数据源统计 */
  countBySource(): Record<string, number> {
    this.loadFromFile();
    const counts: Record<string, number> = {};
    for (const job of this.jobs.values()) {
      counts[job.source] = (counts[job.source] || 0) + 1;
    }
    return counts;
  }

  /** 清除指定数据源的数据 */
  clearSource(source: string): void {
    this.loadFromFile();
    for (const [key, job] of this.jobs.entries()) {
      if (job.source === source) {
        this.jobs.delete(key);
      }
    }
    this.saveToFile();
  }

  /** 获取所有去重的地点列表（按数量降序，自动拆分复合地点） */
  getLocations(): string[] {
    this.loadFromFile();
    const counts: Record<string, number> = {};
    for (const job of this.jobs.values()) {
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
