# Release Guide

## 目标

这个文件用于沉淀 VS Code 插件发布相关的固定流程、已知门槛和排障顺序。

截至 2026-04-03，GitHub Release 自动发布链路已经可用，最新版发布验证基线为 `v0.3.6`。

## 本地发布前检查

优先运行：

```bash
npm run release:check
```

这个命令会顺序执行：

```bash
npm run lint
npm run test:release
npm run package:vsix
```

说明：

- `lint` 当前允许 warning，不允许 error
- `test:release` 只覆盖发布链路强相关测试
- `package:vsix` 会实际构建 `.vsix`，可以提前发现打包问题

## GitHub 自动发布流程

工作流文件：

- `.github/workflows/release.yml`

触发方式：

- 推送 tag，格式为 `v*`

工作流核心步骤：

1. `npm ci`
2. `npm run lint`
3. `npm run test:release`
4. 读取 `package.json.version`
5. 校验 tag 和版本号一致
6. `npm run package:vsix`
7. 上传 GitHub Release 和 `.vsix` 资产

标准发布步骤：

```bash
git add .
git commit -m "release: publish vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 已踩过的门槛

### 1. CI 依赖解析比本地更严格

问题：

- `npm ci` 在 GitHub Actions 失败
- `vitest` 和 `vite` 对 `@types/node` 有最低版本要求

处理：

- 使用 `@types/node@^20.19.37`

落点：

- `package.json`
- `package-lock.json`

### 2. 测试不能写死 Windows 路径格式

问题：

- 本地 Windows 测试通过
- GitHub Linux runner 上路径变成 `/`

处理：

- 测试断言统一先做路径标准化，再比较结果

落点：

- `src/managers/CommandManager.test.ts`

### 3. Workflow 里的 shell 引号很脆弱

问题：

- GitHub Actions 中读取 `package.json.version` 时，错误转义会让 Node 命令直接报错

处理：

- 用最简单、可读性最高的写法读取版本号

当前实现：

```bash
VERSION=$(node -p "require('./package.json').version")
echo "value=$VERSION" >> "$GITHUB_OUTPUT"
```

### 4. 失败 tag 不要复用

建议：

- 如果某个 tag 对应的 workflow 已失败，优先发补丁版本，例如 `0.3.5 -> 0.3.6`
- 不要试图复用已有失败 tag 去覆盖历史结果

## 排障顺序

发布失败时，按这个顺序查：

1. `gh run view <run-id> --log`
2. 看失败发生在 `npm ci`、`lint`、`test:release`、`package:vsix` 还是 `release upload`
3. 先本地复现同一步
4. 修复后发新的补丁版本

## 当前已知风险

### `softprops/action-gh-release@v2` 仍有 Node 20 弃用告警

现状：

- `actions/checkout` 和 `actions/setup-node` 已切到 Node 24 兼容版本
- `softprops/action-gh-release@v2` 目前仍会出现 Node 20 deprecation annotation
- 现在通过 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 可以继续运行

结论：

- 当前不阻塞发布
- 后续应关注该 action 是否提供原生 Node 24 版本，或替换为官方/其他维护中的 release action

## 推荐习惯

1. 发布前先跑 `npm run release:check`
2. 只把发布强相关测试放进 `test:release`
3. 遇到失败先看 Actions 日志，不要靠猜
4. 发布修复统一走补丁版本
