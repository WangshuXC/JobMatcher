"use client";

import { useState, useMemo } from "react";
import { Building2, Settings2 } from "lucide-react";
import { Button, Badge } from "@heroui/react";
import { useCrawlerStore } from "@/stores/crawler-store";
import { SOURCE_CATEGORIES } from "@/lib/crawler/categories";
import SourceConfigDrawer from "./SourceConfigDrawer";

export default function SourceSelector() {
  const sources = useCrawlerStore((s) => s.sources);
  const selectedSources = useCrawlerStore((s) => s.selectedSources);
  const isRunning = useCrawlerStore((s) => s.isRunning);
  const toggleSource = useCrawlerStore((s) => s.toggleSource);
  const categoryConfig = useCrawlerStore((s) => s.categoryConfig);

  /** 当前打开 Drawer 的数据源 ID，null 表示关闭 */
  const [drawerSourceId, setDrawerSourceId] = useState<string | null>(null);

  /** 每个数据源在 store 中已选子分类数量（用于 Badge 显示） */
  const sourceSelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const source of sources) {
      counts[source.id] = (categoryConfig[source.id] || []).length;
    }
    return counts;
  }, [sources, categoryConfig]);

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 text-muted-foreground">
        选择招聘数据源
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sources.map((source) => {
          const isSelected = selectedSources.includes(source.id);
          const hasCategories = !!SOURCE_CATEGORIES[source.id];

          return (
            <div key={source.id} className="relative h-full">
              {/* 数据源选择按钮 */}
              <Button
                variant={isSelected ? "outline" : "ghost"}
                onPress={() => toggleSource(source.id)}
                isDisabled={isRunning}
                className={`w-full h-full rounded-xl border-2 p-4 justify-start transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="text-base font-bold text-foreground">{source.name}</p>
                </div>
              </Button>

              {/* 右侧：配置按钮（绝对定位叠加） */}
              {isSelected && hasCategories && (
                <Button
                  variant="primary"
                  isIconOnly
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 min-w-8 cursor-pointer"
                  onPress={() => setDrawerSourceId(source.id)}
                  isDisabled={isRunning}
                >
                  <Settings2 className="h-4 w-4" />
                  {sourceSelectedCounts[source.id] > 0 && (
                    <Badge
                      color="accent"
                      size="sm"
                      placement="top-right"
                      className="absolute -top-1.5 -right-1.5"
                    >
                      <Badge.Label>
                        {sourceSelectedCounts[source.id]}
                      </Badge.Label>
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* 岗位配置 Drawer */}
      <SourceConfigDrawer
        sourceId={drawerSourceId}
        onClose={() => setDrawerSourceId(null)}
      />
    </div>
  );
}
