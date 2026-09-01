# 08 资产分类与入库边界（先分类、后 Git）

## 1. 决策原则
- 先完成资产分类与边界冻结，再进行 Git 初始化。
- `state/`、`validation/` 不允许整目录“一刀切”入库或忽略。
- `.gitignore` 仅用于阻止误入库，不替代资产职责定义。

## 2. 资产分类表

| 路径/模式 | 资产属性 | 分类 | 入库策略 | 说明 |
| --- | --- | --- | --- | --- |
| `state/context.json` | 运行上下文快照 | 可入库 | 纳入版本控制 | 作为可追溯配置与状态描述 |
| `state/README.md` | 目录说明 | 可入库 | 纳入版本控制 | 保留目录语义与维护说明 |
| `state/audit/context/events.ndjson` | 审计事件流水 | 不可入库 | 禁止入库 | 高频、可增长、易污染首次基线 |
| `state/audit/context/archive/*.ndjson` | 审计历史归档 | 只归档不入库 | 首次基线不入库 | 保留用于外部归档与合规留存 |
| `state/audit/context/**/README.md` | 审计目录说明 | 可入库 | 纳入版本控制 | 仅说明性文档，风险低 |
| `validation/**/inputs/*.json` | 验证输入样例 | 可入库 | 纳入版本控制 | 可复现实验/验证条件 |
| `validation/**/logs/*.log` | 验证执行日志 | 不可入库 | 默认不入库 | 作为证据留存，避免噪声进入历史 |

## 3. 固定入库边界

### 3.1 允许入库（白名单）
- `state/context.json`
- `state/**/README.md`
- `validation/**/inputs/*.json`
- 文档资产（如 `docs/system/*.md`）

### 3.2 禁止入库（黑名单）
- `state/audit/context/events.ndjson`
- `validation/**/logs/*.log`
- 其他未分类新增二进制、截图、压缩包（默认不入库，先归档后评审）

### 3.3 只归档不入库
- `state/audit/context/archive/*.ndjson`

## 4. 回滚触发条件矩阵

| 触发场景 | 级别 | 触发条件 | 回滚动作 |
| --- | --- | --- | --- |
| 禁止类资产进入暂存区 | P0 | 检测到黑名单路径被 `add` | 立即回滚该批暂存并重新核对分类 |
| 未分类资产尝试入库 | P0 | 新文件不在白名单且无分类结论 | 终止提交流程，补分类后重试 |
| 只归档资产被纳入首次基线 | P1 | `archive/*.ndjson` 出现在首次提交候选 | 移出提交范围，转外部归档 |
| 文档间结论不一致 | P1 | 方案、分类表、报告的边界定义冲突 | 回滚本次文档改动并统一口径 |

## 5. 与 `.gitignore` 的关系
- `.gitignore` 保持低风险策略：默认屏蔽日志、临时文件和本地环境文件。
- 对 `state/`、`validation/` 的治理以本分类表为准，不以“是否被 ignore”作为唯一判断。

