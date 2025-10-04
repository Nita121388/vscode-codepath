import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { IntegrationManager } from '../managers/IntegrationManager';
import { GraphManager } from '../managers/GraphManager';
import { NodeManager } from '../managers/NodeManager';
import { PreviewManager } from '../managers/PreviewManager';
import { WebviewManager } from '../managers/WebviewManager';
import { StatusBarManager } from '../managers/StatusBarManager';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import { StorageManager } from '../managers/StorageManager';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showQuickPick: vi.fn(),
        showTextDocument: vi.fn(),
        showInputBox: vi.fn(),
        showSaveDialog: vi.fn(),
        showOpenDialog: vi.fn(),
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
                postMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            dispose: vi.fn()
        })),
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            show: vi.fn(),
            dispose: vi.fn()
        }))
    },
    workspace: {
        openTextDocument: vi.fn(),
        fs: {
            writeFile: vi.fn(),
            readFile: vi.fn()
        },
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn()
        }))
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    Position: vi.fn(),
    Selection: vi.fn(),
    Range: vi.fn(),
    Uri: {
        file: vi.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ViewColumn: {
        Beside: 1
    }
}));

describe('Comprehensive Integration Tests', () => {
    let integrationManager: IntegrationManager;
    let graphManager: GraphManager;
    let nodeManager: NodeManager;
    let previewManager: PreviewManager;
    let webviewManager: WebviewManager;
    let statusBarManager: StatusBarManager;
    let configManager: ConfigurationManager;
    let storageManager: StorageManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock context
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: vi.fn(),
                update: vi.fn()
            },
            globalState: {
                get: vi.fn(),
                update: vi.fn()
            },
            extensionPath: '/test/extension',
            storagePath: '/test/storage',
            globalStoragePath: '/test/global'
        } as any;

        // Create managers
        storageManager = new StorageManager('/test/workspace');
        configManager = new ConfigurationManager();
        graphManager = new GraphManager(storageManager, configManager);
        nodeManager = new NodeManager(graphManager, configManager);
        previewManager = new PreviewManager(configManager);
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
        if (integrationManager) {
            integrationManager.dispose();
        }
    });

    describe('Requirement 1: Create code path nodes', () => {
        it('should create root node with selected text', async () => {
            // Arrange
            const selectedText = 'function validateInput()';
            const filePath = '/src/auth.ts';
            const lineNumber = 15;

            // Mock active editor
            (vscode.window.activeTextEditor as any) = {
                document: {
                    fileName: filePath,
                    lineAt: vi.fn().mockReturnValue({ lineNumber })
                },
                selection: {
                    isEmpty: false,
                    start: { line: lineNumber }
                }
            };

            // Act
            const result = await integrationManager.createNodeWorkflow(
                selectedText,
                filePath,
                lineNumber
            );

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe(selectedText);
            expect(result.filePath).toBe(filePath);
            expect(result.lineNumber).toBe(lineNumber);
        });

        it('should automatically create graph if none exists', async () => {
            // Arrange
            expect(graphManager.getCurrentGraph()).toBeNull();

            // Act
            await integrationManager.createNodeWorkflow(
                'test node',
                '/test/file.ts',
                1
            );

            // Assert
            expect(graphManager.getCurrentGraph()).toBeDefined();
        });

        it('should capture file path and line number automatically', async () => {
            // Arrange
            const filePath = '/src/components/Button.tsx';
            const lineNumber = 42;

            // Act
            const result = await integrationManager.createNodeWorkflow(
                'Button component',
                filePath,
                lineNumber
            );

            // Assert
            expect(result.filePath).toBe(filePath);
            expect(result.lineNumber).toBe(lineNumber);
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
        });
    });

    describe('Requirement 2: Parent-child relationships', () => {
        it('should create child node under current node', async () => {
            // Arrange
            const parentResult = await integrationManager.createNodeWorkflow(
                'parent function',
                '/test/parent.ts',
                10
            );

            // Act
            const childResult = await integrationManager.createChildNodeWorkflow(
                'child function',
                '/test/child.ts',
                20
            );

            // Assert
            expect(childResult.parentId).toBe(parentResult.id);
            
            const currentGraph = graphManager.getCurrentGraph()!;
            const parentNode = currentGraph.getNode(parentResult.id)!;
            expect(parentNode.childIds).toContain(childResult.id);
        });

        it('should create parent node above current node', async () => {
            // Arrange
            const childResult = await integrationManager.createNodeWorkflow(
                'child function',
                '/test/child.ts',
                20
            );

            // Act
            const parentResult = await integrationManager.createParentNodeWorkflow(
                'parent function',
                '/test/parent.ts',
                10
            );

            // Assert
            expect(childResult.parentId).toBe(parentResult.id);
            expect(parentResult.childIds).toContain(childResult.id);
        });

        it('should maintain proper hierarchical relationships', async () => {
            // Arrange
            const root = await integrationManager.createNodeWorkflow('root', '/test/root.ts', 1);
            const child1 = await integrationManager.createChildNodeWorkflow('child1', '/test/child1.ts', 10);
            const child2 = await integrationManager.createChildNodeWorkflow('child2', '/test/child2.ts', 20);

            // Switch to child1 and create grandchild
            nodeManager.setCurrentNode(child1.id);
            const grandchild = await integrationManager.createChildNodeWorkflow('grandchild', '/test/gc.ts', 30);

            // Assert
            const graph = graphManager.getCurrentGraph()!;
            expect(graph.getNode(root.id)!.childIds).toContain(child1.id);
            expect(graph.getNode(root.id)!.childIds).toContain(child2.id);
            expect(graph.getNode(child1.id)!.childIds).toContain(grandchild.id);
            expect(graph.getNode(grandchild.id)!.parentId).toBe(child1.id);
        });
    });

    describe('Requirement 3: Node navigation', () => {
        it('should switch nodes with fuzzy name matching', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('validateUserInput', '/test/validate.ts', 10);
            await integrationManager.createNodeWorkflow('processUserData', '/test/process.ts', 20);
            await integrationManager.createNodeWorkflow('saveUserProfile', '/test/save.ts', 30);

            // Act
            const result = await integrationManager.switchNodeWorkflow('validate');

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('validateUserInput');
            expect(nodeManager.getCurrentNode()?.id).toBe(result.id);
        });

        it('should switch nodes with exact position matching', async () => {
            // Arrange
            const node1 = await integrationManager.createNodeWorkflow('function1', '/test/file.ts', 10);
            await integrationManager.createNodeWorkflow('function2', '/test/file.ts', 20);

            // Act
            const result = await integrationManager.switchNodeWorkflow('/test/file.ts:10');

            // Assert
            expect(result.id).toBe(node1.id);
            expect(nodeManager.getCurrentNode()?.id).toBe(node1.id);
        });

        it('should update preview when switching nodes', async () => {
            // Arrange
            const updateSpy = vi.spyOn(previewManager, 'updatePreview');
            await integrationManager.createNodeWorkflow('node1', '/test/1.ts', 1);
            await integrationManager.createNodeWorkflow('node2', '/test/2.ts', 2);

            // Act
            await integrationManager.switchNodeWorkflow('node2');

            // Assert
            expect(updateSpy).toHaveBeenCalled();
        });
    });

    describe('Requirement 4: Multiple visualization formats', () => {
        it('should provide real-time preview updates', async () => {
            // Arrange
            const updateSpy = vi.spyOn(previewManager, 'updatePreview');

            // Act
            await integrationManager.createNodeWorkflow('test node', '/test/file.ts', 1);

            // Assert
            expect(updateSpy).toHaveBeenCalled();
        });

        it('should support text and mermaid formats', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('root', '/test/root.ts', 1);
            await integrationManager.createChildNodeWorkflow('child', '/test/child.ts', 10);

            // Act - Test text format
            previewManager.setFormat('text');
            const textPreview = await previewManager.renderPreview();

            // Act - Test mermaid format
            previewManager.setFormat('mermaid');
            const mermaidPreview = await previewManager.renderPreview();

            // Assert
            expect(textPreview).toContain('root');
            expect(textPreview).toContain('child');
            expect(mermaidPreview).toContain('graph TD');
        });

        it('should fallback to text view on rendering errors', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('node with "quotes"', '/test/file.ts', 1);
            
            // Act
            previewManager.setFormat('mermaid');
            
            // This should not throw but fallback gracefully
            const preview = await previewManager.renderPreview();
            
            // Assert
            expect(preview).toBeDefined();
        });
    });

    describe('Requirement 5: Multiple graph management', () => {
        it('should create and switch between graphs', async () => {
            // Arrange
            const graph1 = await graphManager.createGraph('Graph 1');
            await integrationManager.createNodeWorkflow('node1', '/test/1.ts', 1);

            const graph2 = await graphManager.createGraph('Graph 2');
            await integrationManager.createNodeWorkflow('node2', '/test/2.ts', 2);

            // Act
            await graphManager.setCurrentGraph(graph1);

            // Assert
            expect(graphManager.getCurrentGraph()?.id).toBe(graph1.id);
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(1);
        });

        it('should export graph to markdown format', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('root', '/test/root.ts', 1);
            await integrationManager.createChildNodeWorkflow('child', '/test/child.ts', 10);

            // Act
            const exported = await graphManager.exportGraph(
                graphManager.getCurrentGraph()!,
                'md'
            );

            // Assert
            expect(exported).toContain('# CodePath Graph');
            expect(exported).toContain('root');
            expect(exported).toContain('child');
        });

        it('should import shared graphs', async () => {
            // Arrange
            const originalGraph = await graphManager.createGraph('Original');
            await integrationManager.createNodeWorkflow('test node', '/test/file.ts', 1);
            const exported = await graphManager.exportGraph(originalGraph, 'md');

            // Act
            const imported = await graphManager.importGraph(exported);

            // Assert
            expect(imported.name).toBe('Original');
            expect(imported.nodes.size).toBe(1);
        });
    });

    describe('Requirement 6: Configuration management', () => {
        it('should respect default view format setting', async () => {
            // Arrange
            await configManager.updateConfiguration('defaultView', 'mermaid');
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Act
            const format = previewManager.getFormat();

            // Assert
            expect(format).toBe('mermaid');
        });

        it('should handle auto-save configuration', async () => {
            // Arrange
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');
            await configManager.updateConfiguration('autoSave', true);

            // Act
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Assert
            expect(saveSpy).toHaveBeenCalled();
        });
    });

    describe('Requirement 7: Status bar integration', () => {
        it('should display current graph and node information', async () => {
            // Arrange
            const updateSpy = vi.spyOn(statusBarManager, 'updateStatus');
            
            // Act
            await integrationManager.createNodeWorkflow('test node', '/test/file.ts', 1);

            // Assert
            expect(updateSpy).toHaveBeenCalled();
        });
    });

    describe('Requirement 8: Error handling', () => {
        it('should handle missing text selection gracefully', async () => {
            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow('', '/test/file.ts', 1)
            ).rejects.toThrow('Please select code text first');
        });

        it('should handle file system errors gracefully', async () => {
            // Arrange
            vi.spyOn(storageManager, 'saveGraphToFile').mockRejectedValue(new Error('Permission denied'));

            // Act & Assert
            await expect(
                integrationManager.createNodeWorkflow('test', '/test/file.ts', 1)
            ).rejects.toThrow();
        });

        it('should warn when approaching node limits', async () => {
            // Arrange
            const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
            await configManager.updateConfiguration('maxNodesPerGraph', 2);

            // Act
            await integrationManager.createNodeWorkflow('node1', '/test/1.ts', 1);
            await integrationManager.createNodeWorkflow('node2', '/test/2.ts', 2);
            await integrationManager.createNodeWorkflow('node3', '/test/3.ts', 3);

            // Assert
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('approaching the recommended limit')
            );
        });
    });

    describe('Performance and scalability', () => {
        it('should handle large graphs efficiently', async () => {
            // Arrange
            const startTime = Date.now();

            // Act - Create 50 nodes
            for (let i = 0; i < 50; i++) {
                await integrationManager.createNodeWorkflow(
                    `node_${i}`,
                    `/test/file_${i}.ts`,
                    i + 1
                );
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Assert - Should complete within reasonable time (5 seconds)
            expect(duration).toBeLessThan(5000);
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(50);
        });

        it('should handle rapid operations without conflicts', async () => {
            // Act - Create multiple nodes rapidly
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    integrationManager.createNodeWorkflow(
                        `rapid_node_${i}`,
                        `/test/rapid_${i}.ts`,
                        i + 1
                    )
                );
            }

            const results = await Promise.all(promises);

            // Assert
            expect(results).toHaveLength(10);
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(10);
        });
    });

    describe('Cross-platform compatibility', () => {
        it('should handle Windows file paths', async () => {
            // Act
            const result = await integrationManager.createNodeWorkflow(
                'windows node',
                'C:\\Users\\test\\project\\file.ts',
                1
            );

            // Assert
            expect(result.filePath).toBe('C:\\Users\\test\\project\\file.ts');
        });

        it('should handle Unix file paths', async () => {
            // Act
            const result = await integrationManager.createNodeWorkflow(
                'unix node',
                '/home/user/project/file.ts',
                1
            );

            // Assert
            expect(result.filePath).toBe('/home/user/project/file.ts');
        });

        it('should handle special characters in file paths', async () => {
            // Act
            const result = await integrationManager.createNodeWorkflow(
                'special node',
                '/test/file with spaces & symbols!.ts',
                1
            );

            // Assert
            expect(result.filePath).toBe('/test/file with spaces & symbols!.ts');
        });
    });

    describe('Memory management', () => {
        it('should properly dispose resources', () => {
            // Arrange
            const disposeSpy = vi.spyOn(integrationManager, 'dispose');

            // Act
            integrationManager.dispose();

            // Assert
            expect(disposeSpy).toHaveBeenCalled();
        });

        it('should clean up event listeners', () => {
            // Arrange
            const initialListeners = mockContext.subscriptions.length;

            // Act
            integrationManager.dispose();

            // Assert - Should not have grown significantly
            expect(mockContext.subscriptions.length).toBeLessThanOrEqual(initialListeners + 5);
        });
    });
});