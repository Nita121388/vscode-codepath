// 导入测试框架和待测试的错误类
import { describe, it, expect } from 'vitest';
import { CodePathError } from './errors';

// 描述 CodePathError 类的测试套件
describe('CodePathError', () => {
    // 测试构造函数功能
    describe('constructor', () => {
        // 测试创建具有基本属性的错误实例
        it('should create error with basic properties', () => {
            const error = new CodePathError('Test message', 'user');
            
            expect(error.message).toBe('Test message');
            expect(error.category).toBe('user');
            expect(error.recoverable).toBe(true);
            expect(error.name).toBe('CodePathError');
        });

        // 测试使用自定义选项创建错误实例
        it('should create error with custom options', () => {
            const originalError = new Error('Original');
            const error = new CodePathError('Test message', 'filesystem', {
                recoverable: false,
                userMessage: 'Custom user message',
                suggestedAction: 'checkPermissions',
                originalError
            });
            
            expect(error.recoverable).toBe(false);
            expect(error.userMessage).toBe('Custom user message');
            expect(error.suggestedAction).toBe('checkPermissions');
            expect(error.originalError).toBe(originalError);
        });

        // 测试为不同错误类型提供中文默认提示信息
        it('应该为不同错误类型提供中文默认提示', () => {
            const userError = new CodePathError('Test', 'user');
            const filesystemError = new CodePathError('Test', 'filesystem');
            const validationError = new CodePathError('Test', 'validation');
            const renderingError = new CodePathError('Test', 'rendering');
            const performanceError = new CodePathError('Test', 'performance');
            
            expect(userError.userMessage).toBe('请检查您的输入并重试。');
            expect(filesystemError.userMessage).toBe('文件操作失败。请检查权限并重试。');
            expect(validationError.userMessage).toBe('数据验证失败。无法完成操作。');
            expect(renderingError.userMessage).toBe('预览渲染失败。正在切换到文本视图。');
            expect(performanceError.userMessage).toBe('达到性能限制。请考虑减少图表大小。');
        });

        // 测试为每种错误类别提供默认的建议操作
        it('should use default suggested action for each category', () => {
            const userError = new CodePathError('Test', 'user');
            const filesystemError = new CodePathError('Test', 'filesystem');
            const validationError = new CodePathError('Test', 'validation');
            const renderingError = new CodePathError('Test', 'rendering');
            const performanceError = new CodePathError('Test', 'performance');
            
            expect(userError.suggestedAction).toBe('selectText');
            expect(filesystemError.suggestedAction).toBe('checkPermissions');
            expect(validationError.suggestedAction).toBe('retry');
            expect(renderingError.suggestedAction).toBe('switchToTextView');
            expect(performanceError.suggestedAction).toBe('reduceNodes');
        });
    });

    // 测试静态工厂方法
    describe('static factory methods', () => {
        // 测试创建用户错误的方法
        it('should create user error', () => {
            const error = CodePathError.userError('No text selected');
            
            expect(error.category).toBe('user');
            expect(error.message).toBe('No text selected');
            expect(error.recoverable).toBe(true);
        });

        // 测试使用自定义消息和操作创建用户错误
        it('should create user error with custom message and action', () => {
            const error = CodePathError.userError(
                'Invalid selection', 
                'Please select valid code text', 
                'selectText'
            );
            
            expect(error.userMessage).toBe('Please select valid code text');
            expect(error.suggestedAction).toBe('selectText');
        });

        // 测试创建文件系统错误的方法
        it('should create filesystem error', () => {
            const originalError = new Error('ENOENT');
            const error = CodePathError.filesystemError('File not found', originalError);
            
            expect(error.category).toBe('filesystem');
            expect(error.originalError).toBe(originalError);
            expect(error.recoverable).toBe(true);
        });

        // 测试创建验证错误的方法
        it('should create validation error', () => {
            const error = CodePathError.validationError('Invalid node data', 'Node validation failed', false);
            
            expect(error.category).toBe('validation');
            expect(error.userMessage).toBe('Node validation failed');
            expect(error.recoverable).toBe(false);
            expect(error.suggestedAction).toBe('none');
        });

        // 测试创建可恢复的验证错误
        it('should create recoverable validation error', () => {
            const error = CodePathError.validationError('Invalid node data', 'Node validation failed', true);
            
            expect(error.recoverable).toBe(true);
            expect(error.suggestedAction).toBe('retry');
        });

        // 测试创建渲染错误的方法
        it('should create rendering error', () => {
            const originalError = new Error('Mermaid syntax error');
            const error = CodePathError.renderingError('Rendering failed', originalError);
            
            expect(error.category).toBe('rendering');
            expect(error.originalError).toBe(originalError);
            expect(error.userMessage).toBe('Preview rendering failed. Switching to text view.');
            expect(error.suggestedAction).toBe('switchToTextView');
        });

        // 测试创建性能错误的方法
        it('should create performance error', () => {
            const error = CodePathError.performanceError('Too many nodes');
            
            expect(error.category).toBe('performance');
            expect(error.userMessage).toBe('Performance limit reached. Consider reducing the graph size.');
            expect(error.suggestedAction).toBe('reduceNodes');
        });

        // 测试使用自定义消息创建性能错误
        it('should create performance error with custom message', () => {
            const error = CodePathError.performanceError('Memory limit exceeded', 'Graph is too large for memory');
            
            expect(error.userMessage).toBe('Graph is too large for memory');
        });

        // 测试创建剪贴板错误的方法
        it('should create clipboard error', () => {
            const error = CodePathError.clipboardError('Copy operation failed');
            
            expect(error.category).toBe('clipboard');
            expect(error.message).toBe('剪贴板操作失败: Copy operation failed');
            expect(error.userMessage).toBe('剪贴板操作失败。请重试。');
            expect(error.suggestedAction).toBe('clearClipboard');
        });

        // 测试使用自定义消息创建剪贴板错误
        it('should create clipboard error with custom message', () => {
            const error = CodePathError.clipboardError('Paste failed', 'Custom clipboard message');
            
            expect(error.userMessage).toBe('Custom clipboard message');
        });

        // 测试创建节点顺序错误的方法
        it('should create order error', () => {
            const error = CodePathError.orderError('Move up failed');
            
            expect(error.category).toBe('order');
            expect(error.message).toBe('节点顺序操作失败: Move up failed');
            expect(error.userMessage).toBe('节点顺序操作失败。请检查节点位置并重试。');
            expect(error.suggestedAction).toBe('refreshPreview');
        });

        // 测试使用自定义消息创建节点顺序错误
        it('should create order error with custom message', () => {
            const error = CodePathError.orderError('Move down failed', 'Custom order message');
            
            expect(error.userMessage).toBe('Custom order message');
        });

        // 测试创建菜单错误的方法
        it('should create menu error', () => {
            const error = CodePathError.menuError('Context menu failed');
            
            expect(error.category).toBe('menu');
            expect(error.message).toBe('菜单操作失败: Context menu failed');
            expect(error.userMessage).toBe('菜单操作失败。请重试或刷新界面。');
            expect(error.suggestedAction).toBe('refreshPreview');
        });

        // 测试使用自定义消息创建菜单错误
        it('should create menu error with custom message', () => {
            const error = CodePathError.menuError('Menu display failed', 'Custom menu message');
            
            expect(error.userMessage).toBe('Custom menu message');
        });
    });

    // 测试错误继承关系
    describe('error inheritance', () => {
        // 测试错误实例的继承关系
        it('should be instance of Error', () => {
            const error = new CodePathError('Test', 'user');
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(CodePathError);
        });

        // 测试错误堆栈跟踪的正确性
        it('should have proper stack trace', () => {
            const error = new CodePathError('Test', 'user');
            
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('CodePathError');
        });
    });
});