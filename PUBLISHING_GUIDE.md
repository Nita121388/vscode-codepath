# VS Code 市场发布指南

本指南将帮助你将 CodePath 扩展发布到 VS Code 市场。

## 📋 发布前准备清单

### 1. 必需的配置

#### ✅ 已完成
- [x] package.json 基本信息
- [x] README.md 文档
- [x] CHANGELOG.md 变更日志
- [x] LICENSE 文件（需要添加）
- [x] .vscodeignore 文件

#### ⚠️ 需要完善

**package.json 需要添加的字段**：
```json
{
  "publisher": "你的发布者ID",
  "author": {
    "name": "你的名字"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Nita121388/vscode-codepath.git"
  },
  "bugs": {
    "url": "https://github.com/Nita121388/vscode-codepath/issues"
  },
  "homepage": "https://github.com/Nita121388/vscode-codepath#readme",
  "keywords": [
    "code-path",
    "execution-path",
    "code-tracking",
    "visualization",
    "mermaid",
    "code-flow",
    "debugging"
  ],
  "icon": "images/icon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  }
}
```

---

## 🚀 发布步骤

### 步骤 1: 创建发布者账号

1. **访问 Visual Studio Marketplace**
   - 网址：https://marketplace.visualstudio.com/manage

2. **使用 Microsoft 账号登录**
   - 如果没有，需要先注册一个

3. **创建发布者（Publisher）**
   - 点击 "Create publisher"
   - 填写信息：
     - **Name**: 显示名称（如：Nita）
     - **ID**: 唯一标识符（如：nita121388，只能包含字母、数字、连字符）
     - **Email**: 你的邮箱
   - 记住你的 Publisher ID，后面会用到

### 步骤 2: 获取 Personal Access Token (PAT)

1. **访问 Azure DevOps**
   - 网址：https://dev.azure.com

2. **创建 PAT**
   - 点击右上角用户图标 → "Personal access tokens"
   - 点击 "New Token"
   - 填写信息：
     - **Name**: vscode-marketplace（或其他名称）
     - **Organization**: All accessible organizations
     - **Expiration**: 选择过期时间（建议 90 天或自定义）
     - **Scopes**: 选择 "Custom defined"
       - 勾选 **Marketplace** → **Manage**
   - 点击 "Create"
   - **重要**：复制生成的 Token，只会显示一次！

### 步骤 3: 安装 vsce 工具

```bash
npm install -g @vscode/vsce
```

### 步骤 4: 完善 package.json

运行以下命令更新 package.json：

```bash
# 我会帮你创建更新后的 package.json
```

### 步骤 5: 添加 LICENSE 文件

```bash
# 我会帮你创建 MIT LICENSE 文件
```

### 步骤 6: 添加图标（可选但推荐）

创建一个 128x128 的 PNG 图标：
- 路径：`images/icon.png`
- 尺寸：128x128 像素
- 格式：PNG
- 建议：简洁、清晰、代表项目特点

### 步骤 7: 编译项目

```bash
npm run compile
```

### 步骤 8: 打包扩展

```bash
vsce package
```

这会生成一个 `.vsix` 文件，如：`codepath-extension-0.0.1.vsix`

### 步骤 9: 发布到市场

**方式 1: 使用命令行（推荐）**

```bash
# 首次发布，需要登录
vsce login <你的发布者ID>
# 输入之前创建的 PAT

# 发布
vsce publish
```

**方式 2: 手动上传**

1. 访问：https://marketplace.visualstudio.com/manage
2. 点击你的发布者
3. 点击 "New extension" → "Visual Studio Code"
4. 上传 `.vsix` 文件
5. 填写描述和截图
6. 点击 "Upload"

---

## 📝 发布后的版本更新

### 更新版本号

```bash
# 补丁版本（0.0.1 → 0.0.2）
vsce publish patch

# 次要版本（0.0.1 → 0.1.0）
vsce publish minor

# 主要版本（0.0.1 → 1.0.0）
vsce publish major

# 指定版本
vsce publish 0.1.0
```

### 更新流程

1. 修改代码
2. 更新 CHANGELOG.md
3. 编译：`npm run compile`
4. 发布：`vsce publish patch`（或其他版本）

---

## 🎨 市场页面优化

### 1. README.md 优化

你的 README.md 会显示在市场页面，确保包含：
- ✅ 清晰的功能介绍
- ✅ 使用截图/GIF
- ✅ 快速开始指南
- ✅ 功能列表
- ✅ 配置说明

### 2. 添加截图

在 README.md 中添加截图：
```markdown
![Feature 1](images/screenshot1.png)
![Feature 2](images/screenshot2.png)
```

### 3. 添加 GIF 演示

使用工具录制操作演示：
- Windows: ScreenToGif
- macOS: Kap
- 跨平台: LICEcap

---

## ⚠️ 常见问题

### 问题 1: "Publisher not found"
**解决**：确保在 package.json 中添加了 `publisher` 字段

### 问题 2: "Invalid publisher name"
**解决**：Publisher ID 只能包含小写字母、数字和连字符

### 问题 3: "Missing LICENSE"
**解决**：添加 LICENSE 文件到项目根目录

### 问题 4: "Icon not found"
**解决**：
- 确保图标路径正确
- 图标必须是 128x128 PNG
- 或者暂时删除 package.json 中的 `icon` 字段

### 问题 5: 编译失败
**解决**：
```bash
npm install
npm run compile
```

---

## 📊 发布检查清单

发布前请确认：

- [ ] package.json 包含所有必需字段
- [ ] 添加了 LICENSE 文件
- [ ] README.md 内容完整
- [ ] CHANGELOG.md 已更新
- [ ] 代码编译成功（`npm run compile`）
- [ ] 测试通过（`npm test`）
- [ ] 版本号正确
- [ ] 创建了发布者账号
- [ ] 获取了 PAT
- [ ] 安装了 vsce 工具

---

## 🔗 有用的链接

- **VS Code 扩展市场**: https://marketplace.visualstudio.com/vscode
- **发布管理页面**: https://marketplace.visualstudio.com/manage
- **官方发布文档**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **vsce 文档**: https://github.com/microsoft/vscode-vsce

---

## 💡 下一步

我可以帮你：
1. ✅ 更新 package.json 添加必需字段
2. ✅ 创建 LICENSE 文件
3. ✅ 创建图标（如果你提供设计）
4. ✅ 优化 README.md 添加截图占位符
5. ✅ 打包扩展

准备好后告诉我，我会帮你完成这些步骤！
