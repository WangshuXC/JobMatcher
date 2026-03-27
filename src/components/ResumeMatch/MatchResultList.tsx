"use client";

import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Star, Building2, MapPin } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";
import { MatchResult } from "@/types";

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

interface MatchResultListProps {
  onSelectMatch: (match: MatchResult) => void;
}

export default function MatchResultList({ onSelectMatch }: MatchResultListProps) {
  const results = useMatchStore((s) => s.results);

  const handleClick = (match: MatchResult) => {
    onSelectMatch(match);
  };

  return (
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
                  key={match.job.id + index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                >
                  <button
                    type="button"
                    onClick={() => handleClick(match)}
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
  );
}
