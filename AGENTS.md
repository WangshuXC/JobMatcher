# AGENTS.md This file provides guidance to CodeBuddy when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint (uses flat config `eslint.config.mjs`) |
| `npx tsc --noEmit` | TypeScript type-check without emitting files |
| `npx playwright install chromium` | Install Chromium browser for crawler (first-time setup only) |

No test framework is configured. No environment variables or API keys required.

---

## Architecture Overview

### What This Project Is

JobMatcher is a **full-stack Next.js 16 App Router** application that crawls job postings from major Chinese tech companies (ByteDance, Tencent, Alibaba, Ant Group, Meituan, JD) using **Playwright browser automation**, then provides intelligent resume matching against crawled positions. It runs as a local tool with zero external service dependencies.

### Core Data Flow

Three primary flows exist:

1. **Crawl Flow**: UI → `POST /api/crawl` (SSE stream) → `BaseCrawler` subclass → `jobStore.upsertMany()` → SSE events push progress/data back → frontend `refreshTrigger` counter increments → `useJobs` hook re-fetches `/api/jobs` to refresh the list.

2. **Job List Flow**: `GET /api/jobs?source=&keyword=&location=&recruitType=` → `JobStore` queries in-memory Map → location parsing/grouping via `china-location.ts` → response includes jobs, countBySource, and locationGroups.

3. **Match Flow**: `POST /api/match` with resume text → `parseResume()` extracts skills/experience/education/locations → `matchJobs()` scores every stored job on 4 weighted dimensions → returns top N results with breakdowns.

### Server-Side Data Storage (`src/lib/store.ts`)

`JobStore` is a **global singleton** using an in-memory `Map` with sync JSON file persistence to `data/jobs.json`. The dedup key is `${recruitType}_${source}_${sourceId}` — a three-part composite ensuring social/campus recruitment for the same position are stored independently. Every mutation (`upsert`, `upsertMany`, `clearSource`, `clearAll`) triggers synchronous `writeFileSync`. This is acceptable for a single-user local tool but would need async I/O for production use.

### Crawler System (`src/lib/crawler/`)

**Pattern: Abstract Base Class + Registry + Template Method**

`BaseCrawler` (`base.ts`) defines the crawl lifecycle:
1. `launchBrowser()` — headless Chromium via Playwright, shared `BrowserContext` for cookie sharing across pages
2. `crawlJobList()` — **abstract**, subclass implements list fetching
3. `crawlDetailsInParallel()` — base class provides 20-concurrency detail fetching, but **all 6 existing crawlers bypass this by returning `[]` from `crawlJobList()`**
4. `closeBrowser()`

**Critical pattern**: All crawlers complete data acquisition within `crawlJobList()` by calling JSON APIs directly (not DOM scraping), use `this.onJobsBatch` callback for incremental data push, and return an empty array to skip the detail phase entirely. If you add a new crawler, follow this same pattern unless the target site has no JSON API.

The **registry** (`registry.ts`) stores crawler instances in a Map, auto-registered at module load. Adding a new crawler requires: create source file → register in `registry.ts` → add categories to `categories.ts`.

**There is a detailed skill/rule for adding new crawler sources** — use the `add-crawler-source` rule for step-by-step guidance including API debugging scripts, CSRF handling, and common pitfalls.

### Four API Call Strategies for Crawlers

Crawlers must choose how to call target APIs based on the site's architecture:
- **Scheme A** (`context.request`): Pure HTTP, no page needed. Best performance. Used by ByteDance.
- **Scheme B** (`page.evaluate + fetch`): When CSRF tokens or same-origin cookies are required. Used by Alibaba, Tencent.
- **Scheme C** (DOM parsing): Last resort for SSR-only pages. No current crawler uses this.
- **Scheme D** (`page.route` interception): When the frontend uses JS-runtime API proxying (not nginx). Used by Ant Group.

### SSE Implementation (`POST /api/crawl`)

Uses a **non-standard SSE approach** because `EventSource` only supports GET. Instead:
- Server: `ReadableStream` with `controller.enqueue()` pushing `event: type\ndata: json\n\n` formatted chunks.
- Client (`useCrawl.ts`): `fetch` + `reader.read()` loop, manual buffer splitting on `\n\n`, regex extraction of event/data fields.

SSE event types: `progress` (crawl progress), `jobs` (incremental batch data), `result` (per-source completion), `done` (all sources complete), `error`.

Sources are crawled **serially** (one at a time), but within each source, list pages and detail APIs are fetched in **parallel** (typically 5-20 concurrency).

### Resume Matching Engine (`src/lib/matcher.ts`)

Pure rule-based, no AI model dependency:
- **Resume parsing**: Substring matching against ~160 skill keywords across 8 categories, regex patterns for experience years, keyword matching for education/role/location.
- **4-dimension weighted scoring**: Skill match (35%), Role relevance (30%), Experience match (20%), Location match (15%). Each dimension scores 0-100, weighted sum yields final score.

### Frontend Architecture

**State Management**: 4 Zustand stores — `appStore` (global recruitType toggle), `crawlerStore` (sources, progress, config), `jobStore` (jobs, filters, refresh trigger), `matchStore` (resume, results).

**Key UI pattern**: `refreshTrigger` is an incrementing counter in `jobStore`. When SSE receives new job data, it calls `triggerRefresh()` which increments the counter. `useJobs` hook watches this value in `useEffect` and re-fetches `/api/jobs`. This avoids directly mutating the full job list from SSE callbacks (since SSE sends incremental data but the list needs server-filtered complete views).

**Component structure**: Each feature tab (CrawlerPanel, JobList, ResumeMatch) has its own directory with an `index.tsx` entry, a `use*.ts` business hook, and specialized child components.

**Virtual scrolling**: `VirtualJobList` uses `@tanstack/react-virtual` with fixed row height 134px, overscan 5.

**UI libraries**: HeroUI (`@heroui/react`) + Tailwind CSS 4 + Motion (Framer Motion). The `Providers` component wraps only `I18nProvider` (locale="zh-CN"). All UI components come from HeroUI — shadcn/ui has been fully removed.

### Social/Campus Recruitment Isolation

`recruitType` (`"social" | "campus"`) is a first-class dimension throughout the stack:
- Store: composite dedup key `${recruitType}_${source}_${sourceId}`
- API: all query endpoints accept `recruitType` filter
- Crawlers: each maps to platform-specific parameters (ByteDance `portal_type`, Tencent `attrId`, Alibaba URL `type` param)
- Frontend: global toggle in `useAppStore`, propagated to all API calls

### Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`). Always use `@/` imports.

### AI 智能匹配模块 (`src/lib/ai/`)

**两阶段架构：Embedding 语义召回 + LLM 精排**

1. **阶段 1 — 本地 Embedding 召回**（零 API Key，始终可用）
   - 使用 `@huggingface/transformers` 加载 `Xenova/bge-small-zh-v1.5` 模型（~100MB ONNX）
   - 职位入库后异步计算 Embedding，持久化到 `data/embeddings.json`
   - 匹配时计算简历 Embedding → 余弦相似度 → Top 50 语义召回
   - 与规则引擎融合评分（Embedding 40% + 规则 60%）

2. **阶段 2 — LLM 精排**（需配置 API Key）
   - 基于 Vercel AI SDK (`ai` + `@ai-sdk/openai`) 统一接口
   - 所有 Provider 走 OpenAI 兼容协议：OpenAI / DeepSeek / 智谱 / 通义千问
   - 将召回 Top 30 候选发给 LLM，输出 JSON 结构化评分 + 匹配理由 + 亮点/风险
   - LLM 不可用时自动降级到 Embedding + 规则引擎

**文件结构：**
```
src/lib/ai/
├── embedding.ts          # Embedding 引擎（HuggingFace Transformers）
├── embedding-store.ts    # 向量存储（内存 + data/embeddings.json）
├── llm.ts                # LLM 客户端（Vercel AI SDK）
├── prompts.ts            # 精排 Prompt 模板
├── settings.ts           # AI 设置管理（data/ai-settings.json）
└── smart-matcher.ts      # 两阶段匹配主逻辑
```

**API 路由：**
- `POST /api/match` — SSE 流式智能匹配（增强版，自动检测 LLM 配置决定精排策略）
- `GET /api/settings` — 读取 AI 设置（API Key 脱敏）
- `POST /api/settings` — 保存 AI 设置

**配置持久化：** `data/ai-settings.json`（在 `/data` 目录下，已被 `.gitignore` 忽略）

### Key Conventions

- Playwright 和 `@huggingface/transformers` 都列在 `serverExternalPackages` 中 — 它们只在服务端运行。
- `maxDuration = 300` is set on the crawl and match API routes for 5-minute timeout.
- All crawler progress messages follow the format: `已抓取 X/Y 个职位`.
- Location strings may contain compound names separated by `、` or `-`; the Jobs API handles splitting and normalization.
