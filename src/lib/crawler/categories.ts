/**
 * 各数据源的岗位大类 + 子分类定义
 *
 * 供前端 UI 展示两级分类选择器、后端爬虫根据用户选择构建请求参数。
 * 每个大类包含若干子分类（id + name），用户可以精确到子分类粒度选择。
 */
import { JobCategory } from "@/types";

// ==================== 字节跳动 ====================

export const BYTEDANCE_CATEGORIES: JobCategory[] = [
  {
    id: "6704215862603155720",
    name: "研发",
    subCategories: [
      { id: "6704215862557018372", name: "后端" },
      { id: "6704215886108035339", name: "前端" },
      { id: "6704215888985327886", name: "大数据" },
      { id: "6704215897130666254", name: "测试" },
      { id: "6704215956018694411", name: "算法" },
      { id: "6704215957146962184", name: "客户端" },
      { id: "6704215958816295181", name: "基础架构" },
      { id: "6704216109274368264", name: "安全" },
      { id: "6704216635923761412", name: "数据挖掘" },
      { id: "6704217321877014787", name: "运维" },
      { id: "6704219534724696331", name: "机器学习" },
      { id: "6938376045242353957", name: "硬件" },
    ],
  },
  {
    id: "6704215864629004552",
    name: "产品",
    subCategories: [
      { id: "6704215864591255820", name: "产品经理" },
      { id: "6704215924712409352", name: "商业产品（广告）" },
      { id: "6704216224387041544", name: "数据分析" },
    ],
  },
  {
    id: "6704215882479962371",
    name: "运营",
    subCategories: [
      { id: "6704215882438019342", name: "商业运营" },
      { id: "6704215955154667787", name: "用户运营" },
      { id: "6704216057269192973", name: "产品运营" },
      { id: "6709824273306880267", name: "客服" },
      { id: "6863074795655792910", name: "项目管理" },
    ],
  },
  {
    id: "6704215901438216462",
    name: "市场",
    subCategories: [
      { id: "6704215901392079117", name: "广告投放" },
      { id: "6704216021651163395", name: "营销策划" },
      { id: "6704216430973290760", name: "品牌" },
      { id: "6704216870330829070", name: "政府关系" },
      { id: "6704216950135851275", name: "商务拓展BD" },
      { id: "6704217388763580683", name: "媒介公关" },
    ],
  },
  {
    id: "6704215913488451847",
    name: "职能支持",
    subCategories: [
      { id: "6704215913454897421", name: "法务" },
      { id: "6704216232129726734", name: "战略" },
      { id: "6704216386916321540", name: "人力" },
      { id: "6704216480889702664", name: "财务" },
      { id: "6704217005358057732", name: "IT支持" },
      { id: "6704219468463081735", name: "采购" },
      { id: "6850051245856524558", name: "内审" },
    ],
  },
  {
    id: "6709824272505768200",
    name: "销售",
    subCategories: [
      { id: "6704215938645887239", name: "销售" },
      { id: "6704215966085024003", name: "销售支持" },
      { id: "6709824272459630861", name: "销售专员" },
      { id: "6709824273038444807", name: "销售管理" },
    ],
  },
  {
    id: "6709824272514156812",
    name: "设计",
    subCategories: [
      { id: "6704216194292910348", name: "UI" },
      { id: "6704216925762750724", name: "交互设计" },
      { id: "6709824272627403020", name: "视觉设计" },
      { id: "6709824272996501772", name: "用户研究" },
      { id: "6709824273332046088", name: "多媒体设计" },
      { id: "6850051246036879630", name: "游戏美术" },
    ],
  },
];

// ==================== 腾讯 ====================

export const TENCENT_CATEGORIES: JobCategory[] = [
  {
    id: "40001",
    name: "技术",
    subCategories: [
      { id: "40001001", name: "技术研发" },
      { id: "40001002", name: "质量管理" },
      { id: "40001003", name: "技术运营" },
      { id: "40001004", name: "安全技术" },
      { id: "40001005", name: "AI·算法与大数据" },
      { id: "40001006", name: "企管" },
    ],
  },
  {
    id: "40002",
    name: "设计",
    subCategories: [
      { id: "40002001", name: "设计" },
      { id: "40002002", name: "游戏美术" },
    ],
  },
  {
    id: "40003",
    name: "产品",
    subCategories: [
      { id: "40003001", name: "产品" },
    ],
  },
  {
    id: "40004",
    name: "营销与公关",
    subCategories: [],
  },
  {
    id: "40005",
    name: "销售服务与支持",
    subCategories: [],
  },
  {
    id: "40006",
    name: "内容",
    subCategories: [],
  },
  {
    id: "40007",
    name: "财务",
    subCategories: [],
  },
  {
    id: "40008",
    name: "人力资源",
    subCategories: [],
  },
  {
    id: "40009",
    name: "法律与公共策略",
    subCategories: [],
  },
  {
    id: "40010",
    name: "行政支持",
    subCategories: [],
  },
  {
    id: "40011",
    name: "战略与投资",
    subCategories: [],
  },
];

// ==================== 阿里巴巴 ====================

export const ALIBABA_CATEGORIES: JobCategory[] = [
  {
    id: "130",
    name: "技术",
    subCategories: [
      { id: "133", name: "前端开发" },
      { id: "135", name: "运维" },
      { id: "136", name: "后端开发" },
      { id: "137", name: "质量保证" },
      { id: "407", name: "安全" },
      { id: "408", name: "数据" },
      { id: "409", name: "算法" },
      { id: "410", name: "客户端开发" },
      { id: "411", name: "解决方案" },
      { id: "511", name: "测试开发" },
      { id: "702", name: "硬件工程" },
      { id: "703", name: "嵌入式开发" },
      { id: "704", name: "系统架构" },
      { id: "747", name: "数据库" },
      { id: "764", name: "中间件" },
      { id: "769", name: "云计算" },
      { id: "798", name: "技术管理" },
      { id: "811", name: "大模型" },
    ],
  },
  {
    id: "97",
    name: "产品",
    subCategories: [
      { id: "403", name: "产品经理" },
      { id: "404", name: "产品设计" },
      { id: "405", name: "商业分析" },
      { id: "406", name: "数据分析" },
    ],
  },
  {
    id: "103",
    name: "运营",
    subCategories: [
      { id: "108", name: "业务运营" },
      { id: "474", name: "内容运营" },
      { id: "475", name: "活动策划" },
      { id: "476", name: "社群运营" },
      { id: "477", name: "渠道运营" },
      { id: "478", name: "品牌运营" },
      { id: "479", name: "用户运营" },
      { id: "480", name: "数据运营" },
      { id: "481", name: "直播运营" },
      { id: "482", name: "电商运营" },
      { id: "483", name: "项目管理" },
      { id: "484", name: "策略运营" },
      { id: "529", name: "商家运营" },
      { id: "757", name: "安全运营" },
      { id: "758", name: "合规运营" },
      { id: "759", name: "流量运营" },
      { id: "763", name: "供应链运营" },
      { id: "834", name: "跨境电商运营" },
      { id: "846", name: "出海运营" },
      { id: "847", name: "国际化运营" },
    ],
  },
  {
    id: "112",
    name: "设计",
    subCategories: [
      { id: "113", name: "UX设计" },
      { id: "114", name: "视觉设计" },
      { id: "115", name: "交互设计" },
      { id: "444", name: "品牌设计" },
      { id: "802", name: "创意设计" },
    ],
  },
  {
    id: "143",
    name: "数据",
    subCategories: [
      { id: "446", name: "数据分析" },
      { id: "447", name: "数据开发" },
      { id: "448", name: "数据挖掘" },
    ],
  },
  {
    id: "124",
    name: "市场拓展",
    subCategories: [
      { id: "126", name: "市场营销" },
      { id: "445", name: "公关传播" },
      { id: "716", name: "政府关系" },
      { id: "812", name: "品牌营销" },
      { id: "824", name: "市场分析" },
      { id: "825", name: "商务拓展" },
    ],
  },
  {
    id: "152",
    name: "销售",
    subCategories: [
      { id: "156", name: "销售" },
      { id: "461", name: "解决方案销售" },
      { id: "462", name: "渠道销售" },
      { id: "463", name: "大客户销售" },
      { id: "464", name: "商务合作" },
      { id: "465", name: "销售管理" },
      { id: "466", name: "售前顾问" },
      { id: "467", name: "商业拓展" },
      { id: "468", name: "行业销售" },
      { id: "469", name: "国际销售" },
      { id: "470", name: "直销" },
      { id: "471", name: "电话销售" },
      { id: "472", name: "销售运营" },
      { id: "473", name: "销售支持" },
      { id: "512", name: "技术销售" },
      { id: "513", name: "广告销售" },
    ],
  },
  {
    id: "157",
    name: "综合",
    subCategories: [
      { id: "159", name: "人力资源" },
      { id: "162", name: "法务" },
      { id: "163", name: "财务" },
      { id: "165", name: "行政" },
      { id: "168", name: "战略发展" },
      { id: "180", name: "采购" },
      { id: "485", name: "客服" },
      { id: "486", name: "风控" },
      { id: "487", name: "合规" },
      { id: "488", name: "审计" },
      { id: "489", name: "培训" },
      { id: "490", name: "物流" },
    ],
  },
  {
    id: "117",
    name: "客服",
    subCategories: [
      { id: "427", name: "在线客服" },
      { id: "428", name: "电话客服" },
      { id: "429", name: "客服主管" },
      { id: "430", name: "客服培训" },
      { id: "431", name: "质检" },
      { id: "432", name: "投诉处理" },
      { id: "433", name: "客户关系" },
      { id: "434", name: "售后服务" },
      { id: "435", name: "技术支持" },
      { id: "436", name: "商家支持" },
      { id: "437", name: "数据分析" },
      { id: "438", name: "知识库" },
      { id: "439", name: "服务运营" },
      { id: "440", name: "外包管理" },
      { id: "441", name: "服务策略" },
      { id: "442", name: "体验优化" },
      { id: "443", name: "智能客服" },
    ],
  },
];

// ==================== 汇总导出 ====================

/** 各数据源分类映射：sourceId → categories */
export const SOURCE_CATEGORIES: Record<string, JobCategory[]> = {
  bytedance: BYTEDANCE_CATEGORIES,
  tencent: TENCENT_CATEGORIES,
  alibaba: ALIBABA_CATEGORIES,
};

/**
 * 获取各数据源的默认选中子分类 ID
 * 默认选中研发/技术大类下的所有子分类
 */
export function getDefaultCategoryConfig(): Record<string, string[]> {
  return {
    bytedance: BYTEDANCE_CATEGORIES[0].subCategories.map((s) => s.id), // 研发 → 全部子分类
    tencent: TENCENT_CATEGORIES[0].subCategories.map((s) => s.id),     // 技术 → 全部子分类
    alibaba: ALIBABA_CATEGORIES[0].subCategories.map((s) => s.id),     // 技术 → 全部子分类
  };
}

/**
 * 根据选中的子分类 ID 列表，找出它们所属的大类 ID
 * 用于爬虫根据子分类 ID 反推需要查询哪些大类
 */
export function getParentCategoryIds(
  categories: JobCategory[],
  subCategoryIds: string[]
): string[] {
  const parentIds = new Set<string>();
  const subIdSet = new Set(subCategoryIds);
  for (const cat of categories) {
    if (cat.subCategories.some((s) => subIdSet.has(s.id))) {
      parentIds.add(cat.id);
    }
  }
  return Array.from(parentIds);
}
