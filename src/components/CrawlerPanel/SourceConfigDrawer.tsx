"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Label,
  Input,
  Drawer,
  Disclosure,
  DisclosureGroup,
} from "@heroui/react";
import { useCrawlerStore, KeywordConfig } from "@/stores/crawler-store";
import { SOURCE_CATEGORIES } from "@/lib/crawler/categories";
import { JobCategory } from "@/types";

/** 支持关键词搜索的数据源 */
const KEYWORD_SOURCES = new Set(["tencent", "jd"]);

import { getSourceName } from "@/lib/crawler/source-meta";

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

  /**
   * 获取某个大类下所有可选 ID：
   * - 有子分类 → 子分类 ID 列表
   * - 无子分类 → 大类自身 ID（作为叶子节点直接选中）
   */
  const getSelectableIds = useCallback((cat: JobCategory): string[] => {
    return cat.subCategories.length > 0
      ? cat.subCategories.map((s) => s.id)
      : [cat.id];
  }, []);

  /** 切换大类下所有子分类的 CheckboxGroup onChange */
  const handleSubCategoryChange = useCallback(
    (sid: string, category: JobCategory, newSelected: string[]) => {
      setDraft((prev) => {
        const current = prev[sid] || [];
        const subIds = new Set(getSelectableIds(category));
        const withoutThisCategory = current.filter((id) => !subIds.has(id));
        const next = [...withoutThisCategory, ...newSelected];
        return { ...prev, [sid]: next };
      });
    },
    [getSelectableIds]
  );

  /** 切换大类（全选/全不选该大类下的所有子分类，或切换无子分类的大类本身） */
  const toggleCategory = useCallback(
    (sid: string, category: JobCategory, isSelected: boolean) => {
      setDraft((prev) => {
        const current = prev[sid] || [];
        const ids = getSelectableIds(category);
        let next: string[];
        if (isSelected) {
          const currentSet = new Set(current);
          for (const id of ids) {
            currentSet.add(id);
          }
          next = Array.from(currentSet);
        } else {
          const idsSet = new Set(ids);
          next = current.filter((id) => !idsSet.has(id));
        }
        return { ...prev, [sid]: next };
      });
    },
    [getSelectableIds]
  );

  /** 全选某个数据源的所有可选 ID */
  const selectAllSource = useCallback((sid: string) => {
    const categories = SOURCE_CATEGORIES[sid] || [];
    const allIds = categories.flatMap((c) => getSelectableIds(c));
    setDraft((prev) => ({ ...prev, [sid]: allIds }));
  }, [getSelectableIds]);

  /** 清空某个数据源的所有选择 */
  const clearAllSource = useCallback((sid: string) => {
    setDraft((prev) => ({ ...prev, [sid]: [] }));
  }, []);

  /** 获取大类下选中的可选 ID 列表 */
  const getSelectedSubIds = (sid: string, category: JobCategory): string[] => {
    const selected = new Set(draft[sid] || []);
    return getSelectableIds(category).filter((id) => selected.has(id));
  };

  // 当前数据源的分类数据
  const categories = sourceId ? SOURCE_CATEGORIES[sourceId] || [] : [];
  const selected = sourceId ? draft[sourceId] || [] : [];
  const allSelectableIds = categories.flatMap((c) => getSelectableIds(c));
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selected.includes(id));

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
                ? `${getSourceName(sourceId)} · 岗位配置`
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
                    已选 {selected.length} 个分类
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

                {/* 支持关键词搜索的数据源 */}
                {sourceId && KEYWORD_SOURCES.has(sourceId) && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        搜索关键词
                      </Label>
                      <Input
                        aria-label="搜索关键词"
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
                    const selectableIds = getSelectableIds(cat);
                    const selectedSubIds = getSelectedSubIds(sourceId, cat);
                    const allSubSelected =
                      selectableIds.length > 0 &&
                      selectedSubIds.length === selectableIds.length;
                    const someSubSelected =
                      selectedSubIds.length > 0 && !allSubSelected;

                    // 无子分类的大类：直接作为叶子节点，不展开折叠
                    if (!hasSubCategories) {
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center gap-2 py-2 rounded-lg"
                        >
                          <Checkbox
                            isSelected={allSubSelected}
                            onChange={(isSelected: boolean) =>
                              toggleCategory(sourceId, cat, isSelected)
                            }
                          >
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <Checkbox.Content>
                              <Label className="text-xs font-medium cursor-pointer text-primary">
                                {cat.name}
                              </Label>
                            </Checkbox.Content>
                          </Checkbox>
                        </div>
                      );
                    }

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
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({selectedSubIds.length}/
                                  {cat.subCategories.length})
                                </span>
                              </span>
                              <Disclosure.Indicator className="transition-transform duration-200" />
                            </Disclosure.Trigger>
                          </Disclosure.Heading>
                        </div>

                        {/* 子分类列表 - 展开内容 */}
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
              onPress={onClose}
              className="cursor-pointer flex-1"
            >
              取消
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
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
