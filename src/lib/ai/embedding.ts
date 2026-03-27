/**
 * 本地 Embedding 引擎
 *
 * 使用 @huggingface/transformers (ONNX Runtime) 在 Node.js 端运行
 * 模型：BAAI/bge-small-zh-v1.5（~100MB，中文语义理解优秀）
 *
 * 职责：
 * - 将文本转为 embedding 向量
 * - 计算两个向量的余弦相似度
 */

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/** 单例：embedding pipeline */
let extractor: FeatureExtractionPipeline | null = null;
let loading: Promise<FeatureExtractionPipeline> | null = null;

/** Embedding 向量维度（bge-small-zh-v1.5 = 512） */
export const EMBEDDING_DIM = 512;

/**
 * 获取或初始化 Embedding pipeline（懒加载单例）
 * 首次调用会下载模型（约 100MB），后续调用复用
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;

  if (!loading) {
    loading = pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", {
      // 使用 ONNX quantized 模型，体积更小
      dtype: "q8",
    }).then((pipe) => {
      extractor = pipe;
      console.log("[Embedding] 模型加载完成: Xenova/bge-small-zh-v1.5");
      return pipe;
    });
  }

  return loading;
}

/**
 * 将文本转为 embedding 向量
 * @param text 输入文本
 * @returns 归一化的 embedding 向量 (Float32Array)
 */
export async function embed(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "cls", normalize: true });
  // output.data 是 Float32Array，转为普通数组以便 JSON 序列化
  return Array.from(output.data as Float32Array);
}

/**
 * 批量 embedding
 * @param texts 文本数组
 * @returns 每个文本的 embedding 向量
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  // 逐条处理避免 OOM（轻量模型，单条延迟 ~50ms）
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

/**
 * 计算两个向量的余弦相似度
 * 两个向量都应已归一化，所以点积即为余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * 将职位信息转为适合 embedding 的文本
 * 拼接关键字段，控制长度
 */
export function jobToEmbeddingText(job: {
  title: string;
  description: string;
  requirements: string;
  category?: string;
  location: string;
}): string {
  const parts = [
    job.title,
    job.category || "",
    job.location,
    // 截取描述前 300 字符避免过长
    (job.description || "").slice(0, 300),
    (job.requirements || "").slice(0, 200),
  ];
  return parts.filter(Boolean).join(" ");
}
