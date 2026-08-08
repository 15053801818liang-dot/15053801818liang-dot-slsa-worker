# 安全策略与 SLSA Level 3 合规说明

本项目按 [SLSA v1.0](https://slsa.dev/spec/v1.0/) Level 3 要求构建。以下逐条映射控制措施，并如实标注**尚未覆盖项**与**需在仓库层面手动配置项**。

---

## 1. 构建环境硬化与隔离（Build Isolation）

| SLSA L3 要求 | 本项目控制措施 | 状态 |
|---|---|---|
| 构建运行在临时、用完即毁环境 | 所有 job `runs-on: ubuntu-latest`（GitHub 托管 runner，每次构建分配全新 VM，结束后销毁） | ✅ 已落地 |
| 跨构建隔离，无状态残留 | `concurrency` 串行化同 ref 构建；GitHub 托管 runner 天然隔离，无共享 FS | ✅ 已落地 |
| 构建不可访问外部主机状态 | `actions/checkout` 设 `persist-credentials: false`，不残留 token | ✅ 已落地 |

**残留风险**：GitHub 托管 runner 由平台托管，我们无法审计其底层镜像。这是采用托管平台的固有信任假设——SLSA L3 接受"信任构建平台"作为前提。

---

## 2. 凭据与私钥安全隔离（Secret Isolation）

| SLSA L3 要求 | 本项目控制措施 | 状态 |
|---|---|---|
| 签名私钥不暴露给构建脚本 | **无持久私钥**。使用 Sigstore keyless：`id-token: write` 触发 OIDC 短期证书，证书由 Sigstore CA 签发，构建步骤无法导出私钥 | ✅ 已落地 |
| 签名权限与构建步骤分离 | `provenance` job 独立持有 `id-token: write` + `attestations: write`；`build` job **仅 `contents: read`**，无 OIDC/attest 权限，**无法伪造溯源** | ✅ 已落地 |
| 部署密钥隔离 | `CLOUDFLARE_API_TOKEN` 仅注入 `deploy` job；`build`/`provenance` job 无法访问 | ✅ 已落地 |
| 全局最小权限 | 顶层 `permissions: contents: read`，各 job 显式声明所需权限 | ✅ 已落地 |

**关键设计**：build 步骤若被恶意代码污染，由于缺少 `id-token` 权限，**也无法生成伪造的溯源**——这正是 SLSA L3 "non-falsifiable provenance" 的核心。

---

## 3. 自动化与不可伪造溯源（Verifiable Provenance）

| SLSA L3 要求 | 本项目控制措施 | 状态 |
|---|---|---|
| 编译产出后自动生成 SLSA Provenance | `actions/attest-build-provenance@v4.2.2` 生成 in-toto SLSA provenance predicate | ✅ 已落地 |
| 签名由平台全权托管 | Sigstore keyless（OIDC），签名过程在 GitHub 受信环境内完成，构建脚本不参与签名 | ✅ 已落地 |
| 溯源不可篡改、可验证 | 溯源上传至 GitHub Attestations API；可用 `gh attestation verify` 验证 | ✅ 已落地 |
| 溯源绑定具体产物摘要 | `subject-path: dist/*`，自动计算 sha256 并绑定 | ✅ 已落地 |

**备选方案**：项目内注释保留了 `slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.1.0`（SLSA 参考实现，构建在受信任 reusable workflow 内执行，不可伪造性更强）。该项目已进入维护模式，故主路径采用 GitHub Attestations。

**验证命令**：
```bash
gh attestation verify dist/index.js --repo <org>/<repo>
```

**残留风险**：Workers 部署由 `wrangler deploy` 重新打包，部署字节与溯源产物在非可复现构建下可能不一致。完整产物-部署一致性需 `wrangler deploy --no-bundle` 部署预构建 bundle（见下文"待加固"）。

---

## 4. 版本控制与审计留痕（Source Verification）

| SLSA L3 要求 | 本项目控制措施 | 状态 |
|---|---|---|
| 构建由 VCS 可信提交触发 | 仅 `push`（main/tag）/ `workflow_dispatch` 触发；`pull_request` 不在受信发布路径 | ✅ 已落地 |
| 双方审查（Two-party review） | `.github/CODEOWNERS` 定义关键路径所有者 | ⚠️ 需配置分支保护生效 |
| 提交身份可验证 | — | ⚠️ 需在仓库层面启用提交签名要求 |
| 源码与日志长期保留 | 构建产物 `retention-days: 90`；GitHub Actions 日志默认保留 | ✅ 已落地 |

---

## 5. 需在 GitHub 仓库层面手动配置（无法通过文件实现）

以下控制项无法仅靠仓库内文件完成，需在 GitHub 仓库 Settings 中配置：

1. **分支保护（Branch Protection）** — main 分支：
   - 要求 PR 审查（至少 1 人，建议 2 人）
   - 要求 CODEOWNERS 审查
   - 要求状态检查通过后再合并
   - 禁止强制推送（force push）
   - 禁止删除受保护分支

   ```bash
   gh api repos/<org>/<repo>/branches/main/protection -X PUT \
     -f required_pull_request_reviews.required_approving_review_count=2 \
     -f required_pull_request_reviews.dismiss_stale_reviews=true \
     -f required_status_checks.strict=true \
     -F enforce_admins=true \
     -F restrictions=null
   ```

2. **提交签名要求** — 启用 "Require signed commits"。

3. **Actions 通用设置（Workflow permissions）**：
   - 禁用 `pull_request_target` 触发器（防止密钥泄露）
   - **将 Workflow permissions 保持/收紧为只读**。个人账号新建仓库默认即为 `contents`/`packages` 只读；
     组织内仓库继承组织配置，若组织默认为 "Read and write"，应主动收紧。
   - **不要**勾选 "Allow GitHub Actions to create and approve pull requests"
     （该开关允许 Actions 自动批准 PR，会绕过 CODEOWNERS 双人审查）。

   > ⛔ **反模式**：为"让 OIDC / Attestations 生效"而把全局权限改为 "Read and write" 是**错误且有害**的。
   > `GITHUB_TOKEN` 权限按「仓库默认 → workflow 顶层 → job 级」顺序计算，本流水线已在 `provenance` job
   > 显式声明 `id-token: write` + `attestations: write`，**无需放宽全局设置**。
   > 且 `id-token` 从不由该读写开关自动授予——使用 `permissions` 键后，
   > 未列出的范围一律为 `none`，只能靠显式声明获得。
   > 详见 `SLSA-L3-Compliance-Report.html` 第 4 节。

4. **GitHub Artifact Attestations**：
   - 公共仓库所有计划可用
   - 私有/内部仓库需 GitHub Enterprise Cloud

5. **密钥管理**：
   - `CLOUDFLARE_API_TOKEN` 存为 GitHub Secret（非变量）
   - 配置 `production` Environment 并启用 required reviewers / 部署分支限制

---

## 6. 待加固项（如实标注，未声称已修复）

| 项 | 说明 | 优先级 |
|---|---|---|
| 产物-部署一致性 | 当前 `wrangler deploy` 重新打包；需改 `--no-bundle` 部署预构建 attested bundle | 高 |
| Action SHA 锁定 | 当前使用版本标签（`@v4`）；SLSA 建议锁定到 commit SHA 防供应链劫持 | 高 |
| 依赖锁文件 | 已生成 `package-lock.json`；建议启用 Dependabot/Renovate + 自动 PR 审查 | 中 |
| 可复现构建 | Workers bundle 含时间戳等非确定性因素；需 wrangler reproducible 模式 | 中 |
