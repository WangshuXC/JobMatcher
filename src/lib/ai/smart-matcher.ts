/**
 * 智能匹配主逻辑 - 两阶段 Embedding 召回 + LLM 精排
 *
 * 阶段 1：Embedding 语义召回（本地计算，无需 API Key）
 * 阶段 2：LLM 精排（需要 API Key，可选）
 *
 * 在没有配置 API Key 时，仅使用 Embedding 召回 + 原有规则引擎融合评分
 */

import { JobPosting, LLMMatchResult, MatchResult, MatchBreakdown } from "@/types";
import { embed, jobToEmbeddingText } from "./embedding";
import { embeddingStore } from "./embedding-store";
import { loadAISettings } from "./settings";
import { rerankWithLLM } from "./llm";
import { parseResume, matchJobs } from "../matcher";

/** 匹配进度回调 */
export interface MatchProgressCallback {
  (event: {
    type: string;
    message: string;
    data?: unknown;
  }): void;
}

/**
 * 两阶段智能匹配主函数
 *
 * @param resumeText 简历原文
 * @param allJobs 所有职位
 * @param topN 最终返回数量
 * @param useLLM 是否启用 LLM 精排
 * @param onProgress 进度回调（用于 SSE）
 */
export async function smartMatch(
  resumeText: string,
  allJobs: JobPosting[],
  topN: number = 20,
  useLLM: boolean = true,
  onProgress?: MatchProgressCallback
): Promise<{
  results: MatchResult[];
  llmResults?: LLMMatchResult[];
  method: "embedding+llm" | "embedding+rule" | "rule-only";
  totalIndexed: number;
}> {
  const jobMap = new Map(allJobs.map((j) => [j.id, j]));

  // ==================== 阶段 0：确保 Embedding 索引就绪 ====================
  onProgress?.({ type: "embedding_start", message: "正在构建语义索引..." });

  let totalIndexed = embeddingStore.count();

  try {
    const newCount = await embeddingStore.indexJobs(allJobs, (done, total) => {
      onProgress?.({
        type: "embedding_start",
        message: `正在构建语义索引... (${done}/${total})`,
      });
    });

    if (newCount > 0) {
      totalIndexed = embeddingStore.count();
      console.log(`[SmartMatch] 新增 ${newCount} 条 embedding，总计 ${totalIndexed}`);
    }
  } catch (err) {
    console.error("[SmartMatch] Embedding 索引失败，回退到规则引擎:", err);
    onProgress?.({ type: "error", message: "Embedding 索引失败，使用规则引擎匹配" });

    // 回退到纯规则引擎
    const resume = parseResume(resumeText);
    const results = matchJobs(resume, allJobs, topN);
    return { results, method: "rule-only", totalIndexed: 0 };
  }

  onProgress?.({ type: "embedding_done", message: `语义索引就绪（${totalIndexed} 条向量）` });

  // ==================== 阶段 1：Embedding 语义召回 ====================
  // 计算简历 embedding
  const resumeEmbeddingText = resumeText.slice(0, 1500);
  const resumeVector = await embed(resumeEmbeddingText);

  // 生成所有职位的 key 列表
  const jobKeys = allJobs.map(
    (j) => `${j.recruitType || "social"}_${j.source}_${j.sourceId}`
  );

  // 语义召回 Top 50
  const recallCount = Math.min(50, allJobs.length);
  const recalled = embeddingStore.recall(resumeVector, jobKeys, recallCount);

  // 将召回结果映射回 JobPosting
  const keyToJob = new Map<string, JobPosting>();
  for (const job of allJobs) {
    const key = `${job.recruitType || "social"}_${job.source}_${job.sourceId}`;
    keyToJob.set(key, job);
  }

  const recalledJobs = recalled
    .map((r) => keyToJob.get(r.key))
    .filter((j): j is JobPosting => !!j);

  // ==================== 阶段 2：LLM 精排 或 规则引擎融合 ====================
  const settings = loadAISettings();
  const hasLLM = useLLM && settings.llm?.apiKey && settings.llm?.provider;

  if (hasLLM && settings.llm) {
    // --- LLM 精排 ---
    onProgress?.({ type: "llm_start", message: "AI 正在深度分析匹配..." });

    try {
      const candidateJobs = recalledJobs.slice(0, 15).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description,
        requirements: j.requirements,
        category: j.category,
      }));

      const llmResults = await rerankWithLLM(
        settings.llm,
        resumeText,
        candidateJobs
      );

      onProgress?.({
        type: "llm_done",
        message: `AI 分析完成，评估了 ${candidateJobs.length} 个候选职位`,
      });

      // 将 LLM 结果合并为 MatchResult 格式
      const resume = parseResume(resumeText);
      const results: MatchResult[] = [];

      for (const llmItem of llmResults) {
        const job = jobMap.get(llmItem.jobId);
        if (!job) continue;

        // 同时计算规则引擎的 breakdown（用于 UI 维度展示）
        const ruleResult = matchJobs(resume, [job], 1)[0];

        results.push({
          job,
          score: llmItem.score,
          breakdown: ruleResult?.breakdown || {
            skillMatch: 0,
            locationMatch: 0,
            experienceMatch: 0,
            roleRelevance: 0,
          },
          reasons: [
            llmItem.reason,
            ...(llmItem.highlights.length > 0
              ? [`✅ ${llmItem.highlights.join("、")}`]
              : []),
            ...(llmItem.risks.length > 0
              ? [`⚠️ ${llmItem.risks.join("、")}`]
              : []),
          ],
        });
      }

      return {
        results: results.slice(0, topN),
        llmResults,
        method: "embedding+llm",
        totalIndexed,
      };
    } catch (err) {
      console.error("[SmartMatch] LLM 精排失败，回退到 Embedding + 规则:", err);
      onProgress?.({
        type: "error",
        message: `LLM 分析失败（${err instanceof Error ? err.message : "未知错误"}），使用语义+规则匹配`,
      });
      // 继续走 Embedding + 规则引擎
    }
  }

  // --- Embedding + 规则引擎融合 ---
  onProgress?.({ type: "llm_start", message: "正在融合语义和规则评分..." });

  const resume = parseResume(resumeText);

  // 对召回的职位用规则引擎评分
  const ruleResults = matchJobs(resume, recalledJobs, recallCount);

  // 融合 Embedding 相似度和规则引擎评分
  const embeddingSimilarityMap = new Map(
    recalled.map((r) => [r.key, r.similarity])
  );

  const fusedResults: MatchResult[] = ruleResults.map((rr) => {
    const key = `${rr.job.recruitType || "social"}_${rr.job.source}_${rr.job.sourceId}`;
    const embSim = embeddingSimilarityMap.get(key) || 0;

    // 融合分数：规则引擎 60% + Embedding 相似度 40%
    const fusedScore = Math.round(rr.score * 0.6 + embSim * 100 * 0.4);

    return {
      ...rr,
      score: fusedScore,
      reasons: [`语义相似度 ${Math.round(embSim * 100)}%`, ...rr.reasons],
    };
  });

  // 按融合分数重新排序
  fusedResults.sort((a, b) => b.score - a.score);

  onProgress?.({ type: "llm_done", message: "匹配完成" });

  return {
    results: fusedResults.slice(0, topN),
    method: "embedding+rule",
    totalIndexed,
  };
}
