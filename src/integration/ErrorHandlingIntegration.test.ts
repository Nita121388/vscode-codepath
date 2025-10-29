import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FeedbackManager } from '../managers/FeedbackManager';
import { CodePathError } from '../types/errors';

// Mock VS Code API
vi.mock('vscode', async () => {
    const actual = await import('../__mocks__/vscode');

    return {
        ...actual,
        window: {
            ...actual.window,
            createOutputChannel: vi.fn(() => ({
                appendLine: vi.fn(),
                show: vi.fn(),
                clear: vi.fn(),
                dispose: vi.fn()
            })),
            showInformationMessage: vi.fn().mockResolvedValue(undefined),
            showWarningMessage: vi.fn().mockResolvedValue(undefined),
            showErrorMessage: vi.fn().mockResolvedValue(undefined)
        },
        commands: {
            ...actual.commands,
            executeCommand: vi.fn().mockResolvedValue(undefined)
        }
    };
});

describe('Error Handling Integration', () => {
    let feedbackManager: FeedbackManager;

    beforeEach(() => {
        feedbackManager = new FeedbackManager();
        vi.clearAllMocks();
    });

    afterEach(() => {
        feedbackManager.dispose();
    });

    describe('Enhanced Error Messages', () => {
        it('should handle clipboard errors with Chinese messages', () => {
            const error = CodePathError.clipboardError('复制失败');
            
            feedbackManager.handleError('复制节点', error, 'ClipboardManager');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('剪贴板操作失败'),
                expect.any(String),
                '查看详情'
            );
        });

        it('should handle order errors with Chinese messages', () => {
            const error = CodePathError.orderError('移动失败');
            
            feedbackManager.handleError('移动节点', error, 'NodeOrderManager');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('节点顺序操作失败'),
                expect.any(String),
                '查看详情'
            );
        });

        it('should handle menu errors with Chinese messages', () => {
            const error = CodePathError.menuError('菜单操作失败');
            
            feedbackManager.handleError('显示菜单', error, 'WebviewManager');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('菜单操作失败'),
                expect.any(String),
                '查看详情'
            );
        });

        it('should handle user errors with appropriate recovery actions', () => {
            const error = CodePathError.userError('请选择文本', '请在编辑器中选择代码文本');
            
            feedbackManager.handleError('创建节点', error, 'CommandManager');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                '请在编辑器中选择代码文本',
                '选择文本',
                '查看详情'
            );
        });
    });

    describe('Success Messages with Details', () => {
        it('should show success messages with file details', () => {
            feedbackManager.showSuccess(
                '已标记为新节点: testNode',
                '文件: /test/file.ts, 行号: 10'
            );
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已标记为新节点: testNode'
            );
        });

        it('should show success messages with action buttons', () => {
            const mockAction = vi.fn();
            
            feedbackManager.showSuccess(
                '已复制该节点及其子节点',
                '节点: testNode',
                '粘贴',
                mockAction
            );
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已复制该节点及其子节点',
                '粘贴'
            );
        });
    });

    describe('Logging and Debug Information', () => {
        it('should log operations with component information', () => {
            const mockOutputChannel = {
                appendLine: vi.fn(),
                show: vi.fn(),
                clear: vi.fn(),
                dispose: vi.fn()
            };
            
            vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel);
            
            const manager = new FeedbackManager();
            
            manager.log('info', 'TestComponent', 'testOperation', '测试消息', { data: 'test' });
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[INFO] [TestComponent] testOperation: 测试消息')
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Data: {"data":"test"}')
            );
            
            manager.dispose();
        });

        it('should log errors with stack traces', () => {
            const mockOutputChannel = {
                appendLine: vi.fn(),
                show: vi.fn(),
                clear: vi.fn(),
                dispose: vi.fn()
            };
            
            vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel);
            
            const manager = new FeedbackManager();
            const error = new Error('测试错误');
            
            manager.log('error', 'TestComponent', 'testOperation', '错误消息', {}, error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [TestComponent] testOperation: 错误消息')
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Error: 测试错误')
            );
            
            manager.dispose();
        });
    });

    describe('Operation Feedback', () => {
        it('should provide feedback for successful operations', () => {
            const feedback = {
                operation: '创建节点',
                success: true,
                message: '节点创建成功',
                details: '文件: test.ts, 行号: 5'
            };
            
            feedbackManager.provideOperationFeedback(feedback);
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点创建成功');
        });

        it('should provide feedback for failed operations with recovery suggestions', () => {
            const feedback = {
                operation: '复制节点',
                success: false,
                message: '复制失败',
                suggestedAction: 'retry'
            };
            
            feedbackManager.provideOperationFeedback(feedback);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('复制失败', '重试');
        });
    });

    describe('Internationalization Support', () => {
        it('should support localized error messages', () => {
            const error = CodePathError.userError('用户错误');
            
            // Test Chinese (default)
            expect(error.getLocalizedMessage('zh')).toContain('请检查您的输入');
            
            // Test English
            expect(error.getLocalizedMessage('en')).toContain('Please check your input');
        });

        it('should handle different error categories in both languages', () => {
            const clipboardError = CodePathError.clipboardError('剪贴板错误');
            const orderError = CodePathError.orderError('顺序错误');
            
            expect(clipboardError.getLocalizedMessage('zh')).toContain('剪贴板操作失败');
            expect(clipboardError.getLocalizedMessage('en')).toContain('Clipboard operation failed');
            
            expect(orderError.getLocalizedMessage('zh')).toContain('节点顺序操作失败');
            expect(orderError.getLocalizedMessage('en')).toContain('Node order operation failed');
        });
    });
});
