"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Card,
  CardHeader,
  CardContent,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader as HModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
  useOverlayState,
} from "@heroui/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Sparkles,
  Loader2,
  Target,
  MapPin,
  Star,
  TrendingUp,
  Brain,
  Building2,
  ExternalLink,
} from "lucide-react";
import { MatchResult } from "@/types";

interface ResumeProfile {
  skills: string[];
  experienceYears: number;
  education: string;
  expectedRole: string[];
  preferredLocations: string[];
}

const SAMPLE_RESUME = `张三
前端工程师 | 5年工作经验

联系方式：zhangsan@example.com | 北京

教育背景：
2015-2019 北京大学 计算机科学与技术 本科

工作经历：
2022-至今 某知名科技公司 高级前端工程师
- 负责公司核心产品的前端架构设计与开发
- 使用 React、TypeScript、Next.js 构建高性能 Web 应用
- 主导微前端架构迁移，提升团队开发效率 30%
- 使用 Webpack/Vite 优化构建流程，首屏加载时间减少 50%

2019-2022 另一家科技公司 前端工程师
- 参与电商平台前端开发，使用 Vue.js 和 Element UI
- 负责小程序端开发（微信小程序）
- 使用 Node.js 开发 BFF 层

技术栈：
JavaScript, TypeScript, React, Vue, Next.js, Node.js, 
Webpack, Vite, TailwindCSS, GraphQL, REST API,
Docker, Git, CI/CD, Jest, Playwright

期望：
- 期望职位：高级前端工程师 / 前端架构师
- 期望地点：北京、上海、杭州
- 期望薪资：面议`;

export default function ResumeMatch() {
  const [resumeText, setResumeText] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");

  const matchDetailModal = useOverlayState();

  const handleMatch = async () => {
    if (!resumeText.trim()) {
      setError("请输入简历内容");
      return;
    }

    setIsMatching(true);
    setError("");
    setResults([]);
    setProfile(null);

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, topN: 20 }),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(data.data.resume);
        setResults(data.data.matches);
      } else {
        setError(data.error || "匹配失败");
      }
    } catch (err) {
      console.error("匹配请求失败:", err);
      setError("请求失败，请重试");
    } finally {
      setIsMatching(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="flex items-center gap-2 text-xl font-semibold">
          <Brain className="h-6 w-6 text-primary" />
          智能简历匹配
        </CardHeader>
        <CardContent className="space-y-4">
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
            onClick={handleMatch}
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

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* 简历解析结果 */}
          <AnimatePresence>
            {profile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-muted/50 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  简历解析结果
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">识别技能：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.skills.slice(0, 10).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {profile.skills.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{profile.skills.length - 10}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p>
                      <span className="text-muted-foreground">工作年限：</span>
                      <span className="font-medium">
                        {profile.experienceYears} 年
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">学历：</span>
                      <span className="font-medium">
                        {profile.education || "未识别"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">期望方向：</span>
                      <span className="font-medium">
                        {profile.expectedRole.join("、") || "未识别"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">期望城市：</span>
                      <span className="font-medium">
                        {profile.preferredLocations.join("、") || "未识别"}
                      </span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 匹配结果列表 */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  匹配结果（共 {results.length} 个推荐职位）
                </h3>
                <ScrollArea className="h-100">
                  <div className="space-y-3 pr-4">
                    {results.map((match, index) => (
                      <motion.div
                        key={match.job.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 0.5) }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMatch(match);
                            matchDetailModal.open();
                          }}
                          className="w-full text-left p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-muted-foreground">
                                  #{index + 1}
                                </span>
                                <h4 className="font-semibold truncate">
                                  {match.job.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {match.job.company}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {match.job.location}
                                </span>
                              </div>
                              {/* 匹配理由 */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {match.reasons.slice(0, 2).map((reason, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {reason}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {/* 匹配分数 */}
                            <div className="text-center shrink-0">
                              <div
                                className={`text-2xl font-bold ${getScoreColor(
                                  match.score
                                )}`}
                              >
                                {match.score}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Star className="h-3 w-3" />
                                匹配度
                              </div>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 匹配详情弹窗 */}
      <ModalBackdrop
        isOpen={matchDetailModal.isOpen}
        onOpenChange={matchDetailModal.setOpen}
        isDismissable
        className="backdrop-blur-sm"
      >
        <ModalContainer size="lg" scroll="inside">
          <ModalDialog>
            {selectedMatch && (
              <>
                <HModalHeader>
                  <ModalHeading className="text-xl">{selectedMatch.job.title}</ModalHeading>
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
                          总匹配度
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

                    {/* 匹配理由 */}
                    <div>
                      <h4 className="font-semibold mb-2">匹配分析</h4>
                      <div className="space-y-1">
                        {selectedMatch.reasons.map((reason, i) => (
                          <p
                            key={i}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="text-primary mt-0.5">•</span>
                            {reason}
                          </p>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* 职位信息 */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        <Building2 className="h-3 w-3 mr-1" />
                        {selectedMatch.job.company}
                      </Badge>
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedMatch.job.location}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">职位描述</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {selectedMatch.job.description}
                      </p>
                    </div>

                    {selectedMatch.job.requirements && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-2">职位要求</h4>
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
                  <Button variant="outline" onClick={matchDetailModal.close} className="cursor-pointer">
                    关闭
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </>
  );
}
