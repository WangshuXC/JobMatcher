/**
 * 数据源元信息（名称、颜色）
 *
 * 纯数据文件，不依赖任何爬虫类或 playwright，
 * 可安全在客户端组件（"use client"）中 import。
 *
 * 新增数据源时，在此文件中同步添加名称和颜色即可。
 */

/** 数据源 ID → 中文名称 */
const SOURCE_NAMES: Record<string, string> = {
  bytedance: "字节跳动",
  tencent: "腾讯",
  alibaba: "阿里巴巴",
  antgroup: "蚂蚁集团",
  meituan: "美团",
  jd: "京东",
};

/** 数据源 ID → Badge 颜色（Tailwind class） */
const SOURCE_COLORS: Record<string, string> = {
  bytedance: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  tencent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  alibaba: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  antgroup: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  meituan: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  jd: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

/** 获取数据源的中文名称 */
export function getSourceName(sourceId: string): string {
  return SOURCE_NAMES[sourceId] || sourceId;
}

/** 获取数据源的 Badge 颜色 class */
export function getSourceColor(sourceId: string): string {
  return SOURCE_COLORS[sourceId] || "";
}
