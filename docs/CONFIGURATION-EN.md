# CodePath Configuration Guide

This document provides detailed information about all configuration options and customization settings for the CodePath extension.

## 🔧 Basic Configuration

### Accessing Settings

1. **Through VS Code Settings UI**:
   - Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
   - Search for "CodePath"
   - Modify desired settings

2. **Through settings.json**:
   - Open Command Palette (`Ctrl+Shift+P`)
   - Type "Preferences: Open Settings (JSON)"
   - Add CodePath configuration

## ⚙️ Configuration Options

### Default View Format
```json
{
  "codepath.defaultView": "text"
}
```

**Options**: `"text"`  
**Default**: `"text"`  
**Description**: Sets the default display format for the preview panel。当前仅支持文本视图，图表格式将在未来版本开放。

### Auto Save
```json
{
  "codepath.autoSave": true
}
```

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enables automatic saving of graphs

- `true`: Graphs are automatically saved to disk periodically
- `false`: Graphs are only saved during manual operations

**Related**: Works with `previewRefreshInterval`

### Auto Load Last Graph
```json
{
  "codepath.autoLoadLastGraph": true
}
```

**Type**: `boolean`  
**Default**: `true`  
**Description**: Automatically loads the last used graph when VS Code starts

- `true`: Restores previous work state on startup
- `false`: Starts with blank state each time

### Auto Open Preview on Startup
```json
{
  "codepath.autoOpenPreviewOnStartup": true
}
```

**Type**: `boolean`  
**Default**: `true`  
**Description**: Controls whether the preview panel should pop up automatically when the extension initializes

- `true`: Automatically reveals the preview after loading the last graph
- `false`: Keeps editors focused; users can open the preview manually when needed

### Preview Refresh Interval
```json
{
  "codepath.previewRefreshInterval": 1000
}
```

**Type**: `number`  
**Default**: `1000`  
**Unit**: milliseconds  
**Description**: Update interval for the preview panel

**Recommended Values**:
- `500`: Fast response (may impact performance)
- `1000`: Balanced performance and responsiveness (recommended)
- `2000`: Resource saving (slower response)

### Maximum Nodes Per Graph
```json
{
  "codepath.maxNodesPerGraph": 100
}
```

**Type**: `number`  
**Default**: `100`  
**Description**: Maximum number of nodes allowed in a single graph

**Performance Considerations**:
- `50`: Small projects, fast response
- `100`: Medium projects, balanced performance (recommended)
- `200`: Large projects, may impact performance

## 🎨 Advanced Configuration

### Complete Configuration Example

```json
{
  // CodePath extension configuration
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.autoOpenPreviewOnStartup": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100,
  
  // Related VS Code settings (optional)
  "editor.minimap.enabled": true,
  "editor.wordWrap": "on",
  "files.autoSave": "afterDelay"
}
```

### Workspace-Specific Configuration

Create `.vscode/settings.json` in project root:

```json
{
  "codepath.defaultView": "text",
  "codepath.maxNodesPerGraph": 150,
  "codepath.previewRefreshInterval": 500
}
```

These settings only apply to the current workspace and don't affect global configuration.

## 🔍 Configuration Scenarios

### Scenario 1: Performance Priority
For large projects or lower-performance machines:

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": false,
  "codepath.previewRefreshInterval": 2000,
  "codepath.maxNodesPerGraph": 50
}
```

### Scenario 2: Preview Refresh Priority
For scenarios requiring more frequent preview updates:

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoOpenPreviewOnStartup": false,
  "codepath.previewRefreshInterval": 500,
  "codepath.maxNodesPerGraph": 100
}
```

### Scenario 3: Team Collaboration
For team development environments:

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": false,
  "codepath.autoOpenPreviewOnStartup": false,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 75
}
```

## 🗂️ File Storage Configuration

### Storage Location
CodePath stores graphs in the `.codepath/` directory within your workspace:

```
your-project/
├── .codepath/
│   ├── graphs/          # Graph files
│   ├── backup/          # Backup files
│   ├── exports/         # Export files
│   └── config.json      # Local configuration
├── src/
└── package.json
```

### Git Integration
Recommended `.gitignore` entries:

```gitignore
# CodePath temporary files
.codepath/backup/
.codepath/exports/

# Keep graph files (optional)
# .codepath/graphs/
```

## 🎯 Keyboard Shortcuts Configuration

### Default Shortcuts
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

### Custom Shortcuts
Add to `keybindings.json`:

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

## 🔧 Troubleshooting

### Configuration Not Taking Effect
1. **Restart VS Code**: Some settings require restart to take effect
2. **Check Syntax**: Ensure JSON format is correct
3. **Check Scope**: Confirm if global or workspace configuration

### Performance Issues
1. **Increase Refresh Interval**: Set higher `previewRefreshInterval`
2. **Reduce Node Count**: Lower `maxNodesPerGraph` value
3. **Disable Auto Save**: Set `autoSave` to `false`

### Storage Issues
1. **Check Permissions**: Ensure write access to workspace directory
2. **Clear Cache**: Delete `.codepath/backup/` directory
3. **Reset Configuration**: Delete `.codepath/config.json` file

## 📊 Configuration Validation

### Verify Configuration
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "CodePath: Show Configuration"
3. View current effective configuration values

### Reset to Defaults
```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.autoOpenPreviewOnStartup": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100
}
```

## 🚀 Best Practices

### Recommended Configuration
For most users, the default configuration is recommended:

```json
{
  "codepath.defaultView": "text",
  "codepath.autoSave": true,
  "codepath.autoLoadLastGraph": true,
  "codepath.previewRefreshInterval": 1000,
  "codepath.maxNodesPerGraph": 100
}
```

### Team Configuration
For team projects, standardize configuration in `.vscode/settings.json`:

```json
{
  "codepath.defaultView": "text",
  "codepath.autoOpenPreviewOnStartup": true,
  "codepath.maxNodesPerGraph": 75,
  "codepath.previewRefreshInterval": 1000
}
```

### Performance Tuning
Adjust based on project size and machine performance:

- **Small Projects**: Use default configuration
- **Large Projects**: Increase refresh interval, reduce max nodes
- **Low-Performance Machines**: Disable auto-save, use text view

---

**Need Help?** Check the [Troubleshooting Guide](README-EN.md#troubleshooting) or [Submit an Issue](https://github.com/your-org/codepath-extension/issues).
