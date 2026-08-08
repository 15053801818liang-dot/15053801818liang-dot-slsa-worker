# slsa-worker

Cloudflare Workers + Durable Objects 模板，按 **SLSA Level 3** 标准加固构建流水线。

## 快速开始

```bash
npm install          # 安装依赖（生成 package-lock.json）
npm run typecheck    # 类型检查
npm run build        # 构建到 dist/（dry-run，不部署）
npm run dev          # 本地开发
npm run deploy       # 部署（需 CLOUDFLARE_API_TOKEN）
```

## 示例

部署后，计数器 DO 提供以下路由：

```bash
curl https://<worker>.workers.dev/increment   # +1
curl https://<worker>.workers.dev/decrement   # -1
curl https://<worker>.workers.dev/            # 读取当前值
curl https://<worker>.workers.dev/reset       # 归零
```

## SLSA Level 3 合规

详见 [SECURITY.md](./SECURITY.md)。核心控制：

- **构建隔离**：GitHub 托管临时 runner，用完即毁
- **密钥隔离**：签名权限与构建步骤分离；部署密钥仅注入 deploy job
- **不可伪造溯源**：`actions/attest-build-provenance` 生成 Sigstore keyless 签名的 SLSA provenance
- **源码审计**：仅由 Git 可信提交触发；CODEOWNERS 强制审查

验证溯源：

```bash
gh attestation verify dist/index.js --repo <org>/<repo>
```

## 目录结构

```
.github/
  CODEOWNERS              # 源码治理：关键路径审查者
  workflows/
    build-release.yml     # SLSA L3 构建与发布流水线
    ci.yml                # PR 持续集成检查
src/
  index.ts                # Worker 入口 + Durable Object
wrangler.jsonc            # Cloudflare Workers 配置
SECURITY.md               # SLSA L3 控制映射与合规说明
```
