"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  MapPin,
  Search,
  ExternalLink,
  Hash,
  Building2,
  Trash2,
} from "lucide-react";
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
  // 用于筛选/搜索切换时跳过入场动画 + 滚回顶部
  const [listKey, setListKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  /** 重置滚动位置到顶部 */
  const scrollToTop = useCallback(() => {
    // ScrollArea 的 viewport 是内部的 [data-slot="scroll-area-viewport"] div
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport], [data-slot='scroll-area-viewport']"
    );
    if (viewport) {
      viewport.scrollTop = 0;
    }
  }, []);

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
      // 筛选后重置列表 key（跳过动画）并滚回顶部
      setListKey((k) => k + 1);
      scrollToTop();
    }
  }, [scrollToTop]);

  // 组件挂载和 refreshTrigger 变化时拉取数据
  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      const response = await fetch("/api/jobs");
      const data = await response.json();
      if (!cancelled && data.success) {
        setJobs(data.data.jobs);
        setFilteredJobs(data.data.jobs);
        setCountBySource(data.data.countBySource);
        setLocations(data.data.locations || []);
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
        setListKey((k) => k + 1);
      }
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl">
              <Briefcase className="h-6 w-6 text-primary" />
              职位列表
            </div>
            <div className="flex items-center gap-2">
              {jobs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  清除数据
                </Button>
              )}
              <Badge variant="secondary" className="text-sm">
                共 {jobs.length} 个职位
              </Badge>
            </div>
          </CardTitle>
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

          {/* 数据源标签筛选 */}
          <div className="flex gap-2 flex-wrap items-center">
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

            {/* 地点筛选 */}
            {locations.length > 0 && (
              <Select
                value={selectedLocation}
                onValueChange={(val) => {
                  const loc = String(val);
                  setSelectedLocation(loc);
                  fetchJobs(selectedSource, keyword, loc);
                }}
              >
                <SelectTrigger className="h-8 min-w-[120px] cursor-pointer">
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
          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">暂无职位数据</p>
              <p className="text-sm mt-2">请先运行爬虫 Agent 抓取招聘信息</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]" ref={scrollRef}>
              <div key={listKey} className="space-y-3 pr-4">
                {filteredJobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(index * 0.02, 0.3),
                    }}
                  >
                      <button
                        type="button"
                        className="w-full text-left p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card"
                        onClick={() => setSelectedJob(job)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">
                              {job.title}
                            </h3>
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
                            className={`shrink-0 ${
                              SOURCE_COLORS[job.source] || ""
                            }`}
                          >
                            {SOURCE_NAMES[job.source] || job.source}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {job.description.slice(0, 120)}...
                        </p>
                      </button>
                    </motion.div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 职位详情弹窗 */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto p-6">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl pr-6">
                  {selectedJob.title}
                </DialogTitle>
              </DialogHeader>
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 清除数据确认弹窗 */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              确认清除数据
            </DialogTitle>
            <DialogDescription>
              此操作将永久删除所有已抓取的 <strong>{jobs.length}</strong> 个职位数据，且无法恢复。确定要继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
