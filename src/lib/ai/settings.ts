/**
 * AI 设置管理
 *
 * 持久化 LLM API 配置到 data/ai-settings.json
 * 提供 Provider 默认值
 */

import fs from "fs";
import path from "path";
import type { AISettings, ProviderDefaults } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "ai-settings.json");

/** 各 Provider 的默认配置 */
export const PROVIDER_DEFAULTS: ProviderDefaults[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    defaultBaseURL: "https://api.deepseek.com",
    placeholder: "sk-...",
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    placeholder: "sk-...",
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    defaultModel: "glm-4-flash",
    defaultBaseURL: "https://open.bigmodel.cn/api/paas/v4",
    placeholder: "API Key",
  },
  {
    id: "qwen",
    name: "通义千问",
    defaultModel: "qwen-plus",
    defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    placeholder: "sk-...",
  },
  {
    id: "tencent-coding",
    name: "腾讯云 Coding Plan",
    defaultModel: "hunyuan-turbos",
    defaultBaseURL: "https://api.lkeap.cloud.tencent.com/coding/v3",
    placeholder: "sk-sp-...",
  },
  {
    id: "custom",
    name: "自定义兼容 API",
    defaultModel: "",
    placeholder: "API Key",
  },
];

/** 读取 AI 设置 */
export function loadAISettings(): AISettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[AISettings] 加载失败:", err);
  }
  return {};
}

/** 保存 AI 设置 */
export function saveAISettings(settings: AISettings): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(settings, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("[AISettings] 保存失败:", err);
  }
}

/** 检查是否已配置 LLM */
export function hasLLMConfig(): boolean {
  const settings = loadAISettings();
  return !!(settings.llm?.apiKey && settings.llm?.provider);
}
