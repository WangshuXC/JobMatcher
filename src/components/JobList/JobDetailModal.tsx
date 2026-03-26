"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader as HModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
} from "@heroui/react";
import { MapPin, ExternalLink, Hash } from "lucide-react";
import { useJobStore } from "@/stores/job-store";
import { getSourceName, getSourceColor } from "@/lib/crawler/source-meta";

interface JobDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export default function JobDetailModal({
  isOpen,
  onOpenChange,
  onClose,
}: JobDetailModalProps) {
  const selectedJob = useJobStore((s) => s.selectedJob);

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="backdrop-blur-sm"
    >
      <ModalContainer size="lg" scroll="inside">
        <ModalDialog>
          {selectedJob && (
            <>
              <HModalHeader>
                <ModalHeading className="text-xl">
                  {selectedJob.title}
                </ModalHeading>
                <ModalCloseTrigger />
              </HModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={getSourceColor(selectedJob.source)}
                    >
                      {getSourceName(selectedJob.source)}
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
                    <h4 className="font-semibold text-foreground/80 mb-2">职位描述</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {selectedJob.description}
                    </p>
                  </div>

                  {selectedJob.requirements && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-foreground/80 mb-2">职位要求</h4>
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
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="cursor-pointer"
                >
                  关闭
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
}
