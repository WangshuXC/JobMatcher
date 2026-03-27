"use client";

import { Button, TextArea, Chip } from "@heroui/react";
import { FileText, Sparkles, RefreshCw, Loader2, Cpu, Zap } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";
import { SAMPLE_RESUME } from "./constants";

interface ResumeInputProps {
  onMatch: () => void;
}

export default function ResumeInput({ onMatch }: ResumeInputProps) {
  const resumeText = useMatchStore((s) => s.resumeText);
  const isMatching = useMatchStore((s) => s.isMatching);
  const error = useMatchStore((s) => s.error);
  const progressMessage = useMatchStore((s) => s.progressMessage);
  const matchMethod = useMatchStore((s) => s.matchMethod);
  const results = useMatchStore((s) => s.results);
  const setResumeText = useMatchStore((s) => s.setResumeText);

  return (
    <>
      {/* 简历输入 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted-foreground">
            粘贴您的简历内容
          </label>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setResumeText(SAMPLE_RESUME)}
            className="text-xs cursor-pointer"
          >
            <FileText className="h-3 w-3 mr-1" />
            使用示例简历
          </Button>
        </div>
        <TextArea
          placeholder="请在此粘贴您的简历内容，包括个人信息、教育背景、工作经历、技术栈、期望职位等..."
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={8}
          fullWidth
          className="resize-none"
        />
      </div>

      {/* 匹配按钮 */}
      <Button
        size="lg"
        variant="primary"
        className="w-full text-base cursor-pointer"
        onPress={onMatch}
        isDisabled={isMatching || !resumeText.trim()}
      >
        {isMatching ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {progressMessage}
          </>
        ) : (
          <>
            {results.length > 0 ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                重新匹配
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                开始智能匹配
              </>
            )}
          </>
        )}
      </Button>

      {/* 匹配方法标签 */}
      {matchMethod && !isMatching && (
        <div className="flex items-center justify-center gap-2">
          <Chip
            variant="secondary"
          >
            <Chip.Label className="flex items-center gap-1 text-xs">
              {matchMethod === "embedding+llm" ? (
                <>
                  <Zap className="h-3 w-3" />
                  语义召回 + AI 精排
                </>
              ) : matchMethod === "embedding+rule" ? (
                <>
                  <Cpu className="h-3 w-3" />
                  语义召回 + 规则匹配
                </>
              ) : (
                <>
                  <Cpu className="h-3 w-3" />
                  规则匹配
                </>
              )}
            </Chip.Label>
          </Chip>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </>
  );
}
