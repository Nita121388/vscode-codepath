import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { ErrorHandler } from './ErrorHandler';
import { CodePathError } from '../types/errors';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            dispose: vi.fn()
        })),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn()
    },
    commands: {
        executeCommand: vi.fn()
    }
}));

// Create mock message items - VS Code showErrorMessage returns the selected string directly
const createMockMessageItem = (title: string) => title;

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;
    let mockOutputChannel: any;

    beforeEach(() => {
        mockOutputChannel = {
            appendLine: vi.fn(),
            dispose: vi.fn()
        };
        
        vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel);
        
        errorHandler = new ErrorHandler();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create output channel', () => {
            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('CodePath');
        });
    });

    describe('showUserMessage', () => {
        it('should show info message', () => {
            errorHandler.showUserMessage('Test info', 'info');
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Test info');
        });

        it('should show warning message', () => {
            errorHandler.showUserMessage('Test warning', 'warning');
            
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Test warning');
        });

        it('should show error message', () => {
            errorHandler.showUserMessage('Test error', 'error');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Test error');
        });
    });

    describe('logError', () => {
        it('should log basic error', () => {
            const error = new Error('Test error');
            error.stack = 'Error stack trace';
            
            errorHandler.logError(error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z: Test error/)
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Stack trace: Error stack trace');
        });

        it('should log CodePathError with category', () => {
            const error = CodePathError.userError('User error');
            
            errorHandler.logError(error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[USER\] User error/)
            );
        });

        it('should log CodePathError with original error', () => {
            const originalError = new Error('Original error');
            originalError.stack = 'Original stack';
            const error = CodePathError.filesystemError('File error', originalError);
            
            errorHandler.logError(error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Original error: Original error');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Original stack: Original stack');
        });
    });

    describe('handleError', () => {
        it('should handle recoverable error', async () => {
            const error = CodePathError.userError('Test error');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Select Text'));
            
            await errorHandler.handleError(error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle non-recoverable error', async () => {
            const error = CodePathError.validationError('Validation failed', 'Cannot recover', false);
            
            await errorHandler.handleError(error);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Cannot recover');
        });
    });

    describe('showErrorWithRecovery', () => {
        it('should show error with recovery action', async () => {
            const error = CodePathError.userError('Test error', 'Test error', 'selectText');
            const selectTextItem = createMockMessageItem('Select Text');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(selectTextItem);
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                error.userMessage,
                { modal: false },
                'Select Text',
                'Cancel'
            );
            expect(result).toBe(true);
        });

        it('should handle cancel selection', async () => {
            const error = CodePathError.userError('Test error');
            const cancelItem = createMockMessageItem('Cancel');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(cancelItem);
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(false);
        });

        it('should handle error with no recovery action', async () => {
            const error = CodePathError.validationError('Test error', 'Test message', false);
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Test message');
            expect(result).toBe(false);
        });
    });

    describe('recovery actions', () => {
        it('should execute selectText recovery', async () => {
            const error = CodePathError.userError('Test error', 'Test error', 'selectText');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Select Text'));
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(true);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Please select code text first');
        });

        it('should execute checkPermissions recovery', async () => {
            const error = CodePathError.filesystemError('File error', 'File error', 'checkPermissions');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Check Permissions'));
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(true);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Please check file permissions and workspace access'
            );
        });

        it('should execute switchToTextView recovery', async () => {
            const error = CodePathError.renderingError('Render error', 'Render error', 'switchToTextView');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Switch to Text View'));
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(true);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.switchToTextView');
        });

        it('should execute restoreBackup recovery', async () => {
            const error = new CodePathError('Test', 'filesystem', { suggestedAction: 'restoreBackup' });
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Restore Backup'));
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(true);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.restoreFromBackup');
        });

        it('should execute reduceNodes recovery', async () => {
            const error = CodePathError.performanceError('Too many nodes', 'Too many nodes', 'reduceNodes');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Reduce Nodes'));
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(true);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Consider removing some nodes to improve performance'
            );
        });

        it('should handle retry recovery', async () => {
            const error = new CodePathError('Test', 'validation', { suggestedAction: 'retry' });
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Retry'));
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(false); // Retry should return false to let caller handle
        });
    });

    describe('dispose', () => {
        it('should dispose output channel', () => {
            errorHandler.dispose();
            
            expect(mockOutputChannel.dispose).toHaveBeenCalled();
        });
    });

    describe('error handling in recovery actions', () => {
        it('should handle errors in recovery action execution', async () => {
            const error = CodePathError.renderingError('Render error', 'Render error', 'switchToTextView');
            vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(createMockMessageItem('Switch to Text View'));
            vi.mocked(vscode.commands.executeCommand).mockRejectedValue(new Error('Command failed'));
            
            const result = await errorHandler.showErrorWithRecovery(error);
            
            expect(result).toBe(false);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Command failed')
            );
        });
    });
});