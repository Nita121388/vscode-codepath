# 发布检查清单

## ✅ 发布前检查

### 1. 账号准备
- [ ] 已创建 Microsoft 账号
- [ ] 已创建 VS Code Marketplace 发布者账号
- [ ] 已获取 Personal Access Token (PAT)
- [x] 已记录 Publisher ID: `Nita`

### 2. 文件准备
- [x] LICENSE 文件已创建
- [x] package.json 已更新（包含 publisher 等字段）
- [x] README.md 内容完整
- [x] CHANGELOG.md 已更新
- [ ] 图标文件（可选）：`images/icon.png` (128x128 PNG)

### 3. 代码质量
- [ ] 代码编译成功：`npm run compile`
- [ ] 测试通过：`npm run test:unit`
- [ ] 没有 TypeScript 错误
- [ ] 没有 ESLint 错误

### 4. 版本信息
- [x] 版本号已更新为 0.1.0
- [x] CHANGELOG.md 包含 v0.1.0 的更新内容

---

## 🚀 发布步骤

### 步骤 1: 安装 vsce 工具

```bash
npm install -g @vscode/vsce
```

### 步骤 2: 编译项目

```bash
npm run compile
```

### 步骤 3: 打包测试（可选）

```bash
vsce package
```

这会生成 `codepath-extension-0.1.0.vsix` 文件，你可以：
- 本地安装测试：在 VS Code 中，Extensions → ... → Install from VSIX
- 分享给其他人测试

### 步骤 4: 登录发布者账号

```bash
vsce login Nita
```

系统会提示输入 Personal Access Token (PAT)

### 步骤 5: 发布到市场

```bash
vsce publish
```

或者指定版本：

```bash
vsce publish 0.1.0
```

---

## 📝 发布后

### 1. 验证发布
- 访问：https://marketplace.visualstudio.com/items?itemName=nita121388.codepath-extension
- 检查页面显示是否正常
- 在 VS Code 中搜索 "CodePath" 测试安装

### 2. 创建 Git 标签

```bash
git tag v0.1.0
git push origin v0.1.0
```

### 3. 创建 GitHub Release
1. 访问：https://github.com/Nita121388/vscode-codepath/releases/new
2. 选择标签：v0.1.0
3. 标题：CodePath v0.1.0
4. 描述：复制 CHANGELOG.md 中的内容
5. 上传 `.vsix` 文件作为附件
6. 点击 "Publish release"

---

## 🔄 后续更新流程

### 修复 Bug（补丁版本）

```bash
# 1. 修改代码
# 2. 更新 CHANGELOG.md
# 3. 编译
npm run compile

# 4. 发布（自动更新版本号 0.1.0 → 0.1.1）
vsce publish patch
```

### 新增功能（次要版本）

```bash
# 1. 开发新功能
# 2. 更新 CHANGELOG.md
# 3. 编译
npm run compile

# 4. 发布（自动更新版本号 0.1.0 → 0.2.0）
vsce publish minor
```

### 重大更新（主要版本）

```bash
# 1. 完成重大更新
# 2. 更新 CHANGELOG.md
# 3. 编译
npm run compile

# 4. 发布（自动更新版本号 0.1.0 → 1.0.0）
vsce publish major
```

---

## ⚠️ 注意事项

### Publisher ID 说明
- 当前 package.json 中设置的是 `Nita`
- Publisher ID 必须与你在 Marketplace 创建的完全一致
- 已确认你的 Marketplace Publisher ID 是 `Nita` ✅

### 图标说明
- 当前 package.json 中没有配置图标
- 如果要添加图标：
  1. 创建 `images/icon.png`（128x128 PNG）
  2. 在 package.json 中添加：`"icon": "images/icon.png"`

### 首次发布
- 首次发布可能需要几分钟到几小时审核
- 发布后可以在管理页面查看状态
- 审核通过后会收到邮件通知

---

## 🆘 遇到问题？

### 常见错误

**错误 1**: `ERROR  Missing publisher name`
```bash
# 解决：确保 package.json 中有 publisher 字段
"publisher": "Nita"
```

**错误 2**: `ERROR  Invalid publisher name`
```bash
# 解决：Publisher ID 必须与 Marketplace 中创建的完全一致
# 当前使用的是: Nita
```

**错误 3**: `ERROR  Authentication failed`
```bash
# 解决：重新登录
vsce login Nita
# 输入正确的 PAT
```

**错误 4**: `ERROR  Compilation failed`
```bash
# 解决：先编译项目
npm run compile
```

---

## 📞 获取帮助

- **官方文档**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **GitHub Issues**: https://github.com/Nita121388/vscode-codepath/issues
- **VS Code 扩展开发**: https://code.visualstudio.com/api

---

**准备好发布了吗？按照上面的步骤一步步来！** 🚀
