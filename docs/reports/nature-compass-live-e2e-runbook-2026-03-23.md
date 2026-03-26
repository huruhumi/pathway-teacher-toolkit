# Nature Compass 在线实跑 Runbook（2026-03-23）

## 0) 预备
1. 启动应用并确保可正常生成课程。
2. 清空上次测试残留（可选：新建工作区/新记录）。
3. 打开报告模板：
   - `docs/reports/nature-compass-live-e2e-template-2026-03-23.md`

## 1) 单场景执行顺序（A/B/C 通用）
1. 在课程输入区填入该场景参数并生成。
2. 检查 fact sheet：
   - 是否含 `FRESHNESS AUDIT`
   - 是否含 `target/effective/risk/coverage`
   - 是否含可用 sources（含 publishedAt）
3. 检查 Phase1 roadmap：
   - 每阶段都保留 `backgroundInfo/teachingTips/activityInstructions/steps`
   - 雨天场景必须出现 indoor-safe 执行信息
4. 在 Phase1 后设置分页（逐阶段，不等分）。
5. 点击 Commit 进入 Phase2。
6. 检查 handbook/downstream：
   - 页数严格匹配配置值
   - 学校版：学生任务单风格 + 教师直读稿
   - 亲子版：家长引导稿 + 儿童“故事/事实+任务”
7. 对同一记录做二次重生成（输入 comment）：
   - 结构不变
   - 内容按 comment 调整
   - 页数约束仍然有效

## 2) 批量执行顺序
1. 准备 N 节课（建议 N>=5）并触发批量生成。
2. 检查是否先生成共享 fact sheet，再批内复用。
3. 检查是否没有“近一年来源不足即终止”的硬中断。
4. 检查每课输出是否带 freshness/risk 审计信息。

## 3) 通过标准（建议）
- P0（必须）：
  - 主链路完整
  - 页数强约束有效
  - 雨天约束有效
  - 近一年不足时继续策略有效
- P1（必须）：
  - 视角质量符合场景（学校/亲子）
  - 二次重生成遵循“初次逻辑+comment”
- P2（优化）：
  - 语言更自然、叙事更贴近年龄段
  - 引用密度更高、风险提示更清晰

## 4) 记录建议
- 每个场景至少保存：
  - 输入参数截图
  - fact sheet 审计截图
  - roadmap 关键阶段截图
  - Phase2 页数配置与结果截图
  - 二次重生成前后对照截图
