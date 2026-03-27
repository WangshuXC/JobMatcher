/**
 * GET /api/settings - 读取 AI 设置
 * POST /api/settings - 保存 AI 设置
 */
import { NextRequest, NextResponse } from "next/server";
import { loadAISettings, saveAISettings, PROVIDER_DEFAULTS } from "@/lib/ai/settings";
import type { AISettings } from "@/types";

export async function GET() {
  const settings = loadAISettings();

  // 不返回完整 API Key，只返回是否已配置 + 脱敏后的 Key
  const masked: AISettings = { ...settings };
  if (masked.llm?.apiKey) {
    const key = masked.llm.apiKey;
    masked.llm = {
      ...masked.llm,
      apiKey: key.length > 8 ? key.slice(0, 4) + "****" + key.slice(-4) : "****",
    };
  }

  return NextResponse.json({
    success: true,
    data: {
      settings: masked,
      providers: PROVIDER_DEFAULTS,
      hasLLM: !!(settings.llm?.apiKey && settings.llm?.provider),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { llm } = body as AISettings;

    const settings: AISettings = {};

    if (llm) {
      if (!llm.provider || !llm.apiKey) {
        return NextResponse.json(
          { success: false, error: "请提供 Provider 和 API Key" },
          { status: 400 }
        );
      }

      settings.llm = {
        provider: llm.provider,
        apiKey: llm.apiKey,
        model: llm.model || undefined,
        baseURL: llm.baseURL || undefined,
      };
    }

    saveAISettings(settings);

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `保存失败: ${err instanceof Error ? err.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
