---
name: add-campus-recruitment-support
overview: 为 JobMatcher 项目新增"校招/社招"切换功能：添加全局招聘类型状态，在爬虫面板和职位列表面板进行区分展示，在数据存储和查询中添加招聘类型字段，并为所有 6 个数据源（字节跳动、腾讯、阿里巴巴、蚂蚁集团、美团、京东）添加校招爬虫支持。
todos:
  - id: types-and-store
    content: 新增 RecruitType 类型定义、app-store 全局状态，修改 JobPosting/CrawlRequest 接口添加 recruitType 字段
    status: completed
  - id: storage-layer
    content: 修改 JobStore 存储层：key 格式加入 recruitType、查询方法增加 recruitType 过滤、旧数据兼容处理
    status: completed
    dependencies:
      - types-and-store
  - id: crawler-base
    content: 修改 BaseCrawler 基类新增 recruitType 属性，crawl() 和 crawlJobList() 方法签名增加 recruitType 参数传递
    status: completed
    dependencies:
      - types-and-store
  - id: crawler-sources
    content: 使用 [skill:playwright-cli] 确认各网站校招 API 参数，适配全部 6 个爬虫源（bytedance/tencent/alibaba/antgroup/meituan/jd）的校招支持
    status: completed
    dependencies:
      - crawler-base
  - id: api-routes
    content: 修改 /api/crawl 和 /api/jobs 路由，接收并传递 recruitType 参数
    status: completed
    dependencies:
      - storage-layer
      - crawler-base
  - id: frontend-ui
    content: 在 page.tsx 添加社招/校招切换控件，修改 useCrawl 和 useJobs 携带 recruitType 参数，确保切换时自动刷新数据
    status: completed
    dependencies:
      - api-routes
---

## 用户需求

为 JobMatcher 项目新增"校招"支持，实现社招和校招的完整区分能力。

## 产品概述

在现有仅支持社招岗位爬取的基础上，新增校招模式。用户可以在全局切换"社招"或"校招"模式，爬虫系统和职位列表均会根据当前模式展示对应类型的数据。所有 6 个数据源（字节跳动、腾讯、阿里巴巴、蚂蚁集团、美团、京东）都需要支持校招爬取。

## 核心功能

1. **全局招聘类型切换**：在页面顶部或 Tab 区域添加"社招/校招"切换控件，用户可一键切换当前模式，切换后影响爬虫面板和职位列表两个 Tab 的数据
2. **爬虫面板区分**：爬虫 Agent Tab 在发起爬取时将当前招聘类型传递给后端，爬虫根据类型使用对应的 API 参数抓取社招或校招数据
3. **职位存储标识**：每条职位数据（JobPosting）新增 `recruitType` 字段标识社招或校招，存储时携带该标识，查询时可按此字段筛选
4. **职位列表区分**：职位列表 Tab 根据当前全局招聘类型筛选展示对应数据，只展示当前模式下的职位
5. **所有数据源支持校招**：字节跳动、腾讯、阿里巴巴、蚂蚁集团、美团、京东全部 6 个爬虫源新增校招 API 参数适配

## 技术栈

- 前端框架：Next.js 16 + React 19 + TypeScript
- 状态管理：Zustand 5
- UI 组件：HeroUI + shadcn + Tailwind CSS
- 爬虫引擎：Playwright 1.58
- 存储：内存 Map + data/jobs.json 文件持久化

## 实现方案

### 整体策略

引入 `RecruitType` 类型（`"social"` | `"campus"`），作为贯穿前后端的核心维度。通过 Zustand 全局 store 管理当前招聘类型，在爬虫请求、数据存储、API 查询、前端展示的全链路中传递和过滤。

### 关键技术决策

1. **全局状态存放位置**：新建独立的 `app-store.ts` 存放全局应用级状态（`recruitType`），而非放入现有的 `crawler-store` 或 `job-store`，因为它跨越多个功能模块，属于应用级关注点。使用独立 store 符合 Zustand 的最佳实践（细粒度 store），且不影响现有 store 的结构。

2. **数据存储隔离策略**：在 `JobPosting` 接口新增 `recruitType` 字段。`JobStore` 的 key 格式从 `${source}_${sourceId}` 改为 `${recruitType}_${source}_${sourceId}`，确保同一个岗位在社招和校招中不会互相覆盖。查询方法（`getAll`、`getBySource`、`search`、`countBySource`、`getLocations`）全部增加可选的 `recruitType` 参数进行过滤。

3. **爬虫参数传递**：`BaseCrawler.crawl()` 方法新增 `recruitType` 参数，各子类在 `crawlJobList` 中根据该参数切换 API 请求参数。通过 `/api/crawl` 路由的 body 传递 `recruitType`。

4. **各数据源校招 API 适配**：

- **字节跳动**：`portal_type: 1`（校招）vs `portal_type: 2`（社招），URL 路径从 `/experienced/` 改为 `/campus/`
- **阿里巴巴**：`listPath` 中 `type=campus`（校招）vs `type=experienced`（社招），移除 `processPositions` 中对 `categoryType === "freshman"` 的过滤
- **蚂蚁集团**：与阿里类似，`type=campus` vs `type=experienced`，API 路径从 `/api/social/` 改为 `/api/campus/`（需确认）
- **腾讯**：校招 API 域名可能不同（如 `join.qq.com`），或参数中添加 `recruitType` 字段
- **美团**：`jobType` code 从 `"3"`（社招）改为校招对应的 code（如 `"1"` 或 `"2"`）
- **京东**：URL 路径从 `/job_info_list/3` 改为校招对应路径（如 `/job_info_list/1`）

### 性能与兼容性考虑

- 存储 key 变更需要兼容已有数据：首次加载时，对没有 `recruitType` 字段的旧数据默认标记为 `"social"`
- 查询 API 增加 `recruitType` 参数筛选，不影响现有无参数调用（默认返回全部或社招）
- 前端切换招聘类型时自动触发 `triggerRefresh` 重新拉取对应数据

## 实现细节

### 数据旧版兼容

`JobStore.loadFromFile()` 中检测无 `recruitType` 字段的旧数据，自动补充 `recruitType: "social"` 并重新生成 key。避免要求用户手动清除数据。

### 爬虫基类改动最小化

`BaseCrawler` 新增 `recruitType` 属性（默认 `"social"`），在 `crawl()` 方法中设置。子类通过 `this.recruitType` 读取，在构建 API 请求时切换参数。这样改动只在基类增加一个属性 + 各子类的请求参数构建处修改，不影响核心爬取流程。

### 前端切换控件

在 `page.tsx` 的 Header 或 Tab 区域上方添加 `SegmentedControl`（社招/校招），使用 HeroUI 的 `Tabs` 或自定义 Button 组实现。切换时更新 `app-store` 中的 `recruitType`，同时触发 `job-store.triggerRefresh()` 和重置 `crawler-store` 的爬取状态。

## 架构设计

```mermaid
graph TD
    A[用户切换 社招/校招] -->|更新 appStore.recruitType| B[app-store]
    B --> C[CrawlerPanel - 爬虫面板]
    B --> D[JobList - 职位列表]
    
    C -->|POST /api/crawl + recruitType| E[crawl API route]
    E -->|crawler.crawl(..., recruitType)| F[BaseCrawler]
    F -->|根据 recruitType 切换 API 参数| G[各数据源爬虫]
    G -->|job.recruitType = recruitType| H[JobStore 存储]
    
    D -->|GET /api/jobs?recruitType=xxx| I[jobs API route]
    I -->|jobStore.getAll(recruitType)| H
```

## 目录结构

```
src/
├── types/
│   └── index.ts                    # [MODIFY] 新增 RecruitType 类型，JobPosting 增加 recruitType 字段，CrawlRequest 增加 recruitType
├── stores/
│   ├── app-store.ts                # [NEW] 全局应用状态 store，包含 recruitType 及切换方法
│   ├── crawler-store.ts            # [MODIFY] 无需大改，爬取时从 app-store 读取 recruitType
│   └── job-store.ts                # [MODIFY] 无需大改，查询时从 app-store 读取 recruitType
├── lib/
│   ├── store.ts                    # [MODIFY] JobStore 的 key 格式变更、查询方法增加 recruitType 过滤、旧数据兼容
│   └── crawler/
│       ├── base.ts                 # [MODIFY] BaseCrawler 新增 recruitType 属性，crawl() 方法新增参数
│       └── sources/
│           ├── bytedance.ts        # [MODIFY] 根据 recruitType 切换 portal_type 和 URL 路径
│           ├── tencent.ts          # [MODIFY] 根据 recruitType 切换校招 API 参数
│           ├── alibaba.ts          # [MODIFY] 根据 recruitType 切换 listPath type 参数，调整 categoryType 过滤逻辑
│           ├── antgroup.ts         # [MODIFY] 根据 recruitType 切换 API 路径和 type 参数
│           ├── meituan.ts          # [MODIFY] 根据 recruitType 切换 jobType code
│           └── jd.ts               # [MODIFY] 根据 recruitType 切换 URL 路径
├── app/
│   ├── page.tsx                    # [MODIFY] 添加社招/校招切换控件，切换时触发刷新
│   └── api/
│       ├── crawl/route.ts          # [MODIFY] 接收并传递 recruitType 参数给爬虫
│       └── jobs/route.ts           # [MODIFY] 接收 recruitType 查询参数，按类型筛选数据
├── components/
│   ├── CrawlerPanel/
│   │   └── useCrawl.ts            # [MODIFY] 爬取请求中携带当前 recruitType
│   └── JobList/
│       └── useJobs.ts             # [MODIFY] 查询请求中携带当前 recruitType
```

## 关键代码结构

```typescript
/** 招聘类型 */
export type RecruitType = "social" | "campus";

/** 职位信息（新增 recruitType 字段） */
export interface JobPosting {
  // ... 现有字段保持不变
  /** 招聘类型：社招 | 校招 */
  recruitType: RecruitType;
}
```

```typescript
/** 全局应用状态 store */
interface AppState {
  recruitType: RecruitType;
  setRecruitType: (type: RecruitType) => void;
}
```

## Agent Extensions

### SubAgent

- **code-explorer**
- 用途：在实现各爬虫校招支持时，需要深入研究各招聘网站的校招 API 参数（如腾讯校招域名、美团校招 jobType code、京东校招 URL 路径等），通过 code-explorer 搜索爬虫源码中的 API 调用细节和参数格式
- 预期结果：确认每个数据源校招 API 的准确参数，确保爬虫适配正确无误

### Skill

- **playwright-cli**
- 用途：在适配各数据源校招 API 时，可能需要通过浏览器自动化访问各招聘网站的校招页面，抓取网络请求以确认校招 API 的准确端点和参数格式
- 预期结果：获取各招聘网站校招 API 的真实请求参数和响应格式