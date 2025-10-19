# 为 CodePath 扩展做贡献

感谢您对为 CodePath 做贡献的兴趣！本文档为贡献者提供指南和信息。

## 🚀 开始

### 先决条件

- **Node.js**: 版本 16 或更高
- **VS Code**: 最新稳定版本
- **Git**: 用于版本控制
- **TypeScript**: 建议具备基础知识

### 开发环境设置

1. **Fork 和克隆**
   ```bash
   git clone https://github.com/your-username/codepath-extension.git
   cd codepath-extension
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **在 VS Code 中打开**
   ```bash
   code .
   ```

4. **启动扩展开发主机**
   - 按 `F5` 或使用运行和调试面板中的 "Run Extension"
   - 将打开一个加载了扩展的新 VS Code 窗口

## 🏗️ 项目结构

```
codepath-extension/
├── src/                          # 源代码
│   ├── extension.ts             # 主扩展入口点
│   ├── managers/                # 核心业务逻辑管理器
│   ├── models/                  # 数据模型 (Graph, Node)
│   ├── renderers/               # 预览渲染 (Text)
│   ├── types/                   # TypeScript 类型定义
│   ├── interfaces/              # 接口定义
│   └── integration/             # 集成测试
├── package.json                 # 扩展清单和依赖
├── tsconfig.json               # TypeScript 配置
├── vitest.config.js            # 测试配置
└── README.md                   # 用户文档
```

### 关键组件

- **Extension.ts**: 主要激活和停用逻辑
- **Managers**: 图表、节点、预览、存储等业务逻辑
- **Models**: 带验证的 Graph 和 Node 数据结构
- **Renderers**: 文本预览生成（图表渲染规划中）
- **Integration Tests**: 端到端工作流测试

## 🧪 测试

### 运行测试

```bash
# 运行所有单元测试
npm run test:unit

# 监视模式运行测试
npm run test:unit:watch

# 运行特定测试文件
npm run test:unit -- src/managers/GraphManager.test.ts

# 运行集成测试
npm run test:unit -- src/integration/

# 运行带覆盖率的测试
npm run test:unit -- --coverage
```

### 测试结构

- **单元测试**: 独立测试单个组件
- **集成测试**: 测试完整工作流和组件交互
- **性能测试**: 验证性能特征
- **边界情况测试**: 测试错误条件和边界情况

### 编写测试

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentName', () => {
    let component: ComponentName;

    beforeEach(() => {
        component = new ComponentName();
    });

    it('should perform expected behavior', () => {
        // 准备
        const input = 'test input';
        
        // 执行
        const result = component.method(input);
        
        // 断言
        expect(result).toBe('expected output');
    });
});
```

## 🎯 开发指南

### 代码风格

- **TypeScript**: 使用严格的 TypeScript 和适当的类型
- **ESLint**: 遵循配置的 ESLint 规则
- **格式化**: 使用一致的格式化（推荐 Prettier）
- **命名**: 为变量、函数和类使用描述性名称

### 架构原则

1. **关注点分离**: 每个管理器处理特定领域
2. **依赖注入**: 通过构造函数传递依赖
3. **错误处理**: 使用带恢复建议的自定义错误类型
4. **异步/等待**: 优先使用 async/await 而不是 promises 以提高可读性
5. **不可变性**: 尽可能避免变异对象

### VS Code 扩展最佳实践

- **激活事件**: 使用特定的激活事件，而不是 `*`
- **命令**: 在 `package.json` 中注册所有命令
- **配置**: 使用 VS Code 配置 API 进行设置
- **可释放资源**: 正确释放资源以防止内存泄漏
- **错误消息**: 提供有用的、可操作的错误消息

## 🐛 错误报告

### 提交前

1. **搜索现有问题**: 检查错误是否已被报告
2. **重现**: 确保错误可重现
3. **最小示例**: 创建最小重现案例
4. **环境**: 注明 VS Code 版本、操作系统和扩展版本

### 错误报告模板

```markdown
**错误描述**
清楚描述错误是什么。

**重现步骤**
1. 转到 '...'
2. 点击 '....'
3. 向下滚动到 '....'
4. 看到错误

**预期行为**
您期望发生什么。

**实际行为**
实际发生了什么。

**环境**
- 操作系统: [例如 Windows 10, macOS 12.0]
- VS Code 版本: [例如 1.74.0]
- 扩展版本: [例如 0.1.0]

**附加上下文**
关于问题的任何其他上下文。
```

## ✨ 功能请求

### 提交前

1. **检查现有请求**: 查找类似的功能请求
2. **用例**: 清楚描述用例和问题
3. **替代方案**: 考虑现有功能是否可以解决问题
4. **范围**: 保持范围集中和明确定义

### 功能请求模板

```markdown
**功能描述**
清楚描述您希望看到的功能。

**问题陈述**
此功能解决什么问题？

**建议解决方案**
您希望此功能如何工作？

**考虑的替代方案**
您考虑了哪些替代方案？

**附加上下文**
关于功能请求的任何其他上下文或截图。
```

## 🔄 拉取请求流程

### 创建 PR 前

1. **问题优先**: 创建或引用现有问题
2. **分支**: 从 `main` 创建功能分支
3. **测试**: 为新功能添加测试
4. **文档**: 根据需要更新文档
5. **代码检查**: 确保代码通过代码检查

### PR 指南

1. **标题**: 使用描述性标题（例如 "Add fuzzy node matching feature"）
2. **描述**: 解释进行了哪些更改以及为什么
3. **测试**: 描述如何测试更改
4. **破坏性更改**: 清楚标记任何破坏性更改
5. **截图**: 包含 UI 更改的截图

### PR 模板

```markdown
## 描述
简要描述所做的更改。

## 更改类型
- [ ] 错误修复（修复问题的非破坏性更改）
- [ ] 新功能（添加功能的非破坏性更改）
- [ ] 破坏性更改（会导致现有功能无法按预期工作的修复或功能）
- [ ] 文档更新

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成
- [ ] 性能影响评估

## 检查清单
- [ ] 代码遵循项目风格指南
- [ ] 完成自我审查
- [ ] 文档已更新
- [ ] 测试已添加/更新
- [ ] 无破坏性更改（或清楚记录）
```

## 📝 代码审查流程

### 对于贡献者

- **响应及时**: 及时回应审查评论
- **保持开放**: 对反馈和建议保持开放
- **解释**: 解释实现选择的理由
- **测试**: 确保所有测试在请求审查前通过

### 对于审查者

- **建设性**: 提供有用的、建设性的反馈
- **具体**: 指出具体行并建议改进
- **及时**: 在合理时间内审查 PR
- **彻底**: 检查代码质量、测试和文档

## 🏷️ 发布流程

### 版本编号

我们遵循 [语义版本控制](https://semver.org/)：
- **主要版本**: 破坏性更改
- **次要版本**: 新功能（向后兼容）
- **补丁版本**: 错误修复（向后兼容）

### 发布检查清单

1. **更新版本**: 更新 `package.json` 中的版本
2. **更新变更日志**: 在 `CHANGELOG.md` 中记录更改
3. **测试**: 运行完整测试套件
4. **构建**: 创建生产构建
5. **标记**: 为发布创建 git 标记
6. **发布**: 发布到 VS Code 市场

## 🤝 社区指南

### 行为准则

- **尊重**: 尊重对待所有贡献者
- **包容**: 欢迎来自所有背景的贡献者
- **协作**: 共同努力改进项目
- **专业**: 保持专业沟通

### 沟通渠道

- **GitHub Issues**: 错误报告和功能请求
- **GitHub Discussions**: 一般问题和讨论
- **拉取请求**: 代码贡献和审查

## 📚 资源

### VS Code 扩展开发

- [VS Code 扩展 API](https://code.visualstudio.com/api)
- [扩展指南](https://code.visualstudio.com/api/references/extension-guidelines)
- [发布扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

### TypeScript

- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [TypeScript 最佳实践](https://typescript-eslint.io/docs/)

### 测试

- [Vitest 文档](https://vitest.dev/)
- [测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🙏 认可

贡献者将在以下地方得到认可：
- **README.md**: 贡献者部分
- **CHANGELOG.md**: 发布说明
- **GitHub**: 贡献者图表和统计

感谢您为 CodePath 做贡献！您的努力帮助为世界各地的开发者改善代码可视化。🚀
