"use client";

import { motion, AnimatePresence } from "motion/react";
import { Chip } from "@heroui/react";
import { Target } from "lucide-react";
import { useMatchStore } from "@/stores/match-store";

const SKILL_NUM = 20;

export default function ProfileCard() {
  const profile = useMatchStore((s) => s.profile);

  return (
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
                {profile.skills.slice(0, SKILL_NUM).map((skill) => (
                  <Chip key={skill} variant="soft">
                    <Chip.Label className="text-xs">{skill}</Chip.Label>
                  </Chip>
                ))}
                {profile.skills.length > SKILL_NUM && (
                  <Chip variant="soft">
                    <Chip.Label className="text-xs">+{profile.skills.length - SKILL_NUM}</Chip.Label>
                  </Chip>
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
  );
}
