import * as vscode from 'vscode';
import { IErrorHandler } from '../interfaces/IErrorHandler';
import { CodePathError, RecoveryAction } from '../types/errors';

/**
 * Handles errors and provides user feedback with recovery options
 */
export class ErrorHandler implements IErrorHandler {
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CodePath');
    }

    /**
     * Handle a CodePath error with appropriate user feedback and recovery
     */
    async handleError(error: CodePathError): Promise<void> {
        // Log the error for debugging
        this.logError(error);

        // Show user-friendly message based on error category
        if (error.recoverable) {
            const recovered = await this.showErrorWithRecovery(error);
            if (!recovered) {
                this.showUserMessage(error.userMessage, 'error');
            }
        } else {
            this.showUserMessage(error.userMessage, 'error');
        }
    }

    /**
     * Show a message to the user
     */
    showUserMessage(message: string, type: 'info' | 'warning' | 'error'): void {
        switch (type) {
            case 'info':
                vscode.window.showInformationMessage(message);
                break;
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
        }
    }

    /**
     * Log an error for debugging purposes
     */
    logError(error: Error): void {
        const timestamp = new Date().toISOString();
        const errorInfo = error instanceof CodePathError 
            ? `[${error.category.toUpperCase()}] ${error.message}`
            : error.message;
        
        this.outputChannel.appendLine(`${timestamp}: ${errorInfo}`);
        
        if (error.stack) {
            this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
        }

        if (error instanceof CodePathError && error.originalError) {
            this.outputChannel.appendLine(`Original error: ${error.originalError.message}`);
            if (error.originalError.stack) {
                this.outputChannel.appendLine(`Original stack: ${error.originalError.stack}`);
            }
        }
    }

    /**
     * Show an error with recovery options
     */
    async showErrorWithRecovery(error: CodePathError): Promise<boolean> {
        const action = this.getRecoveryActionText(error.suggestedAction);
        
        if (action) {
            const selection = await vscode.window.showErrorMessage(
                error.userMessage,
                { modal: false },
                action,
                'Cancel'
            );

            if (selection && selection === action) {
                return await this.executeRecoveryAction(error.suggestedAction);
            }
        } else {
            this.showUserMessage(error.userMessage, 'error');
        }

        return false;
    }

    private getRecoveryActionText(action: RecoveryAction): string | null {
        switch (action) {
            case 'retry':
                return 'Retry';
            case 'selectText':
                return 'Select Text';
            case 'checkPermissions':
                return 'Check Permissions';
            case 'restoreBackup':
                return 'Restore Backup';
            case 'switchToTextView':
                return 'Switch to Text View';
            case 'reduceNodes':
                return 'Reduce Nodes';
            case 'none':
            default:
                return null;
        }
    }

    private async executeRecoveryAction(action: RecoveryAction): Promise<boolean> {
        try {
            switch (action) {
                case 'selectText':
                    this.showUserMessage('Please select code text first', 'info');
                    return true;

                case 'checkPermissions':
                    this.showUserMessage('Please check file permissions and workspace access', 'info');
                    return true;

                case 'switchToTextView':
                    // This would be handled by the PreviewManager
                    await vscode.commands.executeCommand('codepath.switchToTextView');
                    return true;

                case 'restoreBackup':
                    // This would be handled by the StorageManager
                    await vscode.commands.executeCommand('codepath.restoreFromBackup');
                    return true;

                case 'reduceNodes':
                    this.showUserMessage('Consider removing some nodes to improve performance', 'info');
                    return true;

                case 'retry':
                    // Let the caller handle retry logic
                    return false;

                case 'none':
                default:
                    return false;
            }
        } catch (recoveryError) {
            this.logError(recoveryError as Error);
            return false;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}