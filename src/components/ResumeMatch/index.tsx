"use client";

import { Card, CardHeader, CardContent, useOverlayState } from "@heroui/react";
import { Brain } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";
import ResumeInput from "./ResumeInput";
import ProfileCard from "./ProfileCard";
import MatchResultList from "./MatchResultList";
import MatchDetailModal from "./MatchDetailModal";
import { useMatch } from "./useMatch";
import { MatchResult } from "@/types";

export default function ResumeMatch() {
  const setSelectedMatch = useMatchStore((s) => s.setSelectedMatch);
  const matchDetailModal = useOverlayState();
  const { handleMatch } = useMatch();

  const onSelectMatch = (match: MatchResult) => {
    setSelectedMatch(match);
    matchDetailModal.open();
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="flex items-center gap-2 text-xl font-semibold">
          <Brain className="h-6 w-6 text-primary" />
          智能简历匹配
        </CardHeader>
        <CardContent className="space-y-4">
          <ResumeInput onMatch={handleMatch} />
          <ProfileCard />
          <MatchResultList onSelectMatch={onSelectMatch} />
        </CardContent>
      </Card>

      {/* 匹配详情弹窗 */}
      <MatchDetailModal
        isOpen={matchDetailModal.isOpen}
        onOpenChange={matchDetailModal.setOpen}
        onClose={matchDetailModal.close}
      />
    </>
  );
}
