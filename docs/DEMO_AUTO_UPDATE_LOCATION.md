# 自动更新节点位置功能演示

## 演示场景

### 场景1：代码行号变化

#### 步骤1：创建节点
1. 打开一个代码文件
2. 选中第10行的代码：`function calculateTotal() {`
3. 右键 → "CodePath: Create Node"
4. 输入节点名称："Calculate Total Function"
5. 节点创建成功，记录位置：第10行

#### 步骤2：修改代码
1. 在文件顶部添加几行注释：
```typescript
// File: calculator.ts
// Author: Developer
// Date: 2025-10-02
// Description: Calculator utilities

function calculateTotal() {
    // 现在这个函数在第15行了
}
```

#### 步骤3：触发位置检测
1. 点击CodePath预览面板中的"Calculate Total Function"节点
2. 系统检测到位置变化
3. 弹出提示：
```
⚠️ Code location may have changed: Code found at line 15 (moved 5 lines)
[OK] [Dismiss]
```

#### 步骤4：自动更新
1. 点击"OK"按钮
2. 系统自动更新节点位置到第15行
3. 显示成功消息："Node location updated successfully"
4. 再次点击节点，直接导航到第15行，不再显示提示

### 场景2：代码被移动

#### 步骤1：创建节点
1. 在文件顶部有一个工具函数：
```typescript
// Line 5
function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
}
```
2. 创建节点指向这个函数

#### 步骤2：重构代码
1. 将工具函数移动到文件底部：
```typescript
// Line 150
function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
}
```

#### 步骤3：智能搜索
1. 点击节点
2. 系统在原位置（第5行）没找到代码
3. 自动搜索整个文件
4. 在第150行找到匹配的代码
5. 显示提示：
```
⚠️ Code location may have changed: Code found at line 150 (moved 145 lines)
[OK] [Dismiss]
```

#### 步骤4：确认更新
1. 点击"OK"
2. 节点位置更新到第150行
3. 代码片段也更新为新位置的内容

### 场景3：代码被修改

#### 步骤1：原始代码
```typescript
// Line 20
const result = calculateSum(a, b);
```
节点指向这行代码

#### 步骤2：修改代码
```typescript
// Line 20
const result = calculateSum(a, b, c); // 添加了参数c
```

#### 步骤3：模糊匹配
1. 点击节点
2. 系统检测到代码有变化（哈希不匹配）
3. 使用模糊匹配算法
4. 计算相似度：95%（高置信度）
5. 显示提示：
```
⚠️ Code location may have changed: Code found at line 20 (moved 0 lines)
[OK] [Dismiss]
```

#### 步骤4：更新代码片段
1. 点击"OK"
2. 节点的代码片段更新为新内容
3. 保持在同一行号

## 演示要点

### 视觉效果
- ⚠️ 警告图标吸引注意
- 清晰的消息说明变化
- 明确的行号和移动距离
- 友好的按钮选项

### 交互流程
```
用户操作 → 系统检测 → 显示提示 → 用户确认 → 自动更新 → 显示结果
```

### 关键信息展示
1. **变化描述**: "Code found at line X"
2. **移动距离**: "(moved Y lines)"
3. **操作选项**: [OK] [Dismiss]
4. **结果反馈**: "Node location updated successfully"

## 录制建议

### 录制工具
- **Windows**: Xbox Game Bar (Win+G)
- **Mac**: QuickTime Player
- **跨平台**: OBS Studio

### 录制设置
- **分辨率**: 1920x1080
- **帧率**: 30fps
- **格式**: MP4 或 GIF
- **时长**: 30-60秒每个场景

### 录制步骤
1. 准备好测试代码文件
2. 创建节点
3. 修改代码（添加/删除行）
4. 点击节点触发检测
5. 展示提示对话框
6. 点击OK按钮
7. 展示成功消息
8. 验证导航到正确位置

### 后期处理
- 添加文字说明
- 高亮关键操作
- 放慢关键步骤
- 添加箭头指示

## 演示脚本

### 开场（5秒）
```
"当你的代码发生变化时，CodePath会自动检测并提示你更新节点位置。"
```

### 场景展示（20秒）
```
1. "这里有一个节点指向第10行的代码"
2. "我在上面添加了几行代码"
3. "现在点击节点..."
4. "看！系统检测到代码移动到了第15行"
5. "点击OK按钮"
6. "节点位置自动更新完成！"
```

### 结尾（5秒）
```
"就是这么简单！你的节点始终指向正确的代码位置。"
```

## 截图建议

### 截图1：提示对话框
- 显示完整的警告消息
- 突出显示OK和Dismiss按钮
- 包含代码编辑器背景

### 截图2：成功消息
- 显示"Node location updated successfully"
- 显示更新后的节点位置
- 显示代码编辑器中的正确行

### 截图3：前后对比
- 左侧：更新前的节点信息（第10行）
- 右侧：更新后的节点信息（第15行）
- 用箭头连接表示变化

## 测试检查清单

- [ ] 代码向下移动（添加行）
- [ ] 代码向上移动（删除行）
- [ ] 代码移动到文件其他位置
- [ ] 代码被轻微修改
- [ ] 代码被大幅修改
- [ ] 点击OK更新成功
- [ ] 点击Dismiss保持不变
- [ ] 更新后再次点击不显示提示
- [ ] 多个节点独立更新
- [ ] 错误处理（文件不存在等）

## 常见演示问题

### Q: 如何确保每次都能触发提示？
A: 在演示前清除节点缓存，或创建新节点。

### Q: 如何让变化更明显？
A: 移动较大的行数（10行以上），或移动到文件完全不同的位置。

### Q: 如何展示置信度？
A: 修改代码内容而不是位置，触发模糊匹配。

### Q: 如何演示失败情况？
A: 完全删除或重写代码，系统会显示"Code snippet not found"。

## 相关资源

- [用户指南](./AUTO_UPDATE_LOCATION_GUIDE.md)
- [快速参考](./QUICK_REFERENCE_AUTO_UPDATE.md)
- [技术文档](../AUTO_UPDATE_NODE_LOCATION.md)
