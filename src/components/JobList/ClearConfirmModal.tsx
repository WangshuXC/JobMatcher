"use client";

import { Button } from "@heroui/react";
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader as HModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useJobStore } from "@/stores/job-store";

interface ClearConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ClearConfirmModal({
  isOpen,
  onOpenChange,
  onClose,
  onConfirm,
}: ClearConfirmModalProps) {
  const jobs = useJobStore((s) => s.jobs);
  const clearing = useJobStore((s) => s.clearing);

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
              此操作将永久删除所有已抓取的{" "}
              <strong>{jobs.length}</strong>{" "}
              个职位数据，且无法恢复。确定要继续吗？
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onPress={onClose}
              isDisabled={clearing}
              className="cursor-pointer"
            >
              取消
            </Button>
            <Button
              variant="danger"
              onPress={onConfirm}
              isDisabled={clearing}
              className="cursor-pointer"
            >
              {clearing ? "清除中..." : "确认清除"}
            </Button>
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
}
