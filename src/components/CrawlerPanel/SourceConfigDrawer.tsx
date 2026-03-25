"use client";

import { useState, useCallback } from "react";
import {
  Checkbox,
  CheckboxGroup,
  Label,
  Input,
  Drawer,
  Disclosure,
  DisclosureGroup,
} from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useCrawlerStore, KeywordConfig } from "@/stores/crawler-store";
import { SOURCE_CATEGORIES } from "@/lib/crawler/categories";
import { JobCategory } from "@/types";

/** 数据源中文名映射 */
const SOURCE_NAMES: Record<string, string> = {
  bytedance: "字节跳动",
  tencent: "腾讯",
  alibaba: "阿里巴巴",
};

interface SourceConfigDrawerProps {
  /** 当前配置的数据源 ID，null 表示关闭 */
  sourceId: string | null;
  /** 关闭 Drawer 的回调 */
  onClose: () => void;
}

export default function SourceConfigDrawer({
  sourceId,
  onClose,
}: SourceConfigDrawerProps) {
  const categoryConfig = useCrawlerStore((s) => s.categoryConfig);
  const keywordConfig = useCrawlerStore((s) => s.keywordConfig);
  const setCategoryConfig = useCrawlerStore((s) => s.setCategoryConfig);
  const setKeywordConfig = useCrawlerStore((s) => s.setKeywordConfig);

  /** 临时编辑状态 —— 打开 Drawer 时从 store 拷贝，确认后写回 */
  const [draft, setDraft] = useState(categoryConfig);
  const [keywordDraft, setKeywordDraft] =
    useState<KeywordConfig>(keywordConfig);

  /** 同步最新 store 数据到 draft（open 回调中调用） */
  const syncDraft = useCallback(() => {
    setDraft({ ...useCrawlerStore.getState().categoryConfig });
    setKeywordDraft({ ...useCrawlerStore.getState().keywordConfig });
  }, []);

  const handleConfirm = () => {
    if (!sourceId) return;
    setCategoryConfig(sourceId, draft[sourceId] || []);
    if (keywordDraft[sourceId] !== undefined) {
      setKeywordConfig(sourceId, keywordDraft[sourceId] || "");
    }
    onClose();
  };

  /** 切换大类下所有子分类的 CheckboxGroup onChange */
  const handleSubCategoryChange = useCallback(
    (sid: string, category: JobCategory, newSelected: string[]) => {
      setDraft((prev) => {
        const current = prev[sid] || [];
        const subIds = new Set(category.subCategories.map((s) => s.id));
        const withoutThisCategory = current.filter((id) => !subIds.has(id));
        const next = [...withoutThisCategory, ...newSelected];
        return { ...prev, [sid]: next };
      });
    },
    []
  );

  /** 切换大类（全选/全不选该大类下的所有子分类） */
  const toggleCategory = useCallback(
    (sid: string, category: JobCategory, isSelected: boolean) => {
      setDraft((prev) => {
        const current = prev[sid] || [];
        const subIds = category.subCategories.map((s) => s.id);
        let next: string[];
        if (isSelected) {
          const currentSet = new Set(current);
          for (const id of subIds) {
            currentSet.add(id);
          }
          next = Array.from(currentSet);
        } else {
          next = current.filter((id) => !subIds.includes(id));
        }
        return { ...prev, [sid]: next };
      });
    },
    []
  );

  /** 全选某个数据源的所有子分类 */
  const selectAllSource = useCallback((sid: string) => {
    const categories = SOURCE_CATEGORIES[sid] || [];
    const allSubIds = categories.flatMap((c) =>
      c.subCategories.map((s) => s.id)
    );
    setDraft((prev) => ({ ...prev, [sid]: allSubIds }));
  }, []);

  /** 清空某个数据源的所有选择 */
  const clearAllSource = useCallback((sid: string) => {
    setDraft((prev) => ({ ...prev, [sid]: [] }));
  }, []);

  /** 获取大类下选中的子分类 ID 列表 */
  const getSelectedSubIds = (sid: string, category: JobCategory): string[] => {
    const selected = new Set(draft[sid] || []);
    return category.subCategories
      .map((s) => s.id)
      .filter((id) => selected.has(id));
  };

  // 当前数据源的分类数据
  const categories = sourceId ? SOURCE_CATEGORIES[sourceId] || [] : [];
  const selected = sourceId ? draft[sourceId] || [] : [];
  const allSubIds = categories.flatMap((c) =>
    c.subCategories.map((s) => s.id)
  );
  const allSelected =
    allSubIds.length > 0 && allSubIds.every((id) => selected.includes(id));

  return (
    <Drawer.Backdrop
      isOpen={!!sourceId}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          syncDraft();
        } else {
          onClose();
        }
      }}
      isDismissable
    >
      <Drawer.Content placement="left" className="max-w-md w-full">
        <Drawer.Dialog>
          <Drawer.Header className="border-b border-border/50">
            <Drawer.Heading className="text-base font-semibold">
              {sourceId
                ? `${SOURCE_NAMES[sourceId] || sourceId} · 岗位配置`
                : "岗位配置"}
            </Drawer.Heading>
            <Drawer.CloseTrigger />
          </Drawer.Header>

          <Drawer.Body className="overflow-y-auto py-4 px-2">
            {sourceId && (
              <div className="space-y-4">
                {/* 全选/清空 + 统计 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    已选 {selected.length} 个子分类
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      allSelected
                        ? clearAllSource(sourceId)
                        : selectAllSource(sourceId)
                    }
                    className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                  >
                    {allSelected ? "清空" : "全选"}
                  </button>
                </div>

                {/* 腾讯数据源的关键词输入 */}
                {sourceId === "tencent" && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        搜索关键词
                      </Label>
                      <Input
                        aria-label="腾讯搜索关键词"
                        placeholder="输入关键词筛选岗位，如：前端、后端"
                        value={keywordDraft[sourceId] || ""}
                        onChange={(e) =>
                          setKeywordDraft((prev) => ({
                            ...prev,
                            [sourceId]: e.target.value,
                          }))
                        }
                        className="flex-1 text-xs placeholder:text-muted-foreground/70"
                      />
                    </div>
                  </div>
                )}

                {/* 大类列表 - DisclosureGroup */}
                <DisclosureGroup
                  allowsMultipleExpanded
                  className="flex flex-col gap-1"
                >
                  {categories.map((cat) => {
                    const hasSubCategories = cat.subCategories.length > 0;
                    const selectedSubIds = getSelectedSubIds(sourceId, cat);
                    const allSubSelected =
                      hasSubCategories &&
                      selectedSubIds.length === cat.subCategories.length;
                    const someSubSelected =
                      selectedSubIds.length > 0 && !allSubSelected;

                    return (
                      <Disclosure
                        key={cat.id}
                        id={cat.id}
                        className="rounded-lg overflow-hidden"
                      >
                        {/* 大类行：左侧 Checkbox 全选 + Disclosure 触发器 */}
                        <div className="flex items-center gap-2 py-2">
                          <Checkbox
                            isIndeterminate={someSubSelected}
                            isSelected={allSubSelected}
                            isDisabled={!hasSubCategories}
                            onChange={(isSelected: boolean) =>
                              toggleCategory(sourceId, cat, isSelected)
                            }
                          >
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox>

                          <Disclosure.Heading className="flex-1">
                            <Disclosure.Trigger className="flex items-center justify-between w-full text-left text-xs font-medium cursor-pointer select-none py-0.5 text-primary transition-colors">
                              <span>
                                {cat.name}
                                {hasSubCategories && (
                                  <span className="text-muted-foreground font-normal ml-1">
                                    ({selectedSubIds.length}/
                                    {cat.subCategories.length})
                                  </span>
                                )}
                              </span>
                              <Disclosure.Indicator className="transition-transform duration-200" />
                            </Disclosure.Trigger>
                          </Disclosure.Heading>
                        </div>

                        {/* 子分类列表 - 展开内容 */}
                        {hasSubCategories && (
                          <Disclosure.Content>
                            <Disclosure.Body className="px-3 pb-3">
                              <CheckboxGroup
                                value={selectedSubIds}
                                onChange={(newValues: string[]) =>
                                  handleSubCategoryChange(
                                    sourceId,
                                    cat,
                                    newValues
                                  )
                                }
                                className="ml-6 flex flex-col gap-1.5"
                              >
                                {cat.subCategories.map((sub) => (
                                  <Checkbox key={sub.id} value={sub.id}>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Checkbox.Content>
                                      <Label className="text-xs cursor-pointer">
                                        {sub.name}
                                      </Label>
                                    </Checkbox.Content>
                                  </Checkbox>
                                ))}
                              </CheckboxGroup>
                            </Disclosure.Body>
                          </Disclosure.Content>
                        )}
                      </Disclosure>
                    );
                  })}
                </DisclosureGroup>
              </div>
            )}
          </Drawer.Body>

          <Drawer.Footer className="border-t border-border/50 flex gap-2 p-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="cursor-pointer flex-1"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              className="cursor-pointer flex-1"
            >
              确认
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
