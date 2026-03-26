# Nature Compass 在线三场景实跑验收模板（2026-03-23）

## 使用说明
- 目的：在联机环境验证“内容质量链路”而不是样式/框架。
- 固定主链路：`Google grounding -> fact sheet -> Phase1 roadmap -> Phase2 handbook/downstream`。
- 每个场景都要记录：
  - `freshnessMeta.targetWindow/effectiveWindow/riskLevel/coverage`
  - roadmap 是否保留 `teachingTips/backgroundInfo/activityInstructions/steps`
  - Phase2 页数是否严格等于配置值
  - 雨天模式是否在 phase 与 handbook 都落地

---

## 场景 A（学校版，雨天）
### 输入参数
- 模式：`school`
- 年龄：`6-8`
- 时长：`180`
- 课时：`4`
- 城市：`武汉`
- 主题：`春季校园植物观察与种子传播`
- 天气：`Rainy`
- 英语：`A1`

### 验收点
- Grounding：
  - `sources[].publishedAt` 有值比例与 `coverage` 一致
  - 近一年不足时自动降级，不中断流程
- Phase1 roadmap：
  - 每阶段有 indoor-safe 执行线
  - `teachingTips/backgroundInfo/activityInstructions/steps` 均存在且非空
- Phase2：
  - 按阶段分页配置后，最终 handbook 页数严格匹配
  - 学生页是任务单风格；teacherContentPrompt 是教师口吻直读稿
- 二次重生成（comment）：
  - 结构不变，只按 comment 调整内容

### 记录
- 运行时间：
- 项目/记录 ID：
- 结果：`PASS / FAIL`
- 问题摘要：

---

## 场景 B（亲子版，英语探索 ON，晴天）
### 输入参数
- 模式：`family`
- `familyEslEnabled=true`
- 年龄：`5-7`
- 时长：`120`
- 课时：`3`
- 城市：`上海`
- 主题：`周末公园昆虫小侦探`
- 天气：`Sunny`

### 验收点
- Grounding：
  - fact sheet 可追溯，含 freshness audit
- Phase1 roadmap：
  - 家长视角可直读执行
  - ESL 为轻量（2-3 词/阶段），不喧宾夺主
- Phase2：
  - 家长内容是陪伴引导脚本
  - 儿童页符合“故事/事实讲解 + 任务”
- 不展示“三视角标签”到前台，仅体现在内容质量上

### 记录
- 运行时间：
- 项目/记录 ID：
- 结果：`PASS / FAIL`
- 问题摘要：

---

## 场景 C（亲子版，纯探索 OFF-ESL，雨天）
### 输入参数
- 模式：`family`
- `familyEslEnabled=false`
- 年龄：`4-6`
- 时长：`90`
- 课时：`2`
- 城市：`成都`
- 主题：`雨天窗边天气观察与水循环小实验`
- 天气：`Rainy`

### 验收点
- Phase1 roadmap：
  - 明确“纯探索”语气，不应强制 ESL 教学动作
  - 雨天执行以室内可操作为主
- Phase2：
  - 家长可读脚本 + 儿童任务链完整
  - 页数严格符合 Phase1 后的配置
- 二次重生成：
  - 按“初次逻辑 + comment”重生，页数约束仍有效

### 记录
- 运行时间：
- 项目/记录 ID：
- 结果：`PASS / FAIL`
- 问题摘要：

---

## 批量场景（配额保护）
### 输入参数
- 任一课程页，`N>=5` 课
- 开启 grounding

### 验收点
- 批内仅 1 份共享 fact sheet（其余课复用）
- 批内无“近一年不足即终止”的硬错误
- 输出中可看到有效窗口与风险级别

### 记录
- 运行时间：
- 课程 ID：
- 结果：`PASS / FAIL`
- 问题摘要：

---

## 统一结论区
- 通过率：
- 阻塞问题（P0/P1）：
- 可优化项（P2/P3）：
- 下轮 prompt 调整建议：
