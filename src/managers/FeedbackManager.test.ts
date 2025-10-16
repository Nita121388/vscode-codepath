import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { FeedbackManager } from './FeedbackManager';
import { CodePathError } from '../types/errors';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            show: vi.fn(),
            clear: vi.fn(),
            dispose: vi.fn()
        })),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showSaveDialog: vi.fn()
    },
    commands: {
        executeCommand: vi.fn()
    },
    workspace: {
        fs: {
            writeFile: vi.fn()
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path }))
    },
    env: {
        openExternal: vi.fn()
    }
}));

describe('FeedbackManager', () => {
    let feedbackManager: FeedbackManager;
    let mockOutputChannel: any;

    beforeEach(() => {
        mockOutputChannel = {
            appendLine: vi.fn(),
            show: vi.fn(),
            clear: vi.fn(),
            dispose: vi.fn()
        };
        
        vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel);
        feedbackManager = new FeedbackManager();
    });

    afterEach(() => {
        feedbackManager.dispose();
        vi.clearAllMocks();
    });

    describe('showSuccess', () => {
        it('should show success message', () => {
            feedbackManager.showSuccess('操作成功', '详细信息');
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('操作成功');
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });

        it('should show success message with action', async () => {
            const mockAction = vi.fn();
            vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('执行');
            
            feedbackManager.showSuccess('操作成功', '详细信息', '执行', mockAction);
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('操作成功', '执行');
        });
    });

    describe('showInfo', () => {
        it('should show info message', () => {
            feedbackManager.showInfo('信息消息', '详细信息');
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('信息消息');
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });
    });

    describe('showWarning', () => {
        it('should show warning message', () => {
            feedbackManager.showWarning('警告消息', '详细信息');
            
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('警告消息');
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });

        it('should show warning message with action', async () => {
            const mockAction = vi.fn();
            vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('执行');
            
            feedbackManager.showWarning('警告消息', '详细信息', '执行', mockAction);
            
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('警告消息', '执行');
        });
    });

    describe('handleError', () => {
        it('should handle CodePathError', () => {
            const error = CodePathError.userError('用户错误', '请检查输入');
            
            feedbackManager.handleError('测试操作', error, 'TestComponent');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                '请检查输入',
                '重试',
                '查看详情'
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });

        it('should handle regular Error', () => {
            const error = new Error('普通错误');
            
            feedbackManager.handleError('测试操作', error, 'TestComponent');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });

        it('should handle unknown error', () => {
            feedbackManager.handleError('测试操作', '字符串错误', 'TestComponent');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });
    });

    describe('provideOperationFeedback', () => {
        it('should handle successful operation feedback', () => {
            const feedback = {
                operation: '测试操作',
                success: true,
                message: '操作成功',
                details: '详细信息'
            };
            
            feedbackManager.provideOperationFeedback(feedback);
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('操作成功');
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });

        it('should handle failed operation feedback', () => {
            const feedback = {
                operation: '测试操作',
                success: false,
                message: '操作失败',
                suggestedAction: 'retry'
            };
            
            feedbackManager.provideOperationFeedback(feedback);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('操作失败', '重试');
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });
    });

    describe('log', () => {
        it('should log debug information', () => {
            feedbackManager.log('info', 'TestComponent', 'testOperation', '测试消息', { data: 'test' });
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[INFO] [TestComponent] testOperation: 测试消息')
            );
        });

        it('should log error with stack trace', () => {
            const error = new Error('测试错误');
            feedbackManager.log('error', 'TestComponent', 'testOperation', '错误消息', {}, error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR] [TestComponent] testOperation: 错误消息')
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Error: 测试错误')
            );
        });
    });

    describe('getRecentLogs', () => {
        it('should return recent log entries', () => {
            feedbackManager.log('info', 'TestComponent', 'testOperation1', '消息1');
            feedbackManager.log('info', 'TestComponent', 'testOperation2', '消息2');
            
            const logs = feedbackManager.getRecentLogs(2);
            
            expect(logs).toHaveLength(2);
            expect(logs[0].message).toBe('消息1');
            expect(logs[1].message).toBe('消息2');
        });

        it('should limit returned logs to requested count', () => {
            for (let i = 0; i < 10; i++) {
                feedbackManager.log('info', 'TestComponent', 'testOperation', `消息${i}`);
            }
            
            const logs = feedbackManager.getRecentLogs(5);
            
            expect(logs).toHaveLength(5);
            expect(logs[4].message).toBe('消息9'); // Most recent
        });
    });

    describe('clearLogs', () => {
        it('should clear all log entries', () => {
            feedbackManager.log('info', 'TestComponent', 'testOperation', '消息');
            
            feedbackManager.clearLogs();
            
            const logs = feedbackManager.getRecentLogs();
            expect(logs).toHaveLength(1); // Only the clear log entry
            expect(logs[0].message).toBe('Log entries cleared');
            expect(mockOutputChannel.clear).toHaveBeenCalled();
        });
    });

    describe('exportLogs', () => {
        it('should export logs to file', async () => {
            const mockUri = { fsPath: '/test/path/logs.json' };
            vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(mockUri as any);
            vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue();
            
            feedbackManager.log('info', 'TestComponent', 'testOperation', '测试消息');
            
            await feedbackManager.exportLogs();
            
            expect(vscode.window.showSaveDialog).toHaveBeenCalled();
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                mockUri,
                expect.any(Uint8Array)
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('日志已导出到')
            );
        });

        it('should handle export cancellation', async () => {
            vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(undefined);
            
            await feedbackManager.exportLogs();
            
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('should dispose output channel', () => {
            feedbackManager.dispose();
            
            expect(mockOutputChannel.dispose).toHaveBeenCalled();
        });
    });
});