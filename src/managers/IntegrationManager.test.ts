import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IntegrationManager } from './IntegrationManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { PreviewManager } from './PreviewManager';
import { WebviewManager } from './WebviewManager';
import { StatusBarManager } from './StatusBarManager';
import { ConfigurationManager } from './ConfigurationManager';
import { Graph, Node } from '../types';
import { CodePathError } from '../types/errors';

// Mock VS Code
vi.mock('vscode', () => import('../__mocks__/vscode'));

// Mock all manager dependencies
vi.mock('./GraphManager');
vi.mock('./NodeManager');
vi.mock('./PreviewManager');
vi.mock('./WebviewManager');
vi.mock('./StatusBarManager');
vi.mock('./ConfigurationManager');

describe('IntegrationManager - createBroNodeWorkflow', () => {
    let integrationManager: IntegrationManager;
    let mockGraphManager: vi.Mocked<GraphManager>;
    let mockNodeManager: vi.Mocked<NodeManager>;
    let mockPreviewManager: vi.Mocked<PreviewManager>;
    let mockWebviewManager: vi.Mocked<WebviewManager>;
    let mockStatusBarManager: vi.Mocked<StatusBarManager>;
    let mockConfigManager: vi.Mocked<ConfigurationManager>;
    let mockContext: any;

    // Test data
    const testNode: Node = {
        id: 'test-node-1',
        name: 'Test Node',
        filePath: '/test/file.ts',
        lineNumber: 10,
        codeSnippet: 'console.log("test");',
        createdAt: new Date(),
        parentId: null,
        childIds: []
    };

    const testBroNode: Node = {
        id: 'bro-node-1',
        name: 'Bro Node',
        filePath: '/test/bro.ts',
        lineNumber: 15,
        codeSnippet: 'console.log("bro");',
        createdAt: new Date(),
        parentId: null,
        childIds: []
    };

    beforeEach(() => {
        // Create mocked instances
        mockGraphManager = vi.mocked(new GraphManager({} as any));
        mockNodeManager = vi.mocked(new NodeManager({} as any));
        mockPreviewManager = vi.mocked(new PreviewManager({} as any, {} as any));
        mockWebviewManager = vi.mocked(new WebviewManager({} as any));
        mockStatusBarManager = vi.mocked(new StatusBarManager());
        mockConfigManager = vi.mocked(new ConfigurationManager());
        mockContext = {
            subscriptions: [],
            extensionPath: '/test/extension'
        };

        // Setup default mock implementations
        mockNodeManager.getCurrentNode.mockReturnValue(testNode);
        mockNodeManager.createBroNode.mockResolvedValue(testBroNode);
        mockNodeManager.setCurrentNode.mockResolvedValue();
        mockWebviewManager.isVisible.mockReturnValue(false);
        mockWebviewManager.showPreview.mockResolvedValue();
        mockPreviewManager.forceUpdate.mockResolvedValue();
        mockPreviewManager.getStatus.mockReturnValue({
            isUpdating: false,
            lastUpdate: new Date(),
            error: null
        });
        
        // Mock ConfigurationManager
        mockConfigManager.getConfiguration.mockReturnValue({
            autoSave: false,
            autoSaveInterval: 5000,
            previewFormat: 'text',
            enableLocationTracking: true,
            enableValidation: true
        });
        
        // Mock StatusBarManager methods
        mockStatusBarManager.updateGraphInfo.mockImplementation(() => {});
        mockStatusBarManager.updateCurrentNode.mockImplementation(() => {});
        mockStatusBarManager.updatePreviewStatus.mockImplementation(() => {});
        mockStatusBarManager.show.mockImplementation(() => {});
        
        // Mock GraphManager methods
        mockGraphManager.getCurrentGraph.mockReturnValue(null);

        // Create IntegrationManager instance
        integrationManager = new IntegrationManager(
            mockGraphManager,
            mockNodeManager,
            mockPreviewManager,
            mockWebviewManager,
            mockStatusBarManager,
            mockConfigManager,
            mockContext
        );

        // Mock the private methods that are called by createBroNodeWorkflow
        vi.spyOn(integrationManager as any, 'updateAllComponents').mockResolvedValue();
        vi.spyOn(integrationManager as any, 'ensurePreviewVisible').mockResolvedValue();
        
        // Mock debouncedSave property
        Object.defineProperty(integrationManager, 'debouncedSave', {
            value: vi.fn(),
            writable: true,
            configurable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('successful workflow execution', () => {
        it('should execute complete bro node creation workflow successfully', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act
            const result = await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(result).toBe(testBroNode);
            expect(mockNodeManager.getCurrentNode).toHaveBeenCalled();
            expect(mockNodeManager.createBroNode).toHaveBeenCalledWith(selectedText, filePath, lineNumber);
            expect(mockNodeManager.setCurrentNode).toHaveBeenCalledWith(testBroNode.id);
        });

        it('should trim selected text before creating bro node', async () => {
            // Arrange
            const selectedText = '  console.log("bro");  ';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(mockNodeManager.createBroNode).toHaveBeenCalledWith('console.log("bro");', filePath, lineNumber);
        });

        it('should display success message with node name', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const mockShowInformationMessage = vi.fn();
            
            // Mock vscode.window.showInformationMessage
            const vscode = await import('vscode');
            vscode.window.showInformationMessage = mockShowInformationMessage;

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(mockShowInformationMessage).toHaveBeenCalledWith(`已标记为兄弟节点: ${testBroNode.name}`);
        });
    });

    describe('component updates', () => {
        it('should update all components after creating bro node', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const updateAllComponentsSpy = vi.spyOn(integrationManager as any, 'updateAllComponents');

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(updateAllComponentsSpy).toHaveBeenCalled();
        });

        it('should set new node as current node', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(mockNodeManager.setCurrentNode).toHaveBeenCalledWith(testBroNode.id);
        });

        it('should ensure preview panel is visible', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const ensurePreviewVisibleSpy = vi.spyOn(integrationManager as any, 'ensurePreviewVisible');

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(ensurePreviewVisibleSpy).toHaveBeenCalled();
        });

        it('should trigger auto-save when debouncedSave is available', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const mockDebouncedSave = vi.fn();
            (integrationManager as any).debouncedSave = mockDebouncedSave;

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(mockDebouncedSave).toHaveBeenCalled();
        });

        it('should not fail when debouncedSave is not available', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            (integrationManager as any).debouncedSave = undefined;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .resolves.toBe(testBroNode);
        });
    });

    describe('preview panel auto-open', () => {
        it('should auto-open preview panel when not visible', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            mockWebviewManager.isVisible.mockReturnValue(false);
            const ensurePreviewVisibleSpy = vi.spyOn(integrationManager as any, 'ensurePreviewVisible');

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(ensurePreviewVisibleSpy).toHaveBeenCalled();
        });

        it('should handle preview panel opening gracefully', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            
            // Mock ensurePreviewVisible to simulate successful opening
            vi.spyOn(integrationManager as any, 'ensurePreviewVisible').mockResolvedValue();

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .resolves.toBe(testBroNode);
        });

        it('should continue workflow even if preview panel fails to open', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            
            // Mock ensurePreviewVisible to throw error
            vi.spyOn(integrationManager as any, 'ensurePreviewVisible').mockRejectedValue(new Error('Preview failed'));

            // Act & Assert - Should still complete successfully
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Preview failed');
        });
    });

    describe('error handling - no current node', () => {
        it('should throw error when no current node exists', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            mockNodeManager.getCurrentNode.mockReturnValue(null);

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('没有选择当前节点。请先创建或选择一个节点。');
        });

        it('should display error message when no current node exists', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            mockNodeManager.getCurrentNode.mockReturnValue(null);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act
            try {
                await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);
            } catch (error) {
                // Expected to throw
            }

            // Assert
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: 没有选择当前节点。请先创建或选择一个节点。');
        });
    });

    describe('error handling - no selected text', () => {
        it('should throw error when selected text is empty', async () => {
            // Arrange
            const selectedText = '';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('请先选择代码文本');
        });

        it('should throw error when selected text is whitespace only', async () => {
            // Arrange
            const selectedText = '   \n\t  ';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('请先选择代码文本');
        });

        it('should throw error when selected text is null', async () => {
            // Arrange
            const selectedText = null as any;
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('请先选择代码文本');
        });

        it('should throw error when selected text is undefined', async () => {
            // Arrange
            const selectedText = undefined as any;
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('请先选择代码文本');
        });

        it('should display error message when no text is selected', async () => {
            // Arrange
            const selectedText = '';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act
            try {
                await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);
            } catch (error) {
                // Expected to throw
            }

            // Assert
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: 请先选择代码文本');
        });
    });

    describe('error handling - node creation failures', () => {
        it('should handle NodeManager.createBroNode failure', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const error = new Error('Failed to create bro node');
            mockNodeManager.createBroNode.mockRejectedValue(error);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Failed to create bro node');
            
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: Failed to create bro node');
        });

        it('should handle setCurrentNode failure', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const error = new Error('Failed to set current node');
            mockNodeManager.setCurrentNode.mockRejectedValue(error);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Failed to set current node');
            
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: Failed to set current node');
        });

        it('should handle updateAllComponents failure', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const error = new Error('Failed to update components');
            vi.spyOn(integrationManager as any, 'updateAllComponents').mockRejectedValue(error);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Failed to update components');
            
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: Failed to update components');
        });

        it('should handle CodePathError with proper message', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const error = CodePathError.userError('Custom user error');
            mockNodeManager.createBroNode.mockRejectedValue(error);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Custom user error');
            
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: Custom user error');
        });

        it('should handle unknown error types', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const error = 'String error';
            mockNodeManager.createBroNode.mockRejectedValue(error);
            const mockShowErrorMessage = vi.fn();
            
            // Mock vscode.window.showErrorMessage
            const vscode = await import('vscode');
            vscode.window.showErrorMessage = mockShowErrorMessage;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toBe('String error');
            
            expect(mockShowErrorMessage).toHaveBeenCalledWith('创建兄弟节点失败: Unknown error');
        });
    });

    describe('auto-save trigger', () => {
        it('should trigger auto-save after successful bro node creation', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const mockDebouncedSave = vi.fn();
            (integrationManager as any).debouncedSave = mockDebouncedSave;

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(mockDebouncedSave).toHaveBeenCalled();
        });

        it('should not fail when auto-save is not configured', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            (integrationManager as any).debouncedSave = null;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .resolves.toBe(testBroNode);
        });

        it('should not trigger auto-save when bro node creation fails', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const mockDebouncedSave = vi.fn();
            (integrationManager as any).debouncedSave = mockDebouncedSave;
            mockNodeManager.createBroNode.mockRejectedValue(new Error('Creation failed'));

            // Act
            try {
                await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);
            } catch (error) {
                // Expected to throw
            }

            // Assert
            expect(mockDebouncedSave).not.toHaveBeenCalled();
        });
    });

    describe('workflow integration', () => {
        it('should execute all workflow steps in correct order', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            const callOrder: string[] = [];

            // Mock methods to track call order
            mockNodeManager.getCurrentNode.mockImplementation(() => {
                callOrder.push('getCurrentNode');
                return testNode;
            });
            mockNodeManager.createBroNode.mockImplementation(async () => {
                callOrder.push('createBroNode');
                return testBroNode;
            });
            mockNodeManager.setCurrentNode.mockImplementation(async () => {
                callOrder.push('setCurrentNode');
            });
            vi.spyOn(integrationManager as any, 'updateAllComponents').mockImplementation(async () => {
                callOrder.push('updateAllComponents');
            });
            vi.spyOn(integrationManager as any, 'ensurePreviewVisible').mockImplementation(async () => {
                callOrder.push('ensurePreviewVisible');
            });

            // Act
            await integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(callOrder).toEqual([
                'getCurrentNode',
                'createBroNode',
                'setCurrentNode',
                'updateAllComponents',
                'ensurePreviewVisible'
            ]);
        });

        it('should not proceed with workflow if validation fails early', async () => {
            // Arrange
            const selectedText = '';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('请先选择代码文本');

            // Verify that node creation was not attempted
            expect(mockNodeManager.createBroNode).not.toHaveBeenCalled();
            expect(mockNodeManager.setCurrentNode).not.toHaveBeenCalled();
        });

        it('should handle partial workflow failure gracefully', async () => {
            // Arrange
            const selectedText = 'console.log("bro");';
            const filePath = '/test/bro.ts';
            const lineNumber = 15;
            
            // Make updateAllComponents fail
            vi.spyOn(integrationManager as any, 'updateAllComponents').mockRejectedValue(new Error('Update failed'));

            // Act & Assert
            await expect(integrationManager.createBroNodeWorkflow(selectedText, filePath, lineNumber))
                .rejects.toThrow('Update failed');

            // Verify that node was created and set as current before failure
            expect(mockNodeManager.createBroNode).toHaveBeenCalled();
            expect(mockNodeManager.setCurrentNode).toHaveBeenCalled();
        });
    });
});