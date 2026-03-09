---
description: Periodic code health check — debug TypeScript errors, find dead code, check dependencies, optimize bundles, audit Supabase
---

# Code Health Check

定期运行的代码健康检查，用于发现隐藏问题、优化性能、保持代码质量。

建议频率：**每周一次**，或每完成一个大功能后运行。

## Steps

### 1. TypeScript 错误扫描

逐 app 检查 TypeScript 错误，跳过构建直接类型检查（更快、更省内存）：

```bash
# 逐个检查，记录每个 app 的错误数
npx tsc --noEmit -p apps/esl-planner/tsconfig.json 2>&1
npx tsc --noEmit -p apps/essay-lab/tsconfig.json 2>&1
npx tsc --noEmit -p apps/nature-compass/tsconfig.json 2>&1
npx tsc --noEmit -p apps/rednote-ops/tsconfig.json 2>&1
npx tsc --noEmit -p apps/edu-hub/tsconfig.json 2>&1
npx tsc --noEmit -p apps/student-portal/tsconfig.json 2>&1
```

汇总每个 app 的错误数量。对于频繁出现的错误类型（如 missing imports），批量修复。

**不要一次修全部**——只修最严重的 5-10 个，其余记录到报告里。

### 2. 死代码检测

找出未使用的导出和组件：

```bash
# 搜索只 export 但从未 import 的函数/组件
# 在每个 app 中搜索 export 的函数名，检查是否有其他文件 import 了它
```

重点检查：

- `packages/shared/` 中导出但没有 app 使用的模块
- 各 app 中定义了但未渲染的组件
- 未使用的 hook、util 函数、type 定义

### 3. 依赖健康检查

```bash
# 检查过时的包
npm outdated --depth=0

# 安全漏洞扫描
npm audit
```

分类报告：

- 🔴 **安全漏洞** → 立即升级
- 🟡 **主版本更新**（如 vite 6→7）→ 记录但不自动升级，需要用户确认
- 🟢 **补丁/小版本更新** → 可以安全升级

**自动修复**（仅补丁版本）：

```bash
npm update --save
```

### 4. 大文件和大组件检测

```bash
# 找出超过 300 行的组件文件
find apps/ -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 找出超过 200 行的 service/hook 文件
find apps/ packages/ -name "*.ts" | xargs wc -l | sort -rn | head -20
```

大文件 = 潜在的拆分需求。报告中建议哪些组件可以拆分。

### 5. 重复代码检测

跨 app 搜索相似的模式：

```bash
# 检查各 app 间是否有重复的 service 代码
# 检查各 app 的 i18n/translations.ts 是否有重复的 key
# 检查各 app 中是否有类似的组件可以提取到 shared
```

重点关注：

- 多个 app 中相似的 API 调用封装 → 应提取到 `packages/shared/services/`
- 多个 app 中重复的 UI 组件 → 应提取到 `packages/shared/components/`
- 重复的 type 定义 → 应提取到 `packages/shared/types/`

### 6. Supabase 数据库优化

```
mcp_supabase-mcp-server_get_advisors (project_id: mjvxaicypucfrrvollwm, type: "performance")
mcp_supabase-mcp-server_get_advisors (project_id: mjvxaicypucfrrvollwm, type: "security")
```

检查：

- 缺少的索引
- 未启用 RLS 的表
- 慢查询

### 7. 构建产物分析

对每个 app 执行一次构建，记录产物大小：

```bash
# 构建并检查 dist 大小
npm run build:planner && du -sh apps/esl-planner/dist/
npm run build:essay && du -sh apps/essay-lab/dist/
# ... 其他 app
```

如果某个 app 的 dist 明显增大，分析原因（新依赖、未做 tree-shaking 等）。

### 8. 生成健康报告

汇总所有检查结果，生成报告：

```markdown
# 🏥 代码健康报告 — [日期]

## 总结
- TypeScript 错误: X 个（+/- 比上次）
- 安全漏洞: X 个
- 过时依赖: X 个
- 大文件（>300行）: X 个
- 重复代码机会: X 处

## 🔴 需要立即处理
- [列出严重问题]

## 🟡 建议优化
- [列出优化建议]

## 🟢 状态良好
- [列出通过检查的项目]

## 📊 构建产物大小
| App | 当前大小 |
|---|---|
| esl-planner | XX MB |
| essay-lab | XX MB |
| ... | ... |
```

将报告保存到项目根目录的 `docs/health-reports/` 文件夹。

## 自动触发建议

在 `cross-project-check.md` 中添加规则：

- 用户说"检查代码"、"代码质量"、"code review"、"健康检查" → 自动运行此 workflow
- 每完成一个大功能后建议运行
