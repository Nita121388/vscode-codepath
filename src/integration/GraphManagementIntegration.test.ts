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

// 统一 VS Code 模拟，确保命令、预览、状态栏在测试中具备可观测能力
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

describe('Graph Management Integration Tests', () => {
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
            extensionUri: { fsPath: '/test/path' } as vscode.Uri,
            globalState: {
                get: vi.fn(),
                update: vi.fn()
            },
            workspaceState: {
                get: vi.fn(),
                update: vi.fn()
            }
        } as any;

        // Initialize managers
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

    describe('Complete graph lifecycle integration', () => {
        it('should handle complete graph creation, modification, and switching workflow', async () => {
            // Step 1: Create first graph with nodes
            const node1 = await integrationManager.createNodeWorkflow(
                'function firstGraph() {',
                '/test/graph1.js',
                1
            );

            const childNode1 = await integrationManager.createChildNodeWorkflow(
                'const child = true;',
                '/test/graph1.js',
                5
            );

            const firstGraph = graphManager.getCurrentGraph();
            expect(firstGraph).toBeDefined();
            expect(firstGraph!.nodes.size).toBe(2);

            // Step 2: Create second graph
            const secondGraph = await graphManager.createGraph('Second Graph');
            
            const node2 = await integrationManager.createNodeWorkflow(
                'function secondGraph() {',
                '/test/graph2.js',
                1
            );

            expect(graphManager.getCurrentGraph()!.id).toBe(secondGraph.id);
            expect(graphManager.getCurrentGraph()!.nodes.size).toBe(1);

            // Step 3: Switch back to first graph
            await integrationManager.switchGraphWorkflow(firstGraph!.id);

            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph!.id).toBe(firstGraph!.id);
            expect(currentGraph!.nodes.size).toBe(2);

            // Step 4: Verify all components are updated
            const state = integrationManager.getState();
            expect(state.hasGraph).toBe(true);
            expect(state.nodeCount).toBe(2);
        });

        it('should maintain preview synchronization during graph operations', async () => {
            const setGraphSpy = vi.spyOn(previewManager, 'setGraph');

            // Create graph and node
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Verify preview was updated
            expect(setGraphSpy).toHaveBeenCalled();

            // Create second graph
            const secondGraph = await graphManager.createGraph('Second Graph');
            await integrationManager.updatePreview();

            // Switch graphs
            const firstGraph = graphManager.getCurrentGraph();
            await graphManager.createGraph('Third Graph');
            await integrationManager.switchGraphWorkflow(firstGraph!.id);

            // Verify preview updates occurred
            // At least createNodeWorkflow + updatePreview should be called
            expect(setGraphSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle auto-save during graph operations', async () => {
            // Enable auto-save
            const config = configManager.getConfiguration();
            config.autoSave = true;

            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Create nodes to trigger auto-save
            await integrationManager.createNodeWorkflow(
                'function test1() {}',
                '/test/file1.js',
                1
            );

            await integrationManager.createNodeWorkflow(
                'function test2() {}',
                '/test/file2.js',
                10
            );

            // Wait for debounced auto-save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify auto-save was triggered
            expect(saveSpy).toHaveBeenCalled();
        });
    });

    describe('Export/Import integration', () => {
        it('should export and import graphs with full fidelity', async () => {
            // Create a complex graph
            const parentNode = await integrationManager.createNodeWorkflow(
                'function parent() {',
                '/test/parent.js',
                1
            );

            const childNode1 = await integrationManager.createChildNodeWorkflow(
                'const child1 = true;',
                '/test/child1.js',
                5
            );

            await integrationManager.switchNodeWorkflow(parentNode.id);
            const childNode2 = await integrationManager.createChildNodeWorkflow(
                'const child2 = false;',
                '/test/child2.js',
                10
            );

            const originalGraph = graphManager.getCurrentGraph()!;

            // Export the graph
            const exportContent = await graphManager.exportGraph(originalGraph, 'md');
            expect(exportContent).toContain('function parent() {');
            expect(exportContent).toContain('const child1 = true;');
            expect(exportContent).toContain('const child2 = false;');

            // Import into new graph
            const importedGraph = await graphManager.importGraph(exportContent);

            // Verify structure is preserved
            expect(importedGraph.nodes.size).toBe(3);
            
            const importedNodes = Array.from(importedGraph.nodes.values());
            const importedParent = importedNodes.find(n => n.name === 'function parent() {');
            const importedChild1 = importedNodes.find(n => n.name === 'const child1 = true;');
            const importedChild2 = importedNodes.find(n => n.name === 'const child2 = false;');

            expect(importedParent).toBeDefined();
            expect(importedChild1).toBeDefined();
            expect(importedChild2).toBeDefined();

            // Verify relationships
            expect(importedChild1!.parentId).toBe(importedParent!.id);
            expect(importedChild2!.parentId).toBe(importedParent!.id);
            expect(importedParent!.childIds).toContain(importedChild1!.id);
            expect(importedParent!.childIds).toContain(importedChild2!.id);
        });
    });

    describe('Status bar integration', () => {
        it('should update status bar during all graph operations', async () => {
            const updateGraphInfoSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');
            const updateCurrentNodeSpy = vi.spyOn(statusBarManager, 'updateCurrentNode');

            // Create node
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            expect(updateGraphInfoSpy).toHaveBeenCalled();
            expect(updateCurrentNodeSpy).toHaveBeenCalled();

            // Switch graphs
            const firstGraph = graphManager.getCurrentGraph()!;
            const secondGraph = await graphManager.createGraph('Second Graph');
            
            updateGraphInfoSpy.mockClear();
            updateCurrentNodeSpy.mockClear();

            await integrationManager.switchGraphWorkflow(firstGraph.id);

            expect(updateGraphInfoSpy).toHaveBeenCalled();
            expect(updateCurrentNodeSpy).toHaveBeenCalled();
        });
    });

    describe('Error handling and recovery', () => {
        it('should handle graph switching errors gracefully', async () => {
            const loadError = new Error('Graph not found');
            vi.spyOn(graphManager, 'loadGraph').mockRejectedValue(loadError);

            await expect(
                integrationManager.switchGraphWorkflow('non-existent-id')
            ).rejects.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to switch graph')
            );
        });

        it('should maintain consistency during partial failures', async () => {
            // Create a working graph
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            const workingGraph = graphManager.getCurrentGraph()!;

            // Simulate preview failure during graph switch
            const previewError = new Error('Preview failed');
            vi.spyOn(previewManager, 'forceUpdate').mockRejectedValue(previewError);

            // Create second graph
            const secondGraph = await graphManager.createGraph('Second Graph');

            // Switch should still work even if preview fails
            await integrationManager.switchGraphWorkflow(workingGraph.id);

            // Verify graph was switched despite preview failure
            expect(graphManager.getCurrentGraph()!.id).toBe(workingGraph.id);
        });
    });

    describe('Configuration integration', () => {
        it('should respect auto-save configuration changes', async () => {
            const config = configManager.getConfiguration();
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Start with auto-save disabled
            config.autoSave = false;

            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Wait to ensure no auto-save
            await new Promise(resolve => setTimeout(resolve, 100));

            const initialSaveCount = saveSpy.mock.calls.length;

            // Enable auto-save
            config.autoSave = true;

            await integrationManager.createNodeWorkflow(
                'function test2() {}',
                '/test/file2.js',
                5
            );

            // Wait for auto-save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should have additional saves after enabling auto-save
            expect(saveSpy.mock.calls.length).toBeGreaterThan(initialSaveCount);
        });

        it('should handle preview format preferences', async () => {
            // Create graph with content
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Test format toggling
            expect(previewManager.getFormat()).toBe('text');

            await integrationManager.togglePreviewFormat();
            expect(previewManager.getFormat()).toBe('mermaid');

            await integrationManager.togglePreviewFormat();
            expect(previewManager.getFormat()).toBe('text');
        });
    });

    describe('Performance and scalability', () => {
        it('should handle multiple rapid operations efficiently', async () => {
            const startTime = Date.now();

            // Create multiple nodes sequentially to avoid race conditions
            const results = [];
            for (let i = 0; i < 10; i++) {
                const result = await integrationManager.createNodeWorkflow(
                    `function test${i}() {}`,
                    `/test/file${i}.js`,
                    i + 1
                );
                results.push(result);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(5000); // 5 seconds

            // Verify all nodes were created
            expect(results).toHaveLength(10);
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph!.nodes.size).toBe(10);
        });

        it('should handle large graphs efficiently', async () => {
            // Create a larger graph structure
            const rootNode = await integrationManager.createNodeWorkflow(
                'function root() {}',
                '/test/root.js',
                1
            );

            // Create multiple levels of children
            let currentParent = rootNode;
            for (let level = 0; level < 5; level++) {
                await integrationManager.switchNodeWorkflow(currentParent.id);
                
                for (let child = 0; child < 3; child++) {
                    const childNode = await integrationManager.createChildNodeWorkflow(
                        `function level${level}_child${child}() {}`,
                        `/test/level${level}_child${child}.js`,
                        child + 1
                    );
                    
                    if (child === 0) {
                        currentParent = childNode; // Use first child as parent for next level
                    }
                }
            }

            // Verify structure
            const finalGraph = graphManager.getCurrentGraph();
            expect(finalGraph!.nodes.size).toBeGreaterThan(15); // Root + 5 levels * 3 children

            // Test that operations still work efficiently
            const startTime = Date.now();
            await integrationManager.updatePreview();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should update within 1 second
        });
    });
});
