import { describe, it, expect } from 'vitest';
import { CodePathError } from './errors';

describe('CodePathError', () => {
    describe('constructor', () => {
        it('should create error with basic properties', () => {
            const error = new CodePathError('Test message', 'user');
            
            expect(error.message).toBe('Test message');
            expect(error.category).toBe('user');
            expect(error.recoverable).toBe(true);
            expect(error.name).toBe('CodePathError');
        });

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

        it('should use default user message for each category', () => {
            const userError = new CodePathError('Test', 'user');
            const filesystemError = new CodePathError('Test', 'filesystem');
            const validationError = new CodePathError('Test', 'validation');
            const renderingError = new CodePathError('Test', 'rendering');
            const performanceError = new CodePathError('Test', 'performance');
            
            expect(userError.userMessage).toBe('Please check your input and try again.');
            expect(filesystemError.userMessage).toBe('File operation failed. Please check permissions and try again.');
            expect(validationError.userMessage).toBe('Data validation failed. The operation cannot be completed.');
            expect(renderingError.userMessage).toBe('Preview rendering failed. Switching to text view.');
            expect(performanceError.userMessage).toBe('Performance limit reached. Consider reducing the graph size.');
        });

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

    describe('static factory methods', () => {
        it('should create user error', () => {
            const error = CodePathError.userError('No text selected');
            
            expect(error.category).toBe('user');
            expect(error.message).toBe('No text selected');
            expect(error.recoverable).toBe(true);
        });

        it('should create user error with custom message and action', () => {
            const error = CodePathError.userError(
                'Invalid selection', 
                'Please select valid code text', 
                'selectText'
            );
            
            expect(error.userMessage).toBe('Please select valid code text');
            expect(error.suggestedAction).toBe('selectText');
        });

        it('should create filesystem error', () => {
            const originalError = new Error('ENOENT');
            const error = CodePathError.filesystemError('File not found', originalError);
            
            expect(error.category).toBe('filesystem');
            expect(error.originalError).toBe(originalError);
            expect(error.recoverable).toBe(true);
        });

        it('should create validation error', () => {
            const error = CodePathError.validationError('Invalid node data', 'Node validation failed', false);
            
            expect(error.category).toBe('validation');
            expect(error.userMessage).toBe('Node validation failed');
            expect(error.recoverable).toBe(false);
            expect(error.suggestedAction).toBe('none');
        });

        it('should create recoverable validation error', () => {
            const error = CodePathError.validationError('Invalid node data', 'Node validation failed', true);
            
            expect(error.recoverable).toBe(true);
            expect(error.suggestedAction).toBe('retry');
        });

        it('should create rendering error', () => {
            const originalError = new Error('Mermaid syntax error');
            const error = CodePathError.renderingError('Rendering failed', originalError);
            
            expect(error.category).toBe('rendering');
            expect(error.originalError).toBe(originalError);
            expect(error.userMessage).toBe('Preview rendering failed. Switching to text view.');
            expect(error.suggestedAction).toBe('switchToTextView');
        });

        it('should create performance error', () => {
            const error = CodePathError.performanceError('Too many nodes');
            
            expect(error.category).toBe('performance');
            expect(error.userMessage).toBe('Performance limit reached. Consider reducing the graph size.');
            expect(error.suggestedAction).toBe('reduceNodes');
        });

        it('should create performance error with custom message', () => {
            const error = CodePathError.performanceError('Memory limit exceeded', 'Graph is too large for memory');
            
            expect(error.userMessage).toBe('Graph is too large for memory');
        });

        it('should create clipboard error', () => {
            const error = CodePathError.clipboardError('Copy operation failed');
            
            expect(error.category).toBe('clipboard');
            expect(error.message).toBe('剪贴板操作失败: Copy operation failed');
            expect(error.userMessage).toBe('Clipboard operation failed. Please try again.');
            expect(error.suggestedAction).toBe('clearClipboard');
        });

        it('should create clipboard error with custom message', () => {
            const error = CodePathError.clipboardError('Paste failed', 'Custom clipboard message');
            
            expect(error.userMessage).toBe('Custom clipboard message');
        });

        it('should create order error', () => {
            const error = CodePathError.orderError('Move up failed');
            
            expect(error.category).toBe('order');
            expect(error.message).toBe('节点顺序操作失败: Move up failed');
            expect(error.userMessage).toBe('Node order operation failed. Please check node position and try again.');
            expect(error.suggestedAction).toBe('refreshPreview');
        });

        it('should create order error with custom message', () => {
            const error = CodePathError.orderError('Move down failed', 'Custom order message');
            
            expect(error.userMessage).toBe('Custom order message');
        });

        it('should create menu error', () => {
            const error = CodePathError.menuError('Context menu failed');
            
            expect(error.category).toBe('menu');
            expect(error.message).toBe('菜单操作失败: Context menu failed');
            expect(error.userMessage).toBe('Menu operation failed. Please try again or refresh the interface.');
            expect(error.suggestedAction).toBe('refreshPreview');
        });

        it('should create menu error with custom message', () => {
            const error = CodePathError.menuError('Menu display failed', 'Custom menu message');
            
            expect(error.userMessage).toBe('Custom menu message');
        });
    });

    describe('error inheritance', () => {
        it('should be instance of Error', () => {
            const error = new CodePathError('Test', 'user');
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(CodePathError);
        });

        it('should have proper stack trace', () => {
            const error = new CodePathError('Test', 'user');
            
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('CodePathError');
        });
    });
});