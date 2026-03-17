# ESL 存储对账脚本（旧路径 vs 统一仓储）

## 作用
- 对账 ESL `esl_lessons` / `esl_curricula` 与 `record_index` 一致性。
- 输出关键问题样本：缺索引、标题不一致、关键字段缺失、元数据不一致。
- 作为阶段2切换前的必跑检查。

## 前置条件
- `.env` 或 `.env.local` 已配置：
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 命令
- 全量用户检查：
```powershell
npm run audit:esl-storage
```

- 指定用户检查：
```powershell
npm run audit:esl-storage -- --user-id <USER_UUID>
```

- 指定用户并输出 JSON 报告：
```powershell
npm run audit:esl-storage -- --user-id <USER_UUID> --output docs/reports/esl-storage-audit.json
```

## 输出说明
- `Critical issues`：当前按“缺失索引行”统计，必须优先清零。
- `Lesson sampled issues / Curriculum sampled issues`：样本级问题数量（受 `--sample-limit` 限制）。
- `Overall`：
  - `PASS`：关键问题为 0。
  - `REVIEW_REQUIRED`：仍有关键问题，先修复再推进读路径切换。

## 常见报错
- `Missing environment variables`：
  - 请确认 `VITE_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 已配置。
