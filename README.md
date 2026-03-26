# 🎯 JobMatcher

**AI 驱动的招聘信息聚合与智能匹配平台**

基于 Playwright 爬虫 Agent 自动抓取字节跳动、腾讯、阿里巴巴等大厂招聘信息，结合智能简历匹配推荐最适合的岗位。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Playwright](https://img.shields.io/badge/Playwright-1.58-2EAD33?logo=playwright)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)

---

## ✨ 功能特性

### 🕷️ 智能爬虫 Agent

- **多平台支持**：一键抓取字节跳动、腾讯、阿里巴巴三大厂招聘信息
- **分类筛选**：按岗位大类和子分类精确选择目标职位，支持关键词搜索
- **并行抓取**：列表页和详情页均支持高并发并行抓取，大幅提升效率
- **实时进度**：基于 SSE（Server-Sent Events）流式推送抓取进度与数据
- **增量推送**：每批详情抓取完成后立即推送到前端，无需等待全部完成
- **反爬策略**：随机延迟、UA 伪装、分批执行等策略降低被封风险

### 📋 职位列表

- **虚拟滚动**：基于 `@tanstack/react-virtual` 实现大规模数据流畅渲染
- **多维筛选**：支持按数据源、关键词、地点等条件灵活筛选
- **详情查看**：弹窗展示完整职位描述、要求和申请链接
- **数据持久化**：职位数据自动持久化到本地 JSON 文件，重启不丢失

### 🤖 智能简历匹配

- **简历解析**：自动提取简历中的技能、经验年限、学历、期望城市等信息
- **多维评分**：基于 4 个维度加权打分：
  - 🔧 **技能匹配**（35%）：覆盖前端、后端、数据、AI/ML 等 8 大技能类别
  - 📌 **职位相关度**（30%）：职位关键词与技能类别的综合匹配
  - 📅 **经验匹配**（20%）：工作年限与职位要求的契合度
  - 📍 **地点匹配**（15%）：支持 10+ 主要城市及别名映射
- **匹配画像**：可视化展示简历画像和匹配详情

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **框架** | Next.js 16 + React 19 | App Router 全栈架构 |
| **语言** | TypeScript 5 | 严格模式类型安全 |
| **爬虫引擎** | Playwright | Chromium 浏览器自动化 |
| **UI 组件** | shadcn/ui + HeroUI | 现代化 UI 组件系统 |
| **样式** | TailwindCSS 4 | 原子化 CSS |
| **状态管理** | Zustand | 轻量级客户端状态管理 |
| **虚拟列表** | @tanstack/react-virtual | 高性能大列表渲染 |
| **动画** | Motion (Framer Motion) | 流畅交互动画 |
| **数据存储** | 内存 Map + JSON 文件 | 零依赖本地持久化 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9（或 yarn / pnpm）

### 安装与运行

```bash
# 1. 克隆项目
git clone <repository-url>
cd JobMatcher

# 2. 安装依赖
npm install

# 3. 安装 Playwright 浏览器（首次运行需要）
npx playwright install chromium

# 4. 启动开发服务器
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可使用。

### 构建部署

```bash
# 生产构建
npm run build

# 启动生产服务
npm start
```

> **注意**：本项目无需配置任何环境变量或 API 密钥，开箱即用。

---

## 📖 使用指南

### 1. 抓取职位

1. 在 **"爬虫 Agent"** 标签页中勾选要抓取的招聘平台（字节跳动 / 腾讯 / 阿里巴巴）
2. 点击数据源旁的设置图标，选择感兴趣的岗位分类和搜索关键词
3. 调整最大抓取数量
4. 点击 **"开始抓取"**，实时查看抓取进度

### 2. 浏览职位

1. 切换到 **"职位列表"** 标签页
2. 使用搜索栏输入关键词筛选
3. 通过数据源筛选器查看特定平台的职位
4. 点击职位卡片查看详细信息和申请链接

### 3. 简历匹配

1. 切换到 **"智能匹配"** 标签页
2. 粘贴或输入简历内容
3. 系统自动解析简历并与已抓取职位进行多维度匹配
4. 查看匹配分数、画像分析和推荐理由

---

## 🏗️ 项目架构

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── crawl/route.ts        #   POST  - 执行爬虫（SSE 流式返回）
│   │   ├── jobs/route.ts         #   GET   - 查询职位 / DELETE - 清除数据
│   │   ├── match/route.ts        #   POST  - 简历智能匹配
│   │   └── sources/route.ts      #   GET   - 获取数据源列表
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 主页面（三标签页）
│   └── providers.tsx             # 全局 Provider
│
├── components/                   # UI 组件
│   ├── CrawlerPanel/             #   爬虫控制面板
│   ├── JobList/                  #   职位列表（含虚拟滚动）
│   ├── ResumeMatch/              #   简历匹配
│   └── ui/                       #   shadcn/ui 基础组件
│
├── lib/                          # 核心逻辑
│   ├── crawler/
│   │   ├── base.ts               #   爬虫抽象基类（并行抓取、增量推送、容错）
│   │   ├── categories.ts         #   各平台岗位分类定义
│   │   ├── registry.ts           #   爬虫注册表
│   │   └── sources/              #   各平台爬虫实现
│   │       ├── alibaba.ts        #     阿里巴巴（子站并行 + 翻页并行）
│   │       ├── bytedance.ts      #     字节跳动（API 并行分页）
│   │       └── tencent.ts        #     腾讯（API 并行分页 + DOM 详情）
│   ├── matcher.ts                #   简历匹配引擎（4 维度加权评分）
│   ├── store.ts                  #   服务端数据存储（内存 + JSON 持久化）
│   └── utils.ts                  #   工具函数
│
├── stores/                       # 前端状态管理（Zustand）
│   ├── crawler-store.ts          #   爬虫状态
│   ├── job-store.ts              #   职位列表状态
│   └── match-store.ts            #   匹配状态
│
└── types/
    └── index.ts                  # 全局 TypeScript 类型定义
```

---

## 🔌 扩展新的招聘平台

本项目采用 **抽象基类 + 注册表** 模式，添加新平台只需 3 步：

### 1. 创建爬虫文件

在 `src/lib/crawler/sources/` 下新建文件，继承 `BaseCrawler`：

```typescript
import { BaseCrawler } from '../base';
import type { Page } from 'playwright';
import type { JobInfo } from '@/types';

export class NewPlatformCrawler extends BaseCrawler {
  readonly source = 'newplatform';
  readonly label = '新平台';
  readonly baseUrl = 'https://careers.newplatform.com';

  // 实现列表抓取（支持并行分页）
  async crawlJobList(
    maxJobs: number,
    selectedCategoryIds?: string[],
    keyword?: string
  ): Promise<{ jobs: Partial<JobInfo>[]; detailUrls: string[] }> {
    // 你的列表抓取逻辑
  }

  // 实现详情抓取
  async crawlJobDetail(page: Page, partialJob: Partial<JobInfo>): Promise<JobInfo> {
    // 你的详情解析逻辑
  }
}
```

### 2. 注册爬虫

在 `src/lib/crawler/registry.ts` 中注册：

```typescript
import { NewPlatformCrawler } from './sources/newplatform';

registry.register(new NewPlatformCrawler());
```

### 3. 添加分类数据（可选）

在 `src/lib/crawler/categories.ts` 中添加平台的岗位分类定义。

---

## 📡 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/sources` | `GET` | 获取所有已注册数据源及其分类配置 |
| `/api/crawl` | `POST` | 启动爬虫任务，SSE 流式返回进度与数据 |
| `/api/jobs` | `GET` | 查询职位列表，支持 `source`、`keyword`、`location` 参数 |
| `/api/jobs` | `DELETE` | 清除所有已存储的职位数据 |
| `/api/match` | `POST` | 提交简历文本进行智能匹配，返回 Top N 结果 |

---

## 📄 License

MIT
