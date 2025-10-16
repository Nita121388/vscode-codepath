import * as vscode from 'vscode';
import { CodePathError } from '../types/errors';
import { UserFeedbackMessage, OperationFeedback, LogLevel, LogEntry } from '../types';

/**
 * Manages user feedback, error handling, and debug logging for the CodePath extension
 */
export class FeedbackManager {
    private outputChannel: vscode.OutputChannel;
    private logEntries: LogEntry[] = [];
    private readonly maxLogEntries = 1000;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CodePath Debug');
    }

    /**
     * Show success message to user
     */
    public showSuccess(message: string, details?: string, actionLabel?: string, action?: () => void): void {
        this.log('info', 'FeedbackManager', 'showSuccess', message, { details });
        
        if (actionLabel && action) {
            vscode.window.showInformationMessage(message, actionLabel).then(selection => {
                if (selection === actionLabel) {
                    action();
                }
            });
        } else {
            vscode.window.showInformationMessage(message);
        }
    }

    /**
     * Show information message to user
     */
    public showInfo(message: string, details?: string): void {
        this.log('info', 'FeedbackManager', 'showInfo', message, { details });
        vscode.window.showInformationMessage(message);
    }

    /**
     * Show warning message to user
     */
    public showWarning(message: string, details?: string, actionLabel?: string, action?: () => void): void {
        this.log('warn', 'FeedbackManager', 'showWarning', message, { details });
        
        if (actionLabel && action) {
            vscode.window.showWarningMessage(message, actionLabel).then(selection => {
                if (selection === actionLabel) {
                    action();
                }
            });
        } else {
            vscode.window.showWarningMessage(message);
        }
    }

    /**
     * Handle and display errors with recovery suggestions
     */
    public handleError(operation: string, error: any, component: string = 'Unknown'): void {
        let codePathError: CodePathError;
        
        if (error instanceof CodePathError) {
            codePathError = error;
        } else if (error instanceof Error) {
            codePathError = new CodePathError(error.message, 'user', {
                originalError: error,
                userMessage: `${operation}失败: ${error.message}`
            });
        } else {
            codePathError = new CodePathError('Unknown error', 'user', {
                userMessage: `${operation}失败: 未知错误`
            });
        }

        this.log('error', component, operation, codePathError.message, {
            category: codePathError.category,
            recoverable: codePathError.recoverable,
            suggestedAction: codePathError.suggestedAction,
            originalError: codePathError.originalError
        }, codePathError.originalError || new Error(codePathError.message));

        // Show error message with recovery action if available
        const recoveryActionLabel = this.getRecoveryActionLabel(codePathError.suggestedAction);
        
        if (recoveryActionLabel && codePathError.recoverable) {
            vscode.window.showErrorMessage(
                codePathError.userMessage,
                recoveryActionLabel,
                '查看详情'
            ).then(selection => {
                if (selection === recoveryActionLabel) {
                    this.executeRecoveryAction(codePathError.suggestedAction);
                } else if (selection === '查看详情') {
                    this.showErrorDetails(codePathError);
                }
            });
        } else {
            vscode.window.showErrorMessage(codePathError.userMessage, '查看详情').then(selection => {
                if (selection === '查看详情') {
                    this.showErrorDetails(codePathError);
                }
            });
        }
    }

    /**
     * Provide operation feedback
     */
    public provideOperationFeedback(feedback: OperationFeedback): void {
        this.log(
            feedback.success ? 'info' : 'error',
            'OperationFeedback',
            feedback.operation,
            feedback.message,
            {
                success: feedback.success,
                details: feedback.details,
                suggestedAction: feedback.suggestedAction,
                debugInfo: feedback.debugInfo
            }
        );

        if (feedback.success) {
            this.showSuccess(feedback.message, feedback.details);
        } else {
            const actionLabel = feedback.suggestedAction ? this.getRecoveryActionLabel(feedback.suggestedAction as any) : undefined;
            
            if (actionLabel) {
                vscode.window.showErrorMessage(feedback.message, actionLabel).then(selection => {
                    if (selection === actionLabel && feedback.suggestedAction) {
                        this.executeRecoveryAction(feedback.suggestedAction as any);
                    }
                });
            } else {
                vscode.window.showErrorMessage(feedback.message);
            }
        }
    }

    /**
     * Log debug information
     */
    public log(level: LogLevel, component: string, operation: string, message: string, data?: any, error?: Error): void {
        const logEntry: LogEntry = {
            level,
            timestamp: new Date(),
            component,
            operation,
            message,
            data,
            error
        };

        this.logEntries.push(logEntry);
        
        // Keep only the most recent entries
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(-this.maxLogEntries);
        }

        // Output to debug channel
        const timestamp = logEntry.timestamp.toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${operation}: ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        
        if (data) {
            this.outputChannel.appendLine(`  Data: ${JSON.stringify(data, null, 2)}`);
        }
        
        if (error) {
            this.outputChannel.appendLine(`  Error: ${error.message}`);
            if (error.stack) {
                this.outputChannel.appendLine(`  Stack: ${error.stack}`);
            }
        }

        // Also log to console for development
        const consoleMessage = `[CodePath] ${logMessage}`;
        switch (level) {
            case 'debug':
                console.debug(consoleMessage, data, error);
                break;
            case 'info':
                console.info(consoleMessage, data, error);
                break;
            case 'warn':
                console.warn(consoleMessage, data, error);
                break;
            case 'error':
                console.error(consoleMessage, data, error);
                break;
        }
    }

    /**
     * Get recovery action label for display
     */
    private getRecoveryActionLabel(action: string): string | undefined {
        switch (action) {
            case 'retry':
                return '重试';
            case 'selectText':
                return '选择文本';
            case 'checkPermissions':
                return '检查权限';
            case 'restoreBackup':
                return '恢复备份';
            case 'switchToTextView':
                return '切换到文本视图';
            case 'reduceNodes':
                return '减少节点';
            case 'clearClipboard':
                return '清空剪贴板';
            case 'refreshPreview':
                return '刷新预览';
            case 'reloadExtension':
                return '重新加载扩展';
            case 'checkConfiguration':
                return '检查配置';
            case 'contactSupport':
                return '联系支持';
            default:
                return undefined;
        }
    }

    /**
     * Execute recovery action
     */
    private executeRecoveryAction(action: string): void {
        this.log('info', 'FeedbackManager', 'executeRecoveryAction', `Executing recovery action: ${action}`);
        
        switch (action) {
            case 'retry':
                // The caller should handle retry logic
                vscode.window.showInformationMessage('请重试上一个操作');
                break;
            case 'selectText':
                vscode.window.showInformationMessage('请在编辑器中选择代码文本后重试');
                break;
            case 'checkPermissions':
                vscode.window.showInformationMessage('请检查文件权限并确保有足够的访问权限');
                break;
            case 'restoreBackup':
                vscode.commands.executeCommand('codepath.restoreBackup');
                break;
            case 'switchToTextView':
                vscode.commands.executeCommand('codepath.togglePreviewFormat');
                break;
            case 'reduceNodes':
                vscode.window.showInformationMessage('请考虑删除一些节点以提高性能');
                break;
            case 'clearClipboard':
                // Clear internal clipboard
                vscode.window.showInformationMessage('剪贴板已清空');
                break;
            case 'refreshPreview':
                vscode.commands.executeCommand('codepath.refreshPreview');
                break;
            case 'reloadExtension':
                vscode.commands.executeCommand('workbench.action.reloadWindow');
                break;
            case 'checkConfiguration':
                vscode.commands.executeCommand('workbench.action.openSettings', 'codepath');
                break;
            case 'contactSupport':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/issues'));
                break;
        }
    }

    /**
     * Show detailed error information
     */
    private showErrorDetails(error: CodePathError): void {
        const details = [
            `错误类型: ${error.category}`,
            `错误消息: ${error.message}`,
            `用户消息: ${error.userMessage}`,
            `可恢复: ${error.recoverable ? '是' : '否'}`,
            `建议操作: ${error.suggestedAction}`
        ];

        if (error.originalError) {
            details.push(`原始错误: ${error.originalError.message}`);
            if (error.originalError.stack) {
                details.push(`堆栈跟踪: ${error.originalError.stack}`);
            }
        }

        const detailsText = details.join('\n');
        
        // Show in output channel
        this.outputChannel.show();
        this.outputChannel.appendLine('\n=== 错误详情 ===');
        this.outputChannel.appendLine(detailsText);
        this.outputChannel.appendLine('=================\n');
    }

    /**
     * Get recent log entries for debugging
     */
    public getRecentLogs(count: number = 50): LogEntry[] {
        return this.logEntries.slice(-count);
    }

    /**
     * Clear all log entries
     */
    public clearLogs(): void {
        this.logEntries = [];
        this.outputChannel.clear();
        this.log('info', 'FeedbackManager', 'clearLogs', 'Log entries cleared');
    }

    /**
     * Export logs to file
     */
    public async exportLogs(): Promise<void> {
        try {
            const logs = this.logEntries.map(entry => ({
                timestamp: entry.timestamp.toISOString(),
                level: entry.level,
                component: entry.component,
                operation: entry.operation,
                message: entry.message,
                data: entry.data,
                error: entry.error ? {
                    message: entry.error.message,
                    stack: entry.error.stack
                } : undefined
            }));

            const logsJson = JSON.stringify(logs, null, 2);
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`codepath-logs-${Date.now()}.json`),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(logsJson, 'utf8'));
                this.showSuccess(`日志已导出到: ${uri.fsPath}`);
            }
        } catch (error) {
            this.handleError('导出日志', error, 'FeedbackManager');
        }
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}