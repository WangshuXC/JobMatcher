"use client";

import { Chip, Separator } from "@heroui/react";
import { Button } from "@heroui/react";
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader as HModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
} from "@heroui/react";
import { Building2, MapPin, ExternalLink } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

interface MatchDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export default function MatchDetailModal({
  isOpen,
  onOpenChange,
  onClose,
}: MatchDetailModalProps) {
  const selectedMatch = useMatchStore((s) => s.selectedMatch);
  const matchMethod = useMatchStore((s) => s.matchMethod);

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="backdrop-blur-sm"
    >
      <ModalContainer size="lg" scroll="outside">
        <ModalDialog>
          {selectedMatch && (
            <>
              <HModalHeader>
                <ModalHeading className="text-xl">
                  {selectedMatch.job.title}
                </ModalHeading>
                <ModalCloseTrigger />
              </HModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {/* 匹配总分 */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="text-center">
                      <div
                        className={`text-4xl font-bold ${getScoreColor(
                          selectedMatch.score
                        )}`}
                      >
                        {selectedMatch.score}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {matchMethod === "embedding+llm"
                          ? "AI 评分"
                          : "总匹配度"}
                      </p>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[
                        { label: "技能匹配", value: selectedMatch.breakdown.skillMatch },
                        { label: "地点匹配", value: selectedMatch.breakdown.locationMatch },
                        { label: "经验匹配", value: selectedMatch.breakdown.experienceMatch },
                        { label: "方向相关", value: selectedMatch.breakdown.roleRelevance },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {item.label}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getScoreBg(item.value)}`}
                              style={{ width: `${item.value}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 匹配分析 */}
                  <div>
                    <h4 className="font-semibold text-foreground/80 mb-2">
                      {matchMethod === "embedding+llm" ? "AI 匹配分析" : "匹配分析"}
                    </h4>
                    <div className="space-y-1.5">
                      {selectedMatch.reasons.map((reason, i) => (
                        <p
                          key={i}
                          className={`text-sm flex items-start gap-2 ${
                            reason.startsWith("✅")
                              ? "text-green-600"
                              : reason.startsWith("⚠️")
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {!reason.startsWith("✅") && !reason.startsWith("⚠️") && (
                            <span className="text-primary mt-0.5">•</span>
                          )}
                          {reason}
                        </p>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* 职位信息 */}
                  <div className="flex flex-wrap gap-2">
                    <Chip  variant="secondary">
                      <Chip.Label className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {selectedMatch.job.company}
                      </Chip.Label>
                    </Chip>
                    <Chip  variant="primary">
                      <Chip.Label className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedMatch.job.location}
                      </Chip.Label>
                    </Chip>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground/80 mb-2">职位描述</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {selectedMatch.job.description}
                    </p>
                  </div>

                  {selectedMatch.job.requirements && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-foreground/80 mb-2">职位要求</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                          {selectedMatch.job.requirements}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <a
                    href={selectedMatch.job.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    查看原始职位页面
                  </a>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="outline"
                  onPress={onClose}
                  className="cursor-pointer"
                >
                  关闭
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
}
