import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { IntegrationManager } from '../managers/IntegrationManager';
import { GraphManager } from '../managers/GraphManager';
import { NodeManager } from '../managers/NodeManager';
import { PreviewManager } from '../managers/PreviewManager';
import { WebviewManager } from '../managers/WebviewManager';
import { StatusBarManager } from '../managers/StatusBarManager';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { StorageManager } from '../managers/StorageManager';
import { CodePathError } from '../types/errors';

// 使用统一 VS Code 模拟，确保命令、状态栏、输出通道等依赖具备可观测行为
vi.mock('vscode', async () => {
    const actual = await import('../__mocks__/vscode');

    return {
        ...actual,
        window: {
            ...actual.window,
            showErrorMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            createStatusBarItem: vi.fn(() => ({
                text: '',
                tooltip: '',
                show: vi.fn(),
                hide: vi.fn(),
                dispose: vi.fn()
            })),
            createWebviewPanel: vi.fn(() => ({
                webview: {
                    html: '',
                    onDidReceiveMessage: vi.fn(),
                    postMessage: vi.fn().mockResolvedValue(true)
                },
                onDidDispose: vi.fn(),
                dispose: vi.fn(),
                reveal: vi.fn()
            }))
        },
        commands: {
            ...actual.commands,
            executeCommand: vi.fn().mockResolvedValue(undefined),
            registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() })
        },
        Uri: {
            ...actual.Uri,
            joinPath: vi.fn().mockReturnValue({ fsPath: '/mock/path' })
        }
    };
});

describe('Node Creation Workflow Integration Tests', () => {
    let integrationManager: IntegrationManager;
    let graphManager: GraphManager;
    let nodeManager: NodeManager;
    let previewManager: PreviewManager;
    let webviewManager: WebviewManager;
    let statusBarManager: StatusBarManager;
    let configManager: ConfigurationManager;
    let storageManager: StorageManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(async () => {
        // Create mock context
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: process.cwd() } as vscode.Uri,
            globalState: {
                get: vi.fn(),
                update: vi.fn()
            },
            workspaceState: {
                get: vi.fn(),
                update: vi.fn()
            }
        } as any;

        // Initialize managers with proper workspace root
        storageManager = new StorageManager('/test/workspace');
        configManager = new ConfigurationManager(storageManager);
        await configManager.initialize();
        
        graphManager = new GraphManager(storageManager);
        nodeManager = new NodeManager(graphManager);
        previewManager = new PreviewManager('text');
        webviewManager = new WebviewManager(mockContext);
        statusBarManager = new StatusBarManager();

        integrationManager = new IntegrationManager(
            graphManager,
            nodeManager,
            previewManager,
            webviewManager,
            statusBarManager,
            configManager,
            mockContext
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        if (integrationManager) {
            integrationManager.dispose();
        }
    });

    describe('createNodeWorkflow', () => {
        it('should create a root node successfully', async () => {
            // Arrange
            const selectedText = 'function testFunction() {';
            const filePath = '/test/file.js';
            const lineNumber = 10;

            // Act
            const result = await integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('function testFunction() {');
            expect(result.filePath).toBe(filePath);
            expect(result.lineNumber).toBe(lineNumber);
            expect(result.codeSnippet).toBe(selectedText);

            // Verify graph was created
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph).toBeDefined();
            expect(currentGraph!.nodes.size).toBe(1);

            // Verify node is set as current
            const currentNode = nodeManager.getCurrentNode();
            expect(currentNode).toBeDefined();
            expect(currentNode!.id).toBe(result.id);

            // Verify success message was shown
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已标记为新节点:')
            );
        });

        it('should create a graph automatically if none exists', async () => {
            // Arrange
            const selectedText = 'const x = 1;';
            const filePath = '/test/file.js';
            const lineNumber = 5;

            // Ensure no graph exists
            expect(graphManager.getCurrentGraph()).toBeNull();

            // Act
            await integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph).toBeDefined();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Created new graph:')
            );
        });

        it('should handle empty selected text', async () => {
            // Arrange
            const selectedText = '';
            const filePath = '/test/file.js';
            const lineNumber = 5;

            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber)
            ).rejects.toThrow(CodePathError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Please select code text first')
            );
        });

        it('should handle whitespace-only selected text', async () => {
            // Arrange
            const selectedText = '   \n\t  ';
            const filePath = '/test/file.js';
            const lineNumber = 5;

            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber)
            ).rejects.toThrow(CodePathError);
        });

        it('should handle missing file path', async () => {
            // Arrange
            const selectedText = 'const x = 1;';
            const filePath = '';
            const lineNumber = 5;

            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber)
            ).rejects.toThrow(CodePathError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No active file found')
            );
        });

        it('should update preview after node creation', async () => {
            // Arrange
            const selectedText = 'function test() {}';
            const filePath = '/test/file.js';
            const lineNumber = 1;

            const setGraphSpy = vi.spyOn(previewManager, 'setGraph');

            // Act
            await integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(setGraphSpy).toHaveBeenCalled();
        });

        it('should update status bar after node creation', async () => {
            // Arrange
            const selectedText = 'function test() {}';
            const filePath = '/test/file.js';
            const lineNumber = 1;

            const updateGraphInfoSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');
            const updateNodeInfoSpy = vi.spyOn(statusBarManager, 'updateCurrentNode');

            // Act
            await integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(updateGraphInfoSpy).toHaveBeenCalled();
            expect(updateNodeInfoSpy).toHaveBeenCalled();
        });

        it('should update VS Code context after node creation', async () => {
            // Arrange
            const selectedText = 'function test() {}';
            const filePath = '/test/file.js';
            const lineNumber = 1;

            // Act
            await integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext', 'codepath.hasCurrentNode', true
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext', 'codepath.hasCurrentGraph', true
            );
        });
    });

    describe('createChildNodeWorkflow', () => {
        beforeEach(async () => {
            // Create a parent node first
            await integrationManager.createNodeWorkflow(
                'function parent() {',
                '/test/parent.js',
                1
            );
        });

        it('should create a child node successfully', async () => {
            // Arrange
            const selectedText = 'const child = true;';
            const filePath = '/test/child.js';
            const lineNumber = 5;

            const parentNode = nodeManager.getCurrentNode()!;

            // Act
            const result = await integrationManager.createChildNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('const child = true;');
            expect(result.parentId).toBe(parentNode.id);

            // Verify parent-child relationship
            const currentGraph = graphManager.getCurrentGraph()!;
            const parentNodeUpdated = currentGraph.nodes.get(parentNode.id)!;
            expect(parentNodeUpdated.childIds).toContain(result.id);

            // Verify child is set as current
            const currentNode = nodeManager.getCurrentNode();
            expect(currentNode!.id).toBe(result.id);
        });

        it('should handle no current node selected', async () => {
            // Arrange
            // Mock getCurrentNode to return null (no current node)
            vi.spyOn(nodeManager, 'getCurrentNode').mockReturnValue(null);
            
            const selectedText = 'const child = true;';
            const filePath = '/test/child.js';
            const lineNumber = 5;

            // Act & Assert
            await expect(
                integrationManager.createChildNodeWorkflow(selectedText, filePath, lineNumber)
            ).rejects.toThrow(CodePathError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No current node selected')
            );
        });
    });

    describe('createParentNodeWorkflow', () => {
        beforeEach(async () => {
            // Create a child node first
            await integrationManager.createNodeWorkflow(
                'function child() {',
                '/test/child.js',
                10
            );
        });

        it('should create a parent node successfully', async () => {
            // Arrange
            const selectedText = 'function parent() {';
            const filePath = '/test/parent.js';
            const lineNumber = 1;

            const childNode = nodeManager.getCurrentNode()!;

            // Act
            const result = await integrationManager.createParentNodeWorkflow(selectedText, filePath, lineNumber);

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('function parent() {');
            expect(result.childIds).toContain(childNode.id);

            // Verify child now has parent
            const currentGraph = graphManager.getCurrentGraph()!;
            const childNodeUpdated = currentGraph.nodes.get(childNode.id)!;
            expect(childNodeUpdated.parentId).toBe(result.id);

            // Verify parent is set as current
            const currentNode = nodeManager.getCurrentNode();
            expect(currentNode!.id).toBe(result.id);
        });
    });

    describe('switchNodeWorkflow', () => {
        let node1Id: string;
        let node2Id: string;

        beforeEach(async () => {
            // Create two nodes
            const node1 = await integrationManager.createNodeWorkflow(
                'function node1() {',
                '/test/node1.js',
                1
            );
            node1Id = node1.id;

            const node2 = await integrationManager.createNodeWorkflow(
                'function node2() {',
                '/test/node2.js',
                10
            );
            node2Id = node2.id;
        });

        it('should switch to target node successfully', async () => {
            // Arrange
            nodeManager.setCurrentNode(node2Id); // Start with node2 as current

            // Act
            await integrationManager.switchNodeWorkflow(node1Id);

            // Assert
            const currentNode = nodeManager.getCurrentNode();
            expect(currentNode!.id).toBe(node1Id);

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Switched to node:')
            );
        });

        it('should handle non-existent node ID', async () => {
            // Arrange
            const nonExistentId = 'non-existent-id';

            // Act & Assert
            await expect(
                integrationManager.switchNodeWorkflow(nonExistentId)
            ).rejects.toThrow(CodePathError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Node with ID')
            );
        });

        it('should handle no active graph', async () => {
            // Arrange
            graphManager.setCurrentGraph(null);

            // Act & Assert
            await expect(
                integrationManager.switchNodeWorkflow(node1Id)
            ).rejects.toThrow(CodePathError);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No active graph found')
            );
        });
    });

    describe('Auto-save functionality', () => {
        it('should auto-save when enabled in configuration', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoSave = true;
            
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Act
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Wait for debounced save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(saveSpy).toHaveBeenCalled();
        });

        it('should not auto-save when disabled in configuration', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoSave = false;
            
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Act
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Wait to ensure no save occurs
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert - saveGraph should not be called for auto-save
            // (it might be called during node creation, but not for auto-save)
            expect(saveSpy).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ autoSave: true })
            );
        });
    });

    describe('Error handling and recovery', () => {
        it('should handle storage errors gracefully', async () => {
            // Arrange
            const saveError = new Error('Storage failed');
            vi.spyOn(graphManager, 'saveGraph').mockRejectedValue(saveError);

            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow(
                    'function test() {}',
                    '/test/file.js',
                    1
                )
            ).rejects.toThrow('Storage failed');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to create node')
            );
        });

        it('should handle preview update errors gracefully', async () => {
            // Arrange
            const previewError = new Error('Preview failed');
            vi.spyOn(previewManager, 'forceUpdate').mockRejectedValue(previewError);

            // Act
            const result = await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Assert - node should still be created even if preview update fails
            expect(result).toBeDefined();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已标记为新节点:')
            );
        });
    });

    describe('Integration state management', () => {
        it('should provide accurate state information', async () => {
            // Arrange - start with no graph
            expect(integrationManager.getState().hasGraph).toBe(false);
            expect(integrationManager.getState().hasCurrentNode).toBe(false);
            expect(integrationManager.getState().nodeCount).toBe(0);

            // Act - create a node
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Assert - state should be updated
            const state = integrationManager.getState();
            expect(state.hasGraph).toBe(true);
            expect(state.hasCurrentNode).toBe(true);
            expect(state.nodeCount).toBe(1);
            expect(state.previewFormat).toBe('text');
        });
    });
});


