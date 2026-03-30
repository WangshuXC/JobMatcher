import type { SearchQuery } from "@/types";

/**
 * 解析用户搜索输入为结构化的 SearchQuery
 *
 * 规则：
 * - 空格分隔多关键字，默认 AND 逻辑
 * - 包含 `|` 时切换为 OR 逻辑（`|` 作为分隔符）
 * - `-` 前缀表示排除该关键字（如 `-外包`）
 * - 自动去除空白和重复项
 *
 * 示例：
 *   "前端 React"        → include: ["前端", "React"], operator: "AND"
 *   "前端|后端|全栈"      → include: ["前端", "后端", "全栈"], operator: "OR"
 *   "前端 -外包 -实习"    → include: ["前端"], exclude: ["外包", "实习"], operator: "AND"
 */
export function parseSearchInput(input: string): SearchQuery {
  const rawQuery = input.trim();

  if (!rawQuery) {
    return { include: [], exclude: [], operator: "AND", rawQuery: "" };
  }

  // 检测是否包含 OR 分隔符 `|`
  const isOrMode = rawQuery.includes("|");

  // 按对应分隔符拆分
  const tokens = isOrMode
    ? rawQuery.split("|").map((t) => t.trim())
    : rawQuery.split(/\s+/);

  const include: string[] = [];
  const exclude: string[] = [];

  for (const token of tokens) {
    if (!token) continue;

    if (token.startsWith("-") && token.length > 1) {
      const word = token.slice(1).trim();
      if (word && !exclude.includes(word)) {
        exclude.push(word);
      }
    } else {
      const word = token.trim();
      if (word && !include.includes(word)) {
        include.push(word);
      }
    }
  }

  return {
    include,
    exclude,
    operator: isOrMode ? "OR" : "AND",
    rawQuery,
  };
}

/**
 * 判断 SearchQuery 是否为空（无有效搜索条件）
 */
export function isEmptyQuery(query: SearchQuery): boolean {
  return query.include.length === 0 && query.exclude.length === 0;
}

/**
 * 将 SearchQuery 序列化为 URL 安全的 JSON 字符串
 */
export function serializeSearchQuery(query: SearchQuery): string {
  return JSON.stringify({
    include: query.include,
    exclude: query.exclude,
    operator: query.operator,
  });
}

// ==================== 高亮相关 ====================

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * 将文本按关键字拆分为高亮片段数组
 *
 * @param text - 原始文本
 * @param keywords - 需要高亮的关键字列表
 * @returns 文本片段数组，每段标记是否需要高亮
 */
export function highlightText(
  text: string,
  keywords: string[]
): HighlightSegment[] {
  if (!text || keywords.length === 0) {
    return [{ text, highlighted: false }];
  }

  // 转义正则特殊字符，按长度降序排列（优先匹配长关键字）
  const escaped = keywords
    .filter(Boolean)
    .map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  if (escaped.length === 0) {
    return [{ text, highlighted: false }];
  }

  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    // 添加匹配前的普通文本
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        highlighted: false,
      });
    }
    // 添加匹配的高亮文本
    segments.push({ text: match[0], highlighted: true });
    lastIndex = pattern.lastIndex;
  }

  // 添加最后一段普通文本
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false });
  }

  return segments.length > 0 ? segments : [{ text, highlighted: false }];
}

/**
 * 获取语义相关度标签
 */
export function getSemanticLabel(score: number): {
  label: string;
  color: "success" | "primary" | "warning" | "default";
} {
  if (score >= 0.75) return { label: "高度相关", color: "success" };
  if (score >= 0.55) return { label: "相关", color: "primary" };
  if (score >= 0.4) return { label: "可能相关", color: "warning" };
  return { label: "", color: "default" };
}
