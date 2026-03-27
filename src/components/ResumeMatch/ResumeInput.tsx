"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Loader2, Cpu, Zap } from "lucide-react";
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
            onClick={() => setResumeText(SAMPLE_RESUME)}
            className="text-xs cursor-pointer"
          >
            <FileText className="h-3 w-3 mr-1" />
            使用示例简历
          </Button>
        </div>
        <Textarea
          placeholder="请在此粘贴您的简历内容，包括个人信息、教育背景、工作经历、技术栈、期望职位等..."
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={8}
          className="resize-none"
        />
      </div>

      {/* 匹配按钮 */}
      <Button
        size="lg"
        className="w-full text-base cursor-pointer"
        onClick={onMatch}
        disabled={isMatching || !resumeText.trim()}
      >
        {isMatching ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            AI 正在分析匹配中...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            开始智能匹配
          </>
        )}
      </Button>

      {/* 进度消息 */}
      {isMatching && progressMessage && (
        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {progressMessage}
        </div>
      )}

      {/* 匹配方法标签 */}
      {matchMethod && !isMatching && (
        <div className="flex items-center justify-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs"
          >
            {matchMethod === "embedding+llm" ? (
              <>
                <Zap className="h-3 w-3 mr-1" />
                语义召回 + AI 精排
              </>
            ) : matchMethod === "embedding+rule" ? (
              <>
                <Cpu className="h-3 w-3 mr-1" />
                语义召回 + 规则匹配
              </>
            ) : (
              <>
                <Cpu className="h-3 w-3 mr-1" />
                规则匹配
              </>
            )}
          </Badge>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </>
  );
}
