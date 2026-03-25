"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useCrawlerStore } from "@/stores/crawler-store";

const SLIDER_MAX = 500;
const QUICK_OPTIONS = [10, 20, 50, 100, 200];

function getSliderStep(): number {
  if (SLIDER_MAX <= 20) return 1;
  if (SLIDER_MAX <= 100) return 5;
  return 10;
}

export default function MaxJobsControl() {
  const maxJobs = useCrawlerStore((s) => s.maxJobs);
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const setMaxJobs = useCrawlerStore((s) => s.setMaxJobs);

  const isAllMode = maxJobs === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          抓取岗位数量
        </label>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {isAllMode ? "全部抓取" : `${maxJobs} 个岗位`}
        </span>
      </div>

      {/* 滑块 — 仅在非全部模式下显示 */}
      {!isAllMode && (
        <Slider
          value={[maxJobs]}
          onValueChange={(values) =>
            setMaxJobs(Array.isArray(values) ? values[0] : values)
          }
          min={1}
          max={SLIDER_MAX}
          step={getSliderStep()}
          disabled={isRunning}
          className="w-full"
        />
      )}

      {/* 快捷按钮 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={isAllMode ? "default" : "outline"}
          onClick={() => setMaxJobs(0)}
          disabled={isRunning}
          className="cursor-pointer text-xs px-3"
        >
          全部
        </Button>
        {QUICK_OPTIONS.map((n) => (
          <Button
            key={n}
            size="sm"
            variant={!isAllMode && maxJobs === n ? "default" : "outline"}
            onClick={() => setMaxJobs(n)}
            disabled={isRunning}
            className="cursor-pointer text-xs px-3"
          >
            {n} 个
          </Button>
        ))}
      </div>
    </div>
  );
}
