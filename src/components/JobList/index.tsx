"use client";

import { Card, CardHeader, CardContent, useOverlayState, Dropdown, Label } from "@heroui/react";
import { Briefcase, Trash2, Loader2, EllipsisVertical } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import SearchBar from "./SearchBar";
import SourceFilter from "./SourceFilter";
import VirtualJobList from "./VirtualJobList";
import JobDetailModal from "./JobDetailModal";
import ClearConfirmModal from "./ClearConfirmModal";
import { useJobs } from "./useJobs";

export default function JobList() {
  const jobs = useJobStore((s) => s.jobs);
  const filteredJobs = useJobStore((s) => s.filteredJobs);
  const initialLoading = useJobStore((s) => s.initialLoading);
  const setSelectedJob = useJobStore((s) => s.setSelectedJob);

  const detailModal = useOverlayState();
  const clearModal = useOverlayState();

  const { handleSearch, handleFilter, handleClearAll } = useJobs();

  const onSelectJob = (jobId: string) => {
    const found = filteredJobs.find((j) => j.id === jobId);
    if (found) {
      setSelectedJob(found);
      detailModal.open();
    }
  };

  const onConfirmClear = async () => {
    await handleClearAll();
    clearModal.close();
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="flex items-center gap-2 text-xl font-semibold">
          <Briefcase className="h-6 w-6 text-primary" />
          职位列表
        </CardHeader>
        <CardContent className="space-y-4">

          <SearchBar
            onSearch={handleSearch}
            trailing={
              jobs.length > 0 ? (
                <Dropdown>
                  <Dropdown.Trigger
                    aria-label="更多操作"
                    className="button--icon-only data-[focus-visible=true]:status-focused"
                  >
                    <EllipsisVertical className="h-4 w-4 outline-none" />
                  </Dropdown.Trigger>
                  <Dropdown.Popover className="md:min-w-fit">
                    <Dropdown.Menu
                      onAction={(key) => {
                        if (key === "clear-data") {
                          clearModal.open();
                        }
                      }}
                    >
                      <Dropdown.Section>
                        <Dropdown.Item id="clear-data" textValue="清除数据" variant="danger">
                          <div className="flex h-full items-center gap-2">
                            <Trash2 className="size-4 text-danger" />
                            <Label>清除数据</Label>
                          </div>
                        </Dropdown.Item>
                      </Dropdown.Section>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null
            }
          />
          <SourceFilter onFilter={handleFilter} />

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
            <VirtualJobList onSelectJob={onSelectJob} />
          )}
        </CardContent>
      </Card>

      {/* 职位详情弹窗 */}
      <JobDetailModal
        isOpen={detailModal.isOpen}
        onOpenChange={detailModal.setOpen}
        onClose={detailModal.close}
      />

      {/* 清除数据确认弹窗 */}
      <ClearConfirmModal
        isOpen={clearModal.isOpen}
        onOpenChange={clearModal.setOpen}
        onClose={clearModal.close}
        onConfirm={onConfirmClear}
      />
    </>
  );
}
