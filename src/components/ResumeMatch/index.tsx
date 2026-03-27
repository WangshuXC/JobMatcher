"use client";

import { Card, CardHeader, CardContent, useOverlayState, Button } from "@heroui/react";
import { Brain, Settings } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";
import ResumeInput from "./ResumeInput";
import ProfileCard from "./ProfileCard";
import MatchResultList from "./MatchResultList";
import MatchDetailModal from "./MatchDetailModal";
import SettingsModal from "./SettingsModal";
import { useMatch } from "./useMatch";
import { MatchResult } from "@/types";

export default function ResumeMatch() {
  const setSelectedMatch = useMatchStore((s) => s.setSelectedMatch);
  const matchDetailModal = useOverlayState();
  const settingsModal = useOverlayState();
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
          <span className="flex-1">智能简历匹配</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => settingsModal.open()}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4 mr-1" />
            AI 设置
          </Button>
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

      {/* AI 设置弹窗 */}
      <SettingsModal
        isOpen={settingsModal.isOpen}
        onOpenChange={settingsModal.setOpen}
        onClose={settingsModal.close}
      />
    </>
  );
}
