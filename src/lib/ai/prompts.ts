/**
 * LLM 精排 Prompt 模板
 *
 * 结构化 prompt 让 LLM 对候选职位进行精排并输出 JSON
 */

/**
 * 构建精排 prompt
 * @param resumeText 简历原文
 * @param candidateJobs 召回的候选职位列表（精简信息）
 */
export function buildRerankPrompt(
  resumeText: string,
  candidateJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    requirements: string;
    category?: string;
  }>
): string {
  const jobsText = candidateJobs
    .map(
      (job, i) =>
        `[职位${i + 1}] ID: ${job.id}
标题: ${job.title}
公司: ${job.company}
地点: ${job.location}
类别: ${job.category || "未分类"}
描述: ${(job.description || "").slice(0, 200)}
要求: ${(job.requirements || "").slice(0, 200)}`
    )
    .join("\n\n");

  return `你是一位专业的招聘匹配顾问。请根据以下简历内容，对候选职位列表进行匹配度评估。

## 简历内容

${resumeText.slice(0, 2000)}

## 候选职位列表

${jobsText}

## 任务要求

请从候选职位中评估每个职位与简历的匹配度，并按匹配度从高到低排序。

对每个职位输出以下 JSON 格式：
- jobId: 职位 ID（必须与输入一致）
- score: 匹配度评分 0-100
- reason: 一句话匹配理由（30字以内）
- highlights: 亮点列表（简历与职位匹配的优势，1-3条，每条15字以内）
- risks: 风险/不足列表（可能不匹配的地方，0-2条，每条15字以内）

只输出 JSON 数组，不要输出其它内容。按 score 从高到低排序。

示例输出格式：
[
  {
    "jobId": "xxx",
    "score": 85,
    "reason": "技术栈高度匹配，经验丰富",
    "highlights": ["React/TS技术栈完全匹配", "5年经验超出要求"],
    "risks": ["地点不在期望范围"]
  }
]`;
}
