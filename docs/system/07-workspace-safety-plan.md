# 07 工作区安全方案（收口版）

## 1. 目标
将执行顺序固定为“先资产分类、后 Git 初始化”，避免首次基线被运行态与验证证据污染。

## 2. 锁定顺序（强制）
1. 完成资产分类表并评审通过（见 `08-asset-classification-and-boundaries.md`）。
2. 固定 `state/`、`validation/` 入库边界与回滚触发条件。
3. 完成方案文档、分类文档、项目报告三方一致性校验。
4. 仅在以上三步全部通过后，才允许执行 Git 初始化及首次基线提交。

## 3. 当前决策（已锁定）
- `state/context.json`：可入库
- `state/audit/context/events.ndjson`：不入库
- `state/audit/context/archive/*.ndjson`：只归档不入库（首次基线）
- `validation/**/inputs/*.json`：可入库
- `validation/**/logs/*.log`：默认不入库（验证证据）

## 4. 当前禁止动作（未解锁前）
- `git init`
- `git add`
- `git commit`
- `git remote add`
- `git push`

## 5. 一致性要求
- 方案文档、资产分类文档、项目报告必须使用同一边界结论。
- 若出现冲突，以“先分类、后 Git”原则回滚并重整文档口径。

