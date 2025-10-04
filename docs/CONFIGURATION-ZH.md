# CodePath 配置指南

本文档详细介绍了 CodePath 扩展的所有配置选项和自定义设置。

## 🔧 基本配置

### 访问设置

1. **通过 VS Code 设置界面**:
   - 打开 VS Code 设置 (`Ctrl+,` 或 `Cmd+,`)
   - 搜索 "CodePath"
   - 修改所需设置

2. **通过 settings.json**:
   - 打开命令面板 (`Ctrl+Shift+P`)
   - 输入 "Preferences: Open Settings (JSON)"
   - 添加 CodePath 配置

## ⚙️ 配置选项

### 默认视图格式
```json
{
  "codepath.defaultView": "text"
}
```

**选项**: `"text"` | `"mermaid"`  
**默认值**: `"text"`  
**描述**: 设置预览面板的默认显示格式

- `"text"`: 层次化文本视图，显示节点树结构
- `"mermaid"`: Mermaid 图表视图，显示可视化流程图

**示例**:
```json
// 默认使用图表视图
{
  "codepath.defaultView": "mermaid"
}
```

### 自动保存
```json
{
  "codepath.autoSave": true
}
```

**类型**: `boolean`  
**默认值**: `true`  
**描述**: 启用图表的自动保存功能

- `true`: 图表会定期自动保存到磁盘
- `false`: 只有手动操作时才保存图表

**相关设置**: 与 `previewRefreshInterval` 配合使用

### 自动加载上次图表
```json
{
  "codepath.autoLoadLastGraph": true
}
```

**类型**: `boolean`  
**默认值**: `true`  
**描述**: VS Code 启动时自动加载上次使用的图表

- `true`: 启动时恢复上次的工作状态
- `false`: 每次启动都从空白状态开始

### 预览刷新间隔
```json
{
  "codepath.previewRefreshInterval": 1000
}
```

**类型**: `number`  
**默认值**: `1000`  
**单位**: 毫秒  
**描述**: 预览面板的更新间隔时间

**建议值**:
- `500`: 快速响应（可能影响性能）
- `1000`: 平衡性能和响应性（推荐）
- `2000`: 节省资源（响应较慢）

### 每个图表最大节点数
```json
{
  "codepath.maxNodesPerGraph": 100
}
```

**类型**: `number`  
**默认值**: `100`  
**描述**: 单个图表允许的最大节点数量

**性能考虑**:
- `50`: 小型项目，快速响应
- `100`: 中型项目，平衡性能（推荐）
- `200`: 大型项目，可能影响性能

## 🎨 高级配置

### 完整配置示例

```json
{
  // CodePath 扩展配置
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100,
  
  // VS Code 相关配置（可选）
  "editor.minimap.enabled": true,
  "editor.wordWrap": "on",
  "files.autoSave": "afterDelay"
}
```

### 工作区特定配置

在项目根目录创建 `.vscode/settings.json`:

```json
{
  "codepath.defaultView": "mermaid",
  "codepath.maxNodesPerGraph": 150,
  "codepath.previewRefreshInterval": 500
}
```

这些设置只对当前工作区生效，不会影响全局配置。

## 🔍 配置场景

### 场景 1: 性能优先
适用于大型项目或性能较低的机器：

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": false,
  "codepath.previewRefreshInterval": 2000,
  "codepath.maxNodesPerGraph": 50
}
```

### 场景 2: 可视化优先
适用于需要频繁查看图表的场景：

```json
{
  "codepath.defaultView": "mermaid",
  "codepath.autoSave": true,
  "codepath.previewRefreshInterval": 500,
  "codepath.maxNodesPerGraph": 100
}
```

### 场景 3: 团队协作
适用于团队开发环境：

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": false,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 75
}
```

## 🗂️ 文件存储配置

### 存储位置
CodePath 将图表存储在工作区的 `.codepath/` 目录中：

```
your-project/
├── .codepath/
│   ├── graphs/          # 图表文件
│   ├── backup/          # 备份文件
│   ├── exports/         # 导出文件
│   └── config.json      # 本地配置
├── src/
└── package.json
```

### Git 集成
建议在 `.gitignore` 中添加：

```gitignore
# CodePath 临时文件
.codepath/backup/
.codepath/exports/

# 保留图表文件（可选）
# .codepath/graphs/
```

## 🎯 键盘快捷键配置

### 默认快捷键
```json
{
  "key": "ctrl+shift+c",
  "command": "codepath.openPanel"
},
{
  "key": "ctrl+alt+n",
  "command": "codepath.createNode"
},
{
  "key": "ctrl+alt+c",
  "command": "codepath.createChildNode"
}
```

### 自定义快捷键
在 `keybindings.json` 中添加：

```json
[
  {
    "key": "ctrl+shift+p",
    "command": "codepath.openPanel",
    "when": "editorTextFocus"
  },
  {
    "key": "alt+n",
    "command": "codepath.createNode",
    "when": "editorHasSelection"
  }
]
```

## 🔧 故障排除

### 配置不生效
1. **重启 VS Code**: 某些配置需要重启才能生效
2. **检查语法**: 确保 JSON 格式正确
3. **检查作用域**: 确认是全局还是工作区配置

### 性能问题
1. **增加刷新间隔**: 设置更大的 `previewRefreshInterval`
2. **减少节点数**: 降低 `maxNodesPerGraph` 值
3. **禁用自动保存**: 设置 `autoSave` 为 `false`

### 存储问题
1. **检查权限**: 确保对工作区目录有写权限
2. **清理缓存**: 删除 `.codepath/backup/` 目录
3. **重置配置**: 删除 `.codepath/config.json` 文件

## 📊 配置验证

### 验证配置是否正确
1. 打开命令面板 (`Ctrl+Shift+P`)
2. 输入 "CodePath: Show Configuration"
3. 查看当前生效的配置值

### 重置为默认值
```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100
}
```

## 🚀 最佳实践

### 推荐配置
对于大多数用户，推荐使用默认配置：

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100
}
```

### 团队配置
在团队项目中，建议在 `.vscode/settings.json` 中统一配置：

```json
{
  "codepath.defaultView": "text",
  "codepath.maxNodesPerGraph": 75,
  "codepath.previewRefreshInterval": 1000
}
```

### 性能调优
根据项目大小和机器性能调整：

- **小项目**: 使用默认配置
- **大项目**: 增加刷新间隔，减少最大节点数
- **低性能机器**: 禁用自动保存，使用文本视图

---

**需要帮助？** 查看 [故障排除指南](README-ZH.md#故障排除) 或 [提交问题](https://github.com/your-org/codepath-extension/issues)。