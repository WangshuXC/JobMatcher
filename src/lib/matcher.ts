/**
 * 简历解析与职位智能匹配引擎
 *
 * 功能：
 * 1. 从简历文本中提取结构化信息（技能、经验、学历等）
 * 2. 对职位进行多维度匹配评分
 * 3. 返回排序后的匹配结果
 */
import { JobPosting, ResumeData, MatchResult, MatchBreakdown } from "@/types";

// ==================== 技能词典 ====================

const SKILL_CATEGORIES: Record<string, string[]> = {
  // 前端
  前端: [
    "javascript", "typescript", "react", "vue", "angular", "next.js", "nextjs", "nuxt",
    "webpack", "vite", "rollup", "html", "css", "sass", "less", "tailwind", "tailwindcss",
    "node.js", "nodejs", "deno", "bun", "jquery", "redux", "mobx", "zustand",
    "graphql", "rest", "restful", "webpack", "babel", "eslint", "storybook",
    "微前端", "小程序", "uniapp", "electron", "react native", "flutter",
    "webgl", "three.js", "canvas", "svg", "d3", "echarts", "antd", "element",
  ],
  // 后端
  后端: [
    "java", "spring", "springboot", "spring boot", "mybatis", "hibernate",
    "python", "django", "flask", "fastapi",
    "go", "golang", "gin", "beego",
    "c++", "c/c++", "rust",
    "php", "laravel",
    "ruby", "rails",
    ".net", "c#",
    "微服务", "grpc", "dubbo", "thrift",
    "tomcat", "nginx", "netty",
  ],
  // 数据相关
  数据: [
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    "kafka", "rabbitmq", "rocketmq",
    "hadoop", "spark", "flink", "hive", "hbase",
    "数据仓库", "etl", "olap", "数据分析", "数据挖掘",
    "sql", "nosql", "数据库",
    "pandas", "numpy", "tableau", "power bi",
  ],
  // AI/ML
  "AI/ML": [
    "机器学习", "深度学习", "自然语言处理", "nlp", "计算机视觉", "cv",
    "tensorflow", "pytorch", "keras", "scikit-learn",
    "transformer", "bert", "gpt", "llm", "大模型", "大语言模型",
    "强化学习", "推荐系统", "算法",
    "opencv", "yolo", "目标检测", "图像识别",
  ],
  // 运维/云
  "DevOps/云": [
    "docker", "kubernetes", "k8s", "jenkins", "ci/cd", "cicd",
    "aws", "阿里云", "腾讯云", "azure", "gcp",
    "linux", "shell", "ansible", "terraform",
    "prometheus", "grafana", "elk", "监控",
    "serverless", "云原生",
  ],
  // 移动端
  移动端: [
    "ios", "swift", "objective-c", "android", "kotlin",
    "react native", "flutter", "dart",
    "小程序", "微信小程序", "支付宝小程序",
  ],
  // 测试
  测试: [
    "自动化测试", "selenium", "playwright", "cypress", "jest",
    "jmeter", "性能测试", "压力测试", "接口测试",
    "单元测试", "集成测试", "测试用例",
  ],
  // 产品/设计
  "产品/设计": [
    "产品经理", "产品设计", "用户研究", "ux", "ui",
    "figma", "sketch", "axure", "原型设计",
    "数据分析", "竞品分析", "需求分析",
  ],
};

// 所有技能关键词扁平化（小写）
const ALL_SKILLS: string[] = Object.values(SKILL_CATEGORIES)
  .flat()
  .map((s) => s.toLowerCase());

// 经验年限正则
const EXPERIENCE_PATTERNS = [
  /(\d+)\s*[-~到至]\s*(\d+)\s*年/,
  /(\d+)\s*年以上/,
  /(\d+)\+?\s*years?/i,
  /(\d+)\s*年.*经验/,
  /经验.*?(\d+)\s*年/,
];

// 学历关键词
const EDUCATION_LEVELS: Record<string, number> = {
  博士: 5,
  硕士: 4,
  研究生: 4,
  本科: 3,
  学士: 3,
  大专: 2,
  专科: 2,
  高中: 1,
};

// 城市别名
const CITY_ALIASES: Record<string, string[]> = {
  北京: ["北京", "beijing"],
  上海: ["上海", "shanghai"],
  深圳: ["深圳", "shenzhen"],
  杭州: ["杭州", "hangzhou"],
  广州: ["广州", "guangzhou"],
  成都: ["成都", "chengdu"],
  武汉: ["武汉", "wuhan"],
  南京: ["南京", "nanjing"],
  西安: ["西安", "xian"],
  厦门: ["厦门", "xiamen"],
};

// ==================== 简历解析 ====================

/**
 * 从简历文本中解析结构化信息
 */
export function parseResume(rawText: string): ResumeData {
  const text = rawText.toLowerCase();

  // 提取技能
  const skills: string[] = [];
  for (const skill of ALL_SKILLS) {
    if (text.includes(skill.toLowerCase())) {
      // 去重
      if (!skills.includes(skill)) {
        skills.push(skill);
      }
    }
  }

  // 提取工作经验年限
  let experienceYears = 0;
  for (const pattern of EXPERIENCE_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      experienceYears = parseInt(match[1], 10);
      break;
    }
  }

  // 如果没匹配到，通过工作经历日期推算
  if (experienceYears === 0) {
    const yearMatches = rawText.match(/20\d{2}/g);
    if (yearMatches && yearMatches.length >= 2) {
      const years = yearMatches.map(Number).sort();
      experienceYears = years[years.length - 1] - years[0];
    }
  }

  // 提取教育背景
  let education = "";
  for (const [level] of Object.entries(EDUCATION_LEVELS).sort(
    (a, b) => b[1] - a[1]
  )) {
    if (rawText.includes(level)) {
      education = level;
      break;
    }
  }

  // 提取期望职位关键词
  const expectedRole: string[] = [];
  const roleKeywords = [
    "前端", "后端", "全栈", "算法", "数据", "产品", "设计", "测试",
    "运维", "架构", "技术经理", "项目经理", "移动端", "iOS", "Android",
    "DevOps", "SRE", "安全", "嵌入式",
  ];
  for (const kw of roleKeywords) {
    if (rawText.includes(kw)) {
      expectedRole.push(kw);
    }
  }

  // 提取期望地点
  const preferredLocations: string[] = [];
  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        if (!preferredLocations.includes(city)) {
          preferredLocations.push(city);
        }
        break;
      }
    }
  }

  return {
    rawText,
    skills,
    experienceYears,
    education,
    expectedRole,
    preferredLocations,
  };
}

// ==================== 匹配算法 ====================

/**
 * 计算技能匹配度
 */
function calcSkillMatch(resume: ResumeData, job: JobPosting): number {
  if (resume.skills.length === 0) return 30; // 无法判断时给基础分

  const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
  let matchCount = 0;

  for (const skill of resume.skills) {
    if (jobText.includes(skill.toLowerCase())) {
      matchCount++;
    }
  }

  // 匹配比例 * 100，最低10分
  const ratio = matchCount / resume.skills.length;
  return Math.max(10, Math.round(ratio * 100));
}

/**
 * 计算地点匹配度
 */
function calcLocationMatch(resume: ResumeData, job: JobPosting): number {
  if (resume.preferredLocations.length === 0) return 60; // 无偏好时给中等分

  const jobLocation = job.location.toLowerCase();
  for (const loc of resume.preferredLocations) {
    const aliases = CITY_ALIASES[loc] || [loc];
    for (const alias of aliases) {
      if (jobLocation.includes(alias.toLowerCase())) {
        return 100;
      }
    }
  }

  return 20; // 地点不匹配
}

/**
 * 计算经验匹配度
 */
function calcExperienceMatch(resume: ResumeData, job: JobPosting): number {
  const jobText = `${job.requirements} ${job.description}`;

  // 从职位要求中提取经验要求
  let requiredExp = 0;
  for (const pattern of EXPERIENCE_PATTERNS) {
    const match = jobText.match(pattern);
    if (match) {
      requiredExp = parseInt(match[1], 10);
      break;
    }
  }

  if (requiredExp === 0) return 70; // 职位无明确要求

  if (resume.experienceYears === 0) return 50; // 简历无法判断

  if (resume.experienceYears >= requiredExp) {
    // 满足或超过要求
    const excess = resume.experienceYears - requiredExp;
    if (excess <= 3) return 100;
    if (excess <= 5) return 85; // 略过高
    return 70; // 过高（可能大材小用）
  } else {
    // 不满足要求
    const gap = requiredExp - resume.experienceYears;
    if (gap <= 1) return 70;
    if (gap <= 2) return 50;
    return 30;
  }
}

/**
 * 计算职位相关度
 */
function calcRoleRelevance(resume: ResumeData, job: JobPosting): number {
  if (resume.expectedRole.length === 0 && resume.skills.length === 0) return 40;

  const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
  let score = 40; // 基础分

  // 职位关键词匹配
  for (const role of resume.expectedRole) {
    if (jobText.includes(role.toLowerCase())) {
      score += 20;
    }
  }

  // 技能类别匹配
  const resumeCategories = new Set<string>();
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    for (const skill of skills) {
      if (resume.skills.includes(skill.toLowerCase())) {
        resumeCategories.add(category);
        break;
      }
    }
  }

  const jobCategories = new Set<string>();
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    for (const skill of skills) {
      if (jobText.includes(skill.toLowerCase())) {
        jobCategories.add(category);
        break;
      }
    }
  }

  // 类别重叠度
  let categoryOverlap = 0;
  for (const cat of resumeCategories) {
    if (jobCategories.has(cat)) categoryOverlap++;
  }

  if (resumeCategories.size > 0) {
    score += Math.round((categoryOverlap / resumeCategories.size) * 40);
  }

  return Math.min(100, score);
}

/**
 * 生成匹配理由
 */
function generateReasons(
  resume: ResumeData,
  job: JobPosting,
  breakdown: MatchBreakdown
): string[] {
  const reasons: string[] = [];
  const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();

  // 技能匹配
  const matchedSkills = resume.skills.filter((s) =>
    jobText.includes(s.toLowerCase())
  );
  if (matchedSkills.length > 0) {
    reasons.push(`技能匹配：${matchedSkills.slice(0, 5).join("、")}`);
  }

  // 地点
  if (breakdown.locationMatch >= 80) {
    reasons.push(`工作地点符合期望（${job.location}）`);
  } else if (breakdown.locationMatch < 40) {
    reasons.push(`工作地点（${job.location}）不在期望范围内`);
  }

  // 经验
  if (breakdown.experienceMatch >= 80) {
    reasons.push("工作经验满足要求");
  } else if (breakdown.experienceMatch < 50) {
    reasons.push("工作经验可能不足");
  }

  // 职位方向
  if (breakdown.roleRelevance >= 70) {
    reasons.push("职位方向与个人背景高度相关");
  }

  return reasons;
}

// ==================== 主匹配函数 ====================

/**
 * 对一组职位进行匹配评分和排序
 */
export function matchJobs(
  resume: ResumeData,
  jobs: JobPosting[],
  topN: number = 20
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const job of jobs) {
    const breakdown: MatchBreakdown = {
      skillMatch: calcSkillMatch(resume, job),
      locationMatch: calcLocationMatch(resume, job),
      experienceMatch: calcExperienceMatch(resume, job),
      roleRelevance: calcRoleRelevance(resume, job),
    };

    // 加权总分
    const score = Math.round(
      breakdown.skillMatch * 0.35 +
        breakdown.locationMatch * 0.15 +
        breakdown.experienceMatch * 0.2 +
        breakdown.roleRelevance * 0.3
    );

    const reasons = generateReasons(resume, job, breakdown);

    results.push({ job, score, breakdown, reasons });
  }

  // 按总分降序排序
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topN);
}
