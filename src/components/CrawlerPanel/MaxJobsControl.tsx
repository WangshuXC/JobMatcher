"use client";

import { Button, Slider } from "@heroui/react";
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
          onChange={(value) =>
            setMaxJobs(Array.isArray(value) ? value[0] : value)
          }
          minValue={1}
          maxValue={SLIDER_MAX}
          step={getSliderStep()}
          isDisabled={isRunning}
          className="w-full"
          aria-label="抓取岗位数量"
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      )}

      {/* 快捷按钮 + 岗位配置 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Button
            size="sm"
            variant={isAllMode ? "primary" : "outline"}
            onPress={() => setMaxJobs(0)}
            isDisabled={isRunning}
            className="cursor-pointer text-xs px-3"
          >
            全部
          </Button>
          {QUICK_OPTIONS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={!isAllMode && maxJobs === n ? "primary" : "outline"}
              onPress={() => setMaxJobs(n)}
              isDisabled={isRunning}
              className="cursor-pointer text-xs px-3"
            >
              {n} 个
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
