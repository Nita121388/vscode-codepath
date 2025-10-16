import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationManager } from './IntegrationManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { PreviewManager } from './PreviewManager';
import { WebviewManager } from './WebviewManager';
import { StatusBarManager } from './StatusBarManager';
import { ConfigurationManager } from './ConfigurationManager';
import { ClipboardManager } from './ClipboardManager';
import { NodeOrderManager } from './NodeOrderManager';
import { Node, Graph } from '../types';
import { CodePathError } from '../types/errors';

// Mock VS Code
vi.mock('vscode', () => import('../__mocks__/vscode'));

// Mock fs module for file context tests
vi.mock('fs', () => ({
    promises: {
        stat: vi.fn(),
    },
}));

// Mock path module
vi.mock('path', () => ({
    basename: vi.fn((path: string) => path.split('/').pop() || path.split('\\').pop() || path),
}));

describe('IntegrationManager - New Workflows', () => {
    let integrationManager: IntegrationManager;
    let mockGraphManager: GraphManager;
    let mockNodeManager: NodeManager;
    let mockPreviewManager: PreviewManager;
    let mockWebviewManager: WebviewManager;
    let mockStatusBarManager: StatusBarManager;
    let mockConfigManager: ConfigurationManager;
    let mockContext: any;
    let mockShowInformationMessage: any;
    let mockShowErrorMessage: any;
    let mockExecuteCommand: any;

    const testNode: Node = {
        id: 'test-node-1',
        name: 'Test Node',
        filePath: '/test/file.ts',
        fileName: 'file.ts',
        lineNumber: 10,
        codeSnippet: 'const test = "value";',
        codeHash: 'hash123',
        createdAt: new Date(),
        parentId: null,
        childIds: [],
    };

    const testGraph: Graph = {
        id: 'test-graph',
        name: 'Test Graph',
        nodes: new Map([['test-node-1', testNode]]),
        rootNodes: ['test-node-1'],
        currentNodeId: 'test-node-1',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Get mock functions from vscode module
        const vscode = await import('vscode');
        mockShowInformationMessage = vscode.window.showInformationMessage;
        mockShowErrorMessage = vscode.window.showErrorMessage;
        mockExecuteCommand = vscode.commands.executeCommand;

        // Create mock managers
        mockGraphManager = {
            getCurrentGraph: vi.fn().mockReturnValue(testGraph),
            saveGraph: vi.fn(),
        } as any;

        mockNodeManager = {
            getCurrentNode: vi.fn().mockReturnValue(testNode),
            setCurrentNode: vi.fn(),
            createNode: vi.fn(),
            createChildNode: vi.fn(),
            createParentNode: vi.fn(),
            createBroNode: vi.fn(),
            updateNode: vi.fn(),
            deleteNodeWithChildren: vi.fn(),
            dispose: vi.fn(),
        } as any;

        mockPreviewManager = {
            setGraph: vi.fn(),
            forceUpdate: vi.fn(),
            getStatus: vi.fn().mockReturnValue({ format: 'mermaid', isUpdating: false }),
            onUpdate: vi.fn(),
            onError: vi.fn(),
            toggleFormat: vi.fn().mockReturnValue('mermaid'),
        } as any;

        mockWebviewManager = {
            showPreview: vi.fn(),
            isVisible: vi.fn().mockReturnValue(true),
            updateContent: vi.fn(),
            setFormatToggleCallback: vi.fn(),
            setRefreshCallback: vi.fn(),
            setGetNodeByLocationCallback: vi.fn(),
            setNodeManager: vi.fn(),
            setGetCurrentGraphCallback: vi.fn(),
            setForcePreviewUpdateCallback: vi.fn(),
            setNodeSwitchCallback: vi.fn(),
            setDeleteCurrentNodeCallback: vi.fn(),
            setDeleteCurrentNodeWithChildrenCallback: vi.fn(),
            setExportGraphCallback: vi.fn(),
            setUpdateCurrentNodeCallback: vi.fn(),
        } as any;

        mockStatusBarManager = {
            updateGraphInfo: vi.fn(),
            updateCurrentNode: vi.fn(),
            updatePreviewStatus: vi.fn(),
            show: vi.fn(),
        } as any;

        mockConfigManager = {
            getConfiguration: vi.fn().mockReturnValue({ autoSave: false }),
        } as any;

        mockContext = {
            subscriptions: [],
        };

        // Create integration manager
        integrationManager = new IntegrationManager(
            mockGraphManager,
            mockNodeManager,
            mockPreviewManager,
            mockWebviewManager,
            mockStatusBarManager,
            mockConfigManager,
            mockContext
        );
    });

    describe('Clipboard Workflows', () => {
        describe('copyNodeWorkflow', () => {
            it('should copy current node successfully', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                const copyNodeSpy = vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue();

                // Act
                await integrationManager.copyNodeWorkflow();

                // Assert
                expect(copyNodeSpy).toHaveBeenCalledWith('test-node-1');
                expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'codepath.hasClipboardNode', expect.any(Boolean));
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已复制该节点及其子节点');
            });

            it('should copy specified node successfully', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                const copyNodeSpy = vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue();

                // Act
                await integrationManager.copyNodeWorkflow('custom-node-id');

                // Assert
                expect(copyNodeSpy).toHaveBeenCalledWith('custom-node-id');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已复制该节点及其子节点');
            });

            it('should throw error when no current node exists', async () => {
                // Arrange
                mockNodeManager.getCurrentNode.mockReturnValue(null);

                // Act & Assert
                await expect(integrationManager.copyNodeWorkflow()).rejects.toThrow('没有选择当前节点');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('复制节点失败: 没有选择当前节点。请先创建或选择一个节点。');
            });

            it('should handle clipboard manager errors', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                vi.spyOn(clipboardManager, 'copyNode').mockRejectedValue(new Error('Copy failed'));

                // Act & Assert
                await expect(integrationManager.copyNodeWorkflow()).rejects.toThrow('Copy failed');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('复制节点失败: Copy failed');
            });
        });

        describe('cutNodeWorkflow', () => {
            it('should cut current node successfully', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                const cutNodeSpy = vi.spyOn(clipboardManager, 'cutNode').mockResolvedValue();

                // Act
                await integrationManager.cutNodeWorkflow();

                // Assert
                expect(cutNodeSpy).toHaveBeenCalledWith('test-node-1');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已剪切该节点及其子节点');
            });

            it('should cut specified node successfully', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                const cutNodeSpy = vi.spyOn(clipboardManager, 'cutNode').mockResolvedValue();

                // Act
                await integrationManager.cutNodeWorkflow('custom-node-id');

                // Assert
                expect(cutNodeSpy).toHaveBeenCalledWith('custom-node-id');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已剪切该节点及其子节点');
            });

            it('should throw error when no current node exists', async () => {
                // Arrange
                mockNodeManager.getCurrentNode.mockReturnValue(null);

                // Act & Assert
                await expect(integrationManager.cutNodeWorkflow()).rejects.toThrow('没有选择当前节点');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('剪切节点失败: 没有选择当前节点。请先创建或选择一个节点。');
            });
        });

        describe('pasteNodeWorkflow', () => {
            const pastedNodes = [
                { ...testNode, id: 'pasted-node-1', name: 'Pasted Node 1' },
                { ...testNode, id: 'pasted-node-2', name: 'Pasted Node 2', parentId: 'pasted-node-1' },
            ];

            it('should paste nodes successfully', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                vi.spyOn(clipboardManager, 'hasClipboardData').mockReturnValue(true);
                vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue(pastedNodes);

                // Act
                await integrationManager.pasteNodeWorkflow();

                // Assert
                expect(clipboardManager.pasteNode).toHaveBeenCalledWith('test-node-1');
                expect(mockNodeManager.setCurrentNode).toHaveBeenCalledWith('pasted-node-1');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已粘贴 1 个节点树（共 2 个节点）');
            });

            it('should paste to specified parent', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                vi.spyOn(clipboardManager, 'hasClipboardData').mockReturnValue(true);
                vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue(pastedNodes);

                // Act
                await integrationManager.pasteNodeWorkflow('custom-parent-id');

                // Assert
                expect(clipboardManager.pasteNode).toHaveBeenCalledWith('custom-parent-id');
            });

            it('should throw error when clipboard is empty', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                vi.spyOn(clipboardManager, 'hasClipboardData').mockReturnValue(false);

                // Act & Assert
                await expect(integrationManager.pasteNodeWorkflow()).rejects.toThrow('剪贴板为空');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('粘贴节点失败: 剪贴板为空。请先复制或剪切一个节点。');
            });

            it('should handle empty paste result', async () => {
                // Arrange
                const clipboardManager = integrationManager.getClipboardManager();
                vi.spyOn(clipboardManager, 'hasClipboardData').mockReturnValue(true);
                vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue([]);

                // Act
                await integrationManager.pasteNodeWorkflow();

                // Assert
                expect(mockNodeManager.setCurrentNode).not.toHaveBeenCalled();
                expect(mockShowInformationMessage).toHaveBeenCalledWith('已粘贴 0 个节点树（共 0 个节点）');
            });
        });
    });

    describe('Node Order Workflows', () => {
        describe('moveNodeUpWorkflow', () => {
            it('should move node up successfully', async () => {
                // Arrange
                const nodeOrderManager = integrationManager.getNodeOrderManager();
                vi.spyOn(nodeOrderManager, 'moveNodeUp').mockResolvedValue(true);

                // Act
                await integrationManager.moveNodeUpWorkflow();

                // Assert
                expect(nodeOrderManager.moveNodeUp).toHaveBeenCalledWith('test-node-1');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('节点已上移');
            });

            it('should handle node already at top', async () => {
                // Arrange
                const nodeOrderManager = integrationManager.getNodeOrderManager();
                vi.spyOn(nodeOrderManager, 'moveNodeUp').mockResolvedValue(false);

                // Act
                await integrationManager.moveNodeUpWorkflow();

                // Assert
                expect(mockShowInformationMessage).toHaveBeenCalledWith('节点已在最上方');
            });

            it('should move specified node up', async () => {
                // Arrange
                const nodeOrderManager = integrationManager.getNodeOrderManager();
                vi.spyOn(nodeOrderManager, 'moveNodeUp').mockResolvedValue(true);

                // Act
                await integrationManager.moveNodeUpWorkflow('custom-node-id');

                // Assert
                expect(nodeOrderManager.moveNodeUp).toHaveBeenCalledWith('custom-node-id');
            });

            it('should throw error when no current node exists', async () => {
                // Arrange
                mockNodeManager.getCurrentNode.mockReturnValue(null);

                // Act & Assert
                await expect(integrationManager.moveNodeUpWorkflow()).rejects.toThrow('没有选择当前节点');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('移动节点失败: 没有选择当前节点。请先创建或选择一个节点。');
            });
        });

        describe('moveNodeDownWorkflow', () => {
            it('should move node down successfully', async () => {
                // Arrange
                const nodeOrderManager = integrationManager.getNodeOrderManager();
                vi.spyOn(nodeOrderManager, 'moveNodeDown').mockResolvedValue(true);

                // Act
                await integrationManager.moveNodeDownWorkflow();

                // Assert
                expect(nodeOrderManager.moveNodeDown).toHaveBeenCalledWith('test-node-1');
                expect(mockShowInformationMessage).toHaveBeenCalledWith('节点已下移');
            });

            it('should handle node already at bottom', async () => {
                // Arrange
                const nodeOrderManager = integrationManager.getNodeOrderManager();
                vi.spyOn(nodeOrderManager, 'moveNodeDown').mockResolvedValue(false);

                // Act
                await integrationManager.moveNodeDownWorkflow();

                // Assert
                expect(mockShowInformationMessage).toHaveBeenCalledWith('节点已在最下方');
            });
        });
    });

    describe('File Context Workflows', () => {
        describe('createNodeFromFileContextWorkflow', () => {
            const mockUri = { fsPath: '/test/example.ts' } as any;
            const mockStats = { isDirectory: () => false };

            beforeEach(() => {
                const fs = require('fs');
                fs.promises.stat.mockResolvedValue(mockStats);
                
                const path = require('path');
                path.basename.mockReturnValue('example.ts');
            });

            it('should create new node from file context', async () => {
                // Arrange
                const createdNode = { ...testNode, name: 'example.ts' };
                vi.spyOn(integrationManager, 'createNodeWorkflow').mockResolvedValue(createdNode);

                // Act
                const result = await integrationManager.createNodeFromFileContextWorkflow(mockUri, 'new');

                // Assert
                expect(integrationManager.createNodeWorkflow).toHaveBeenCalledWith('example.ts', '/test/example.ts', 1);
                expect(result).toBe(createdNode);
            });

            it('should create child node from file context', async () => {
                // Arrange
                const createdNode = { ...testNode, name: 'example.ts' };
                vi.spyOn(integrationManager, 'createChildNodeWorkflow').mockResolvedValue(createdNode);

                // Act
                const result = await integrationManager.createNodeFromFileContextWorkflow(mockUri, 'child');

                // Assert
                expect(integrationManager.createChildNodeWorkflow).toHaveBeenCalledWith('example.ts', '/test/example.ts', 1);
                expect(result).toBe(createdNode);
            });

            it('should create parent node from file context', async () => {
                // Arrange
                const createdNode = { ...testNode, name: 'example.ts' };
                vi.spyOn(integrationManager, 'createParentNodeWorkflow').mockResolvedValue(createdNode);

                // Act
                const result = await integrationManager.createNodeFromFileContextWorkflow(mockUri, 'parent');

                // Assert
                expect(integrationManager.createParentNodeWorkflow).toHaveBeenCalledWith('example.ts', '/test/example.ts', 1);
                expect(result).toBe(createdNode);
            });

            it('should create bro node from file context', async () => {
                // Arrange
                const createdNode = { ...testNode, name: 'example.ts' };
                vi.spyOn(integrationManager, 'createBroNodeWorkflow').mockResolvedValue(createdNode);

                // Act
                const result = await integrationManager.createNodeFromFileContextWorkflow(mockUri, 'bro');

                // Assert
                expect(integrationManager.createBroNodeWorkflow).toHaveBeenCalledWith('example.ts', '/test/example.ts', 1);
                expect(result).toBe(createdNode);
            });

            it('should handle directory context', async () => {
                // Arrange
                const mockDirStats = { isDirectory: () => true };
                const fs = require('fs');
                fs.promises.stat.mockResolvedValue(mockDirStats);
                
                const path = require('path');
                path.basename.mockReturnValue('src');

                const createdNode = { ...testNode, name: 'src' };
                vi.spyOn(integrationManager, 'createNodeWorkflow').mockResolvedValue(createdNode);

                // Act
                const result = await integrationManager.createNodeFromFileContextWorkflow(mockUri, 'new');

                // Assert
                expect(integrationManager.createNodeWorkflow).toHaveBeenCalledWith('src', '/test/example.ts', 1);
                expect(result).toBe(createdNode);
            });

            it('should throw error for unsupported node type', async () => {
                // Act & Assert
                await expect(
                    integrationManager.createNodeFromFileContextWorkflow(mockUri, 'invalid' as any)
                ).rejects.toThrow('不支持的节点类型');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('从文件创建节点失败: 不支持的节点类型: invalid');
            });

            it('should throw error when no resource URI provided', async () => {
                // Act & Assert
                await expect(
                    integrationManager.createNodeFromFileContextWorkflow(null as any)
                ).rejects.toThrow('未选择文件或文件夹');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('从文件创建节点失败: 未选择文件或文件夹');
            });

            it('should handle file system errors', async () => {
                // Arrange
                const fs = require('fs');
                fs.promises.stat.mockRejectedValue(new Error('File not found'));

                // Act & Assert
                await expect(
                    integrationManager.createNodeFromFileContextWorkflow(mockUri)
                ).rejects.toThrow('File not found');
                expect(mockShowErrorMessage).toHaveBeenCalledWith('从文件创建节点失败: File not found');
            });
        });
    });

    describe('Manager Access', () => {
        it('should provide access to clipboard manager', () => {
            const clipboardManager = integrationManager.getClipboardManager();
            expect(clipboardManager).toBeInstanceOf(ClipboardManager);
        });

        it('should provide access to node order manager', () => {
            const nodeOrderManager = integrationManager.getNodeOrderManager();
            expect(nodeOrderManager).toBeInstanceOf(NodeOrderManager);
        });
    });

    describe('Context Updates', () => {
        it('should update VS Code context with clipboard state', async () => {
            // Arrange
            const clipboardManager = integrationManager.getClipboardManager();
            vi.spyOn(clipboardManager, 'hasClipboardData').mockReturnValue(true);

            // Act - trigger context update through any workflow
            await integrationManager.copyNodeWorkflow();

            // Assert
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'codepath.hasClipboardNode', true);
        });
    });

    describe('Disposal', () => {
        it('should dispose clipboard manager on disposal', () => {
            // Arrange
            const clipboardManager = integrationManager.getClipboardManager();
            const disposeSpy = vi.spyOn(clipboardManager, 'dispose');

            // Act
            integrationManager.dispose();

            // Assert
            expect(disposeSpy).toHaveBeenCalled();
        });
    });
});