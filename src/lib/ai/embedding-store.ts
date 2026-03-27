/**
 * Embedding 向量存储
 *
 * 内存中的向量索引 + 本地 JSON 文件持久化
 * 与 JobStore 的设计模式一致：全局单例 + sync I/O
 *
 * 存储结构：
 * data/embeddings.json → { version, embeddings: { [jobKey]: number[] } }
 */

import fs from "fs";
import path from "path";
import { JobPosting } from "@/types";
import { embed, cosineSimilarity, jobToEmbeddingText } from "./embedding";

const DATA_DIR = path.join(process.cwd(), "data");
const EMBEDDING_FILE = path.join(DATA_DIR, "embeddings.json");

interface EmbeddingData {
  version: number;
  embeddings: Record<string, number[]>;
}

/** 生成与 JobStore 一致的 key */
function makeKey(job: JobPosting): string {
  return `${job.recruitType || "social"}_${job.source}_${job.sourceId}`;
}

class EmbeddingStore {
  private data: EmbeddingData = { version: 1, embeddings: {} };
  private loaded = false;

  /** 确保目录存在 */
  private ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /** 从文件加载 */
  private loadFromFile(): void {
    if (this.loaded) return;
    this.loaded = true;

    try {
      if (fs.existsSync(EMBEDDING_FILE)) {
        const raw = fs.readFileSync(EMBEDDING_FILE, "utf-8");
        this.data = JSON.parse(raw);
        console.log(
          `[EmbeddingStore] 加载了 ${Object.keys(this.data.embeddings).length} 条向量`
        );
      }
    } catch (err) {
      console.error("[EmbeddingStore] 加载失败:", err);
    }
  }

  /** 保存到文件 */
  private saveToFile(): void {
    try {
      this.ensureDir();
      fs.writeFileSync(
        EMBEDDING_FILE,
        JSON.stringify(this.data),
        "utf-8"
      );
    } catch (err) {
      console.error("[EmbeddingStore] 保存失败:", err);
    }
  }

  /** 获取已有的 embedding */
  get(key: string): number[] | undefined {
    this.loadFromFile();
    return this.data.embeddings[key];
  }

  /** 设置单个 embedding */
  set(key: string, vector: number[]): void {
    this.loadFromFile();
    this.data.embeddings[key] = vector;
  }

  /** 批量设置后保存 */
  saveBatch(): void {
    this.saveToFile();
  }

  /** 获取总数 */
  count(): number {
    this.loadFromFile();
    return Object.keys(this.data.embeddings).length;
  }

  /** 检查是否有该 key 的 embedding */
  has(key: string): boolean {
    this.loadFromFile();
    return key in this.data.embeddings;
  }

  /**
   * 为缺失 embedding 的职位计算并存储
   * @returns 新增的数量
   */
  async indexJobs(
    jobs: JobPosting[],
    onProgress?: (done: number, total: number) => void
  ): Promise<number> {
    this.loadFromFile();

    // 找出缺失 embedding 的职位
    const missing = jobs.filter((job) => !this.has(makeKey(job)));

    if (missing.length === 0) return 0;

    console.log(`[EmbeddingStore] 需要计算 ${missing.length} 条新 embedding`);

    for (let i = 0; i < missing.length; i++) {
      const job = missing[i];
      const key = makeKey(job);
      const text = jobToEmbeddingText(job);
      const vector = await embed(text);
      this.data.embeddings[key] = vector;

      // 每 50 条保存一次 + 进度回调
      if ((i + 1) % 50 === 0 || i === missing.length - 1) {
        this.saveToFile();
        onProgress?.(i + 1, missing.length);
      }
    }

    return missing.length;
  }

  /**
   * 语义召回：找出与查询向量最相似的 Top-K 职位
   * @param queryVector 查询向量（简历 embedding）
   * @param jobKeys 候选职位 key 列表（用于限定范围，如按 recruitType 过滤）
   * @param topK 返回数量
   * @returns [jobKey, similarity][] 按相似度降序
   */
  recall(
    queryVector: number[],
    jobKeys: string[],
    topK: number
  ): Array<{ key: string; similarity: number }> {
    this.loadFromFile();

    const scored: Array<{ key: string; similarity: number }> = [];

    for (const key of jobKeys) {
      const vec = this.data.embeddings[key];
      if (!vec) continue;
      const sim = cosineSimilarity(queryVector, vec);
      scored.push({ key, similarity: sim });
    }

    // 降序排列
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK);
  }

  /** 清除所有 embedding（用于重建） */
  clearAll(): void {
    this.data = { version: 1, embeddings: {} };
    this.saveToFile();
  }
}

export const embeddingStore = new EmbeddingStore();
