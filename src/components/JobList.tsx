"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  MapPin,
  Search,
  ExternalLink,
  Hash,
  Building2,
  Trash2,
  Loader2,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { JobPosting } from "@/types";

interface JobListProps {
  refreshTrigger: number;
}

const SOURCE_COLORS: Record<string, string> = {
  bytedance: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  tencent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  alibaba: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const SOURCE_NAMES: Record<string, string> = {
  bytedance: "字节跳动",
  tencent: "腾讯",
  alibaba: "阿里巴巴",
};

export default function JobList({ refreshTrigger }: JobListProps) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobPosting[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("__all__");
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [countBySource, setCountBySource] = useState<Record<string, number>>({});
  const [locations, setLocations] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const detailModal = useOverlayState();
  const clearModal = useOverlayState();

  // 用 ref 保存当前筛选条件，以便 refreshTrigger 触发时能读取最新值
  const filtersRef = useRef({ source: null as string | null, keyword: "", location: "__all__" });
  useEffect(() => {
    filtersRef.current = { source: selectedSource, keyword, location: selectedLocation };
  }, [selectedSource, keyword, selectedLocation]);

  /** 通用请求函数：根据筛选条件拉取职位数据 */
  const fetchJobs = useCallback(async (source: string | null, kw: string, location: string | null) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (kw) params.set("keyword", kw);
    if (location && location !== "__all__") params.set("location", location);

    const response = await fetch(`/api/jobs?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      setJobs(data.data.jobs);
      setFilteredJobs(data.data.jobs);
      setCountBySource(data.data.countBySource);
      setLocations(data.data.locations || []);
    }
  }, []);

  // 组件挂载和 refreshTrigger 变化时拉取数据（保留当前筛选条件）
  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setInitialLoading(true);
      const { source, keyword: kw, location } = filtersRef.current;
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (kw) params.set("keyword", kw);
      if (location && location !== "__all__") params.set("location", location);

      try {
        const response = await fetch(`/api/jobs?${params.toString()}`);
        const data = await response.json();
        if (!cancelled && data.success) {
          setJobs(data.data.jobs);
          setFilteredJobs(data.data.jobs);
          setCountBySource(data.data.countBySource);
          setLocations(data.data.locations || []);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleSearch = () => {
    fetchJobs(selectedSource, keyword, selectedLocation);
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/jobs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setJobs([]);
        setFilteredJobs([]);
        setCountBySource({});
        setLocations([]);
        setSelectedSource(null);
        setSelectedLocation("__all__");
        setKeyword("");
      }
    } finally {
      setClearing(false);
      clearModal.close();
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-semibold">
            <Briefcase className="h-6 w-6 text-primary" />
            职位列表
          </div>
          <div className="flex items-center gap-2">
            {jobs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearModal.open}
                className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 my-2"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                清除数据
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜索和筛选 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索职位名称、描述或地点..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} className="cursor-pointer">
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>
          </div>

          {/* 数据源标签筛选 + 地点筛选 */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* 公司选择 — 左侧 */}
            <Button
              size="sm"
              variant={selectedSource === null ? "default" : "outline"}
              onClick={() => {
                setSelectedSource(null);
                setKeyword("");
                fetchJobs(null, "", selectedLocation);
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
                  fetchJobs(source, keyword, selectedLocation);
                }}
                className="cursor-pointer"
              >
                {SOURCE_NAMES[source] || source} ({count})
              </Button>
            ))}

            {/* 地点筛选 — 右侧 */}
            {locations.length > 0 && (
              <Select
                value={selectedLocation}
                onValueChange={(val) => {
                  const loc = String(val);
                  setSelectedLocation(loc);
                  fetchJobs(selectedSource, keyword, loc);
                }}
              >
                <SelectTrigger className="h-8 min-w-30 ml-auto cursor-pointer">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <SelectValue>
                    {selectedLocation === "__all__"
                      ? "全部地点"
                      : selectedLocation}
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

          {/* 职位列表 */}
          {initialLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary/50" />
              <p className="text-sm">加载职位数据中...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">暂无职位数据</p>
              <p className="text-sm mt-2">请先运行爬虫 Agent 抓取招聘信息</p>
            </div>
          ) : (
            <VirtualJobList
              jobs={filteredJobs}
              onSelectJob={(job) => {
                setSelectedJob(job);
                detailModal.open();
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* 职位详情弹窗 */}
      <ModalBackdrop
        isOpen={detailModal.isOpen}
        onOpenChange={detailModal.setOpen}
        isDismissable
        className="backdrop-blur-sm"
      >
        <ModalContainer size="lg" scroll="inside">
          <ModalDialog>
            {selectedJob && (
              <>
                <HModalHeader>
                  <ModalHeading className="text-xl">{selectedJob.title}</ModalHeading>
                  <ModalCloseTrigger />
                </HModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    {/* 基本信息 */}
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={SOURCE_COLORS[selectedJob.source] || ""}
                      >
                        {SOURCE_NAMES[selectedJob.source] || selectedJob.source}
                      </Badge>
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedJob.location}
                      </Badge>
                      <Badge variant="outline">
                        <Hash className="h-3 w-3 mr-1" />
                        {selectedJob.sourceId}
                      </Badge>
                    </div>

                    <Separator />

                    {/* 职位描述 */}
                    <div>
                      <h4 className="font-semibold mb-2">职位描述</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {selectedJob.description}
                      </p>
                    </div>

                    {selectedJob.requirements && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-2">职位要求</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                            {selectedJob.requirements}
                          </p>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* 跳转原始链接 */}
                    <a
                      href={selectedJob.detailUrl}
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
                  <Button variant="outline" onClick={detailModal.close} className="cursor-pointer">
                    关闭
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>

      {/* 清除数据确认弹窗 */}
      <ModalBackdrop
        isOpen={clearModal.isOpen}
        onOpenChange={clearModal.setOpen}
        isDismissable
      >
        <ModalContainer size="sm">
          <ModalDialog>
            <HModalHeader className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <ModalHeading>确认清除数据</ModalHeading>
            </HModalHeader>
            <ModalBody>
              <p className="text-sm text-muted-foreground">
                此操作将永久删除所有已抓取的 <strong>{jobs.length}</strong> 个职位数据，且无法恢复。确定要继续吗？
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                onClick={clearModal.close}
                disabled={clearing}
                className="cursor-pointer"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAll}
                disabled={clearing}
                className="cursor-pointer"
              >
                {clearing ? "清除中..." : "确认清除"}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </>
  );
}

/** 虚拟化职位列表 — 使用 @tanstack/react-virtual */
const ROW_HEIGHT = 134;
const GAP = 4;

function VirtualJobList({
  jobs,
  onSelectJob,
}: {
  jobs: JobPosting[];
  onSelectJob: (job: JobPosting) => void;
}) {
  "use no memo";
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: GAP,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-125 overflow-y-auto overscroll-y-contain"
      role="listbox"
      aria-label="职位列表"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const job = jobs[virtualRow.index];
          return (
            <div
              key={job.id}
              className="absolute left-0 w-full cursor-pointer border rounded-lg hover:bg-accent/50 transition-colors"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => onSelectJob(job)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectJob(job);
                }
              }}
            >
              <div className="w-full p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">
                      {job.title}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location || "未知"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        {job.sourceId}
                      </span>
                    </div>
                  </div>
                  <Badge
                    className={`shrink-0 ${SOURCE_COLORS[job.source] || ""}`}
                  >
                    {SOURCE_NAMES[job.source] || job.source}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {job.description.slice(0, 120)}...
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
