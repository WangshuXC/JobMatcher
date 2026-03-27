/**
 * LLM 客户端 - 基于 Vercel AI SDK
 *
 * 统一封装多个 Provider（OpenAI / DeepSeek / 智谱 / 通义千问 / 自定义兼容 API）
 * 支持 structured output (JSON) 和流式输出
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { LLMConfig, LLMMatchResult } from "@/types";
import { PROVIDER_DEFAULTS } from "./settings";
import { buildRerankPrompt } from "./prompts";

/**
 * 根据配置创建 LLM provider 实例
 * 所有 Provider 都走 OpenAI 兼容协议
 */
function createProvider(config: LLMConfig) {
  const defaults = PROVIDER_DEFAULTS.find((p) => p.id === config.provider);
  const model = config.model || defaults?.defaultModel || "gpt-4o-mini";

  // 所有 Provider 都使用 OpenAI 兼容 API
  let baseURL: string | undefined = config.baseURL || defaults?.defaultBaseURL;

  // OpenAI 官方不需要自定义 baseURL
  if (config.provider === "openai" && !config.baseURL) {
    baseURL = undefined;
  }

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL,
  });

  return { provider, model };
}

/**
 * 从 API 错误中提取用户友好的中文提示信息
 */
function formatLLMError(err: unknown, config: LLMConfig): string {
  if (!(err instanceof Error)) return "未知错误";

  const message = err.message || "";

  // 解析 AI SDK 错误的结构化 data（如果有）
  const errAny = err as unknown as Record<string, unknown>;
  const errData = errAny.data as
    | { error?: { message?: string; code?: string } }
    | undefined;
  const apiErrorMsg = errData?.error?.message || "";
  const apiErrorCode = errData?.error?.code || "";
  const statusCode = errAny.statusCode as number | undefined;

  // 模型名无效
  if (
    apiErrorMsg.includes("invalid model") ||
    apiErrorCode === "20033" ||
    message.includes("invalid model")
  ) {
    return `模型 "${config.model || "未指定"}" 不被当前 API 支持，请在 AI 设置中修改模型名称`;
  }

  // 404 - 端点不存在（baseURL 错误）
  if (statusCode === 404 || message.includes("Not Found")) {
    return `API 地址无法访问（404），请检查 Base URL 是否正确: ${config.baseURL || "默认"}`;
  }

  // 401/403 - 认证失败
  if (statusCode === 401 || statusCode === 403 || message.includes("Unauthorized") || message.includes("auth")) {
    return "API Key 无效或已过期，请在 AI 设置中更新";
  }

  // 429 - 限流
  if (statusCode === 429 || message.includes("rate limit")) {
    return "API 请求频率超限，请稍后重试";
  }

  // 其他已知错误模式
  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
    return `无法连接到 API 服务器，请检查网络或 Base URL: ${config.baseURL || "默认"}`;
  }

  // 兜底：返回原始 API 错误消息（优先）或 JS 错误消息
  return apiErrorMsg || message;
}

/**
 * 健壮地解析 LLM 返回的 JSON 数组
 *
 * LLM 输出可能因 token 限制被截断，导致 JSON 不完整。
 * 此函数会：
 * 1. 先尝试直接解析完整 JSON
 * 2. 如果失败，尝试逐个提取已完成的 JSON 对象（丢弃截断部分）
 */
function parseLLMJsonResponse(text: string): LLMMatchResult[] {
  // 提取 JSON 数组部分（LLM 可能在 JSON 前后有多余文本）
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // 可能整个数组被截断了（没有 ]），尝试从 [ 开始提取
    const bracketIdx = text.indexOf("[");
    if (bracketIdx === -1) {
      console.error("[LLM] 无法从响应中提取 JSON:", text.slice(0, 200));
      return [];
    }
    // 尝试修复截断的数组
    return tryParsePartialJsonArray(text.slice(bracketIdx));
  }

  // 尝试直接解析
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // JSON 解析失败（很可能是截断），尝试修复
    console.warn("[LLM] JSON 直接解析失败，尝试修复截断内容...");
    return tryParsePartialJsonArray(jsonMatch[0]);
  }
}

/**
 * 尝试从截断的 JSON 数组中提取已完成的对象
 *
 * 策略：逐字符追踪花括号深度，提取每个完整的 {...} 对象
 */
function tryParsePartialJsonArray(truncatedJson: string): LLMMatchResult[] {
  const results: LLMMatchResult[] = [];

  let depth = 0;
  let objectStart = -1;

  for (let i = 0; i < truncatedJson.length; i++) {
    const ch = truncatedJson[i];

    // 跳过字符串内的字符
    if (ch === '"') {
      i++;
      while (i < truncatedJson.length && truncatedJson[i] !== '"') {
        if (truncatedJson[i] === "\\") i++; // 跳过转义字符
        i++;
      }
      continue;
    }

    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        // 找到一个完整的 {...} 块
        const objStr = truncatedJson.slice(objectStart, i + 1);
        try {
          const obj = JSON.parse(objStr);
          if (obj.jobId && typeof obj.score === "number") {
            results.push(obj);
          }
        } catch {
          // 单个对象解析失败，跳过
        }
        objectStart = -1;
      }
    }
  }

  if (results.length > 0) {
    console.log(`[LLM] 从截断的 JSON 中成功恢复 ${results.length} 条结果`);
  } else {
    console.error("[LLM] 无法从截断的 JSON 中恢复任何结果");
  }

  return results;
}

/**
 * LLM 精排：对候选职位进行智能匹配评估
 *
 * @param config LLM 配置
 * @param resumeText 简历原文
 * @param candidateJobs 候选职位列表
 * @returns LLM 评分结果
 */
export async function rerankWithLLM(
  config: LLMConfig,
  resumeText: string,
  candidateJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    requirements: string;
    category?: string;
  }>
): Promise<LLMMatchResult[]> {
  const { provider, model } = createProvider(config);

  const prompt = buildRerankPrompt(resumeText, candidateJobs);

  // 使用 provider.chat() 强制走 Chat Completions API（/chat/completions）
  // provider(model) 默认走 Responses API（/responses），第三方 OpenAI 兼容 API 不支持
  let text: string;
  try {
    const result = await generateText({
      model: provider.chat(model),
      prompt,
      temperature: 0.1,
      maxOutputTokens: 8192,
    });
    text = result.text;
  } catch (err) {
    // 将 API 错误转换为用户友好的中文提示
    const friendlyMsg = formatLLMError(err, config);
    console.error(`[LLM] API 调用失败: ${friendlyMsg}`, err);
    const wrappedErr = new Error(friendlyMsg);
    wrappedErr.cause = err;
    throw wrappedErr;
  }

  // 解析 JSON 响应
  const results = parseLLMJsonResponse(text);

  // 验证并规范化
  return results
    .filter((r) => r.jobId && typeof r.score === "number")
    .map((r) => ({
      jobId: r.jobId,
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      reason: r.reason || "",
      highlights: Array.isArray(r.highlights) ? r.highlights : [],
      risks: Array.isArray(r.risks) ? r.risks : [],
    }))
    .sort((a, b) => b.score - a.score);
}
