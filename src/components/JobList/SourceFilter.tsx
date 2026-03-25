"use client";

import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobStore } from "@/stores/job-store";

const SOURCE_NAMES: Record<string, string> = {
  bytedance: "字节跳动",
  tencent: "腾讯",
  alibaba: "阿里巴巴",
};

interface SourceFilterProps {
  onFilter: (source: string | null, location: string) => void;
}

export default function SourceFilter({ onFilter }: SourceFilterProps) {
  const selectedSource = useJobStore((s) => s.selectedSource);
  const selectedLocation = useJobStore((s) => s.selectedLocation);
  const countBySource = useJobStore((s) => s.countBySource);
  const locations = useJobStore((s) => s.locations);
  const setSelectedSource = useJobStore((s) => s.setSelectedSource);
  const setSelectedLocation = useJobStore((s) => s.setSelectedLocation);
  const setKeyword = useJobStore((s) => s.setKeyword);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* 公司选择 */}
      <Button
        size="sm"
        variant={selectedSource === null ? "default" : "outline"}
        onClick={() => {
          setSelectedSource(null);
          setKeyword("");
          onFilter(null, selectedLocation);
        }}
        className="cursor-pointer"
      >
        全部 ({Object.values(countBySource).reduce((a, b) => a + b, 0)})
      </Button>
      {Object.entries(countBySource).map(([source, count]) => (
        <Button
          key={source}
          size="sm"
          variant={selectedSource === source ? "default" : "outline"}
          onClick={() => {
            setSelectedSource(source);
            onFilter(source, selectedLocation);
          }}
          className="cursor-pointer"
        >
          {SOURCE_NAMES[source] || source} ({count})
        </Button>
      ))}

      {/* 地点筛选 */}
      {locations.length > 0 && (
        <Select
          value={selectedLocation}
          onValueChange={(val) => {
            const loc = String(val);
            setSelectedLocation(loc);
            onFilter(selectedSource, loc);
          }}
        >
          <SelectTrigger className="h-8 min-w-30 ml-auto cursor-pointer">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            <SelectValue>
              {selectedLocation === "__all__" ? "全部地点" : selectedLocation}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部地点</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
