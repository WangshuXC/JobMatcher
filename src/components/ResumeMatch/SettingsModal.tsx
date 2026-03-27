"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Input,
  Label,
  TextField,
  Chip,
  Spinner,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
} from "@heroui/react";
import { Settings, Check, Zap, Shield, Eye, EyeOff } from "lucide-react";
import type { LLMProvider, ProviderDefaults } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onOpenChange,
  onClose,
}: SettingsModalProps) {
  const [providers, setProviders] = useState<ProviderDefaults[]>([]);
  const [selectedProvider, setSelectedProvider] =
    useState<LLMProvider>("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [hasLLM, setHasLLM] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // 加载当前设置
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setProviders(data.data.providers);
        setHasLLM(data.data.hasLLM);
        if (data.data.settings?.llm) {
          setSelectedProvider(data.data.settings.llm.provider);
          setApiKey(""); // 不回显完整 Key
          setModel(data.data.settings.llm.model || "");
          setBaseURL(data.data.settings.llm.baseURL || "");
        }
      }
    } catch {
      console.error("加载设置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // 切换 Provider 时更新默认值
  const handleProviderChange = (pid: LLMProvider) => {
    setSelectedProvider(pid);
    setModel("");
    setBaseURL("");
    setApiKey("");
    setMessage("");
  };

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // 保存设置
  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage("请输入 API Key");
      return;
    }

    // 自定义 Provider 必须填写 Base URL 和模型名称
    if (selectedProvider === "custom") {
      if (!baseURL.trim()) {
        setMessage("自定义兼容 API 必须填写 Base URL");
        return;
      }
      if (!model.trim()) {
        setMessage("自定义兼容 API 必须填写模型名称");
        return;
      }
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm: {
            provider: selectedProvider,
            apiKey: apiKey.trim(),
            model: model.trim() || undefined,
            baseURL: baseURL.trim() || undefined,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setHasLLM(true);
        setMessage("✅ 保存成功");
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("❌ 保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 清除配置
  const handleClear = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setHasLLM(false);
      setApiKey("");
      setModel("");
      setBaseURL("");
      setMessage("已清除 LLM 配置");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("❌ 清除失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="backdrop-blur-sm"
    >
      <ModalContainer size="lg" scroll="inside">
        <ModalDialog>
          <ModalHeader>
            <ModalHeading className="text-xl flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI 设置
            </ModalHeading>
            <ModalCloseTrigger />
          </ModalHeader>

          <ModalBody>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* 状态提示 */}
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    hasLLM
                      ? "bg-green-500/10 text-green-600"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {hasLLM ? (
                    <>
                      <Zap className="h-4 w-4" />
                      <span className="text-sm">
                        已配置 LLM，匹配将使用 AI 深度分析
                      </span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      <span className="text-sm">
                        未配置 LLM，匹配使用本地语义 + 规则引擎（无需 API Key）
                      </span>
                    </>
                  )}
                </div>

                {/* Provider 选择 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">
                    选择 LLM Provider
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleProviderChange(p.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          selectedProvider === p.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-neutral-200 hover:border-primary/30 dark:border-neutral-700"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground">
                            {p.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {p.defaultModel
                              ? `默认模型: ${p.defaultModel}`
                              : "需指定模型和 Base URL"}
                          </div>
                        </div>
                        {selectedProvider === p.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key */}
                <TextField fullWidth>
                  <Label>API Key</Label>
                  <div className="relative w-full">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder={
                        currentProvider?.placeholder || "请输入 API Key"
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="new-password"
                      data-1p-ignore
                      data-lpignore="true"
                      fullWidth
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </TextField>

                {/* 模型名称（自定义 Provider 必填） */}
                <TextField fullWidth>
                  <div className="flex items-center gap-2">
                    <Label>模型名称</Label>
                    {selectedProvider !== "custom" && (
                      <Chip size="sm" variant="secondary">
                        <Chip.Label>可选</Chip.Label>
                      </Chip>
                    )}
                  </div>
                  <Input
                    placeholder={`${selectedProvider === "custom" ? "必填，如 deepseek-v3-0324" : `默认: ${currentProvider?.defaultModel || ""}`}`}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    autoComplete="off"
                    fullWidth
                  />
                  {selectedProvider === "tencent-coding" && (
                    <p className="text-xs text-neutral-400 mt-1">
                      可用模型: hunyuan-turbos / hunyuan-t1 / hunyuan-2.0-instruct / hunyuan-2.0-thinking / minimax-m2.5 / kimi-k2.5 / glm-5 / tc-code-latest
                    </p>
                  )}
                </TextField>

                {/* 自定义 Base URL（自定义 Provider 必填） */}
                <TextField fullWidth>
                  <div className="flex items-center gap-2">
                    <Label>自定义 Base URL</Label>
                    {selectedProvider !== "custom" && (
                      <Chip size="sm" variant="secondary">
                        <Chip.Label>可选</Chip.Label>
                      </Chip>
                    )}
                  </div>
                  <Input
                    placeholder={
                      currentProvider?.defaultBaseURL || "使用官方默认地址"
                    }
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
                    autoComplete="off"
                    fullWidth
                  />
                  {selectedProvider === "custom" && (
                    <p className="text-xs text-neutral-400 mt-1">
                      填写 OpenAI 兼容 API 的 Base URL
                    </p>
                  )}
                </TextField>

                {/* 消息 */}
                {message && (
                  <p className="text-sm text-center text-foreground">
                    {message}
                  </p>
                )}
              </div>
            )}
          </ModalBody>

          <ModalFooter className="flex gap-2">
            {hasLLM && (
              <Button
                variant="danger-soft"
                onPress={handleClear}
                isDisabled={saving}
                className="cursor-pointer"
              >
                清除配置
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              onPress={onClose}
              className="cursor-pointer"
            >
              取消
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              isDisabled={saving || !apiKey.trim()}
              className="cursor-pointer"
            >
              {saving && <Spinner size="sm" className="mr-1" />}
              保存
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
}
