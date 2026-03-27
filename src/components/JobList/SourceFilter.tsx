"use client";

import { useRef, useEffect, useState } from "react";
import { Button, Checkbox, CheckboxGroup } from "@heroui/react";
import { MapPin, ChevronDown, X } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { getSourceName } from "@/lib/crawler/source-meta";

interface SourceFilterProps {
  onFilter: (source: string | null, locations: string[]) => void;
}

export default function SourceFilter({ onFilter }: SourceFilterProps) {
  const selectedSource = useJobStore((s) => s.selectedSource);
  const selectedLocations = useJobStore((s) => s.selectedLocations);
  const countBySource = useJobStore((s) => s.countBySource);
  const locationGroups = useJobStore((s) => s.locationGroups);
  const setSelectedSource = useJobStore((s) => s.setSelectedSource);
  const setSelectedLocations = useJobStore((s) => s.setSelectedLocations);
  const setKeyword = useJobStore((s) => s.setKeyword);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭 popover
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  const hasLocations =
    locationGroups.length > 0 &&
    locationGroups.some((g) => g.locations.length > 0);

  /** 地点选中变更 */
  const handleLocationsChange = (newValues: string[]) => {
    setSelectedLocations(newValues);
    onFilter(selectedSource, newValues);
  };

  /** 清空地点筛选 */
  const handleClearLocations = () => {
    setSelectedLocations([]);
    onFilter(selectedSource, []);
  };

  /** 触发按钮文案 */
  const triggerLabel =
    selectedLocations.length === 0
      ? "全部地点"
      : selectedLocations.length <= 2
        ? selectedLocations.join("、")
        : `${selectedLocations.slice(0, 2).join("、")} 等${selectedLocations.length}个`;

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* 公司选择 */}
      <Button
        size="sm"
        variant={selectedSource === null ? "primary" : "outline"}
        onPress={() => {
          setSelectedSource(null);
          setKeyword("");
          onFilter(null, selectedLocations);
        }}
        className="cursor-pointer"
      >
        全部 ({Object.values(countBySource).reduce((a, b) => a + b, 0)})
      </Button>
      {Object.entries(countBySource).map(([source, count]) => (
        <Button
          key={source}
          size="sm"
          variant={selectedSource === source ? "primary" : "outline"}
          onPress={() => {
            setSelectedSource(source);
            onFilter(source, selectedLocations);
          }}
          className="cursor-pointer"
        >
          {getSourceName(source)} ({count})
        </Button>
      ))}

      {/* 地点筛选 - Popover + CheckboxGroup */}
      {hasLocations && (
        <div className="relative ml-auto">
          <button
            ref={triggerRef}
            onClick={() => setPopoverOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-32 truncate">{triggerLabel}</span>
            {selectedLocations.length > 0 ? (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearLocations();
                }}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </span>
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {popoverOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-3 shadow-lg"
            >
              <CheckboxGroup
                value={selectedLocations}
                onChange={handleLocationsChange}
                className="flex flex-col gap-3"
              >
                {locationGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                      {group.label}
                    </div>
                    <div className="flex flex-wrap gap-x-1 gap-y-1">
                      {group.locations.map(({ name, count }) => (
                        <Checkbox
                          key={name}
                          value={name}
                          className="inline-flex items-center gap-1 text-xs p-1 mt-0 rounded border cursor-pointer transition-colors select-none hover:bg-accent data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-primary"
                        >
                          <Checkbox.Control className="hidden" />
                          <Checkbox.Content>
                            <div className="flex items-center gap-1">
                              <span>{name}</span>
                              <span className="text-[10px] opacity-60">
                                {count}
                              </span>
                            </div>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                ))}
              </CheckboxGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
