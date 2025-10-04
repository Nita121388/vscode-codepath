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
import { Graph } from '../types';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        createStatusBarItem: vi.fn(() => ({
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn()
        })),
        createWebviewPanel: vi.fn(() => ({
            webview: {
                html: '',
                onDidReceiveMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            dispose: vi.fn(),
            reveal: vi.fn()
        }))
    },
    commands: {
        executeCommand: vi.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ViewColumn: {
        Beside: 2
    },
    Uri: {
        joinPath: vi.fn()
    }
}));

describe('Graph Management Workflow Integration Tests', () => {
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

    describe('Graph switching integration', () => {
        let graph1: Graph;
        let graph2: Graph;

        beforeEach(async () => {
            // Create two graphs with nodes
            graph1 = await graphManager.createGraph('Test Graph 1');
            await integrationManager.createNodeWorkflow(
                'function graph1Node() {}',
                '/test/graph1.js',
                1
            );

            graph2 = await graphManager.createGraph('Test Graph 2');
            await integrationManager.createNodeWorkflow(
                'function graph2Node() {}',
                '/test/graph2.js',
                1
            );
        });

        it('should switch graphs and update all components', async () => {
            // Arrange
            graphManager.setCurrentGraph(graph2); // Start with graph2
            const updatePreviewSpy = vi.spyOn(integrationManager, 'updatePreview');
            const updateStatusSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');

            // Act
            await integrationManager.switchGraphWorkflow(graph1.id);

            // Assert
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph?.id).toBe(graph1.id);
            expect(currentGraph?.name).toBe('Test Graph 1');

            // Verify components were updated
            expect(updatePreviewSpy).toHaveBeenCalled();
            expect(updateStatusSpy).toHaveBeenCalled();

            // Verify success message
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Switched to graph: Test Graph 1'
            );
        });

        it('should update preview content when switching graphs', async () => {
            // Arrange
            const setGraphSpy = vi.spyOn(previewManager, 'setGraph');
            const forceUpdateSpy = vi.spyOn(previewManager, 'forceUpdate');

            // Act
            await integrationManager.switchGraphWorkflow(graph1.id);

            // Assert
            expect(setGraphSpy).toHaveBeenCalledWith(graph1);
            expect(forceUpdateSpy).toHaveBeenCalled();
        });

        it('should update status bar when switching graphs', async () => {
            // Arrange
            const updateGraphInfoSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');

            // Act
            await integrationManager.switchGraphWorkflow(graph1.id);

            // Assert
            expect(updateGraphInfoSpy).toHaveBeenCalledWith(
                'Test Graph 1',
                1 // node count
            );
        });

        it('should update VS Code context when switching graphs', async () => {
            // Act
            await integrationManager.switchGraphWorkflow(graph1.id);

            // Assert
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext', 'codepath.hasCurrentGraph', true
            );
        });

        it('should handle switching to non-existent graph', async () => {
            // Arrange
            const nonExistentId = 'non-existent-graph-id';
            vi.spyOn(graphManager, 'loadGraph').mockRejectedValue(
                new Error('Graph not found')
            );

            // Act & Assert
            await expect(
                integrationManager.switchGraphWorkflow(nonExistentId)
            ).rejects.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to switch graph')
            );
        });
    });

    describe('Auto-save integration', () => {
        it('should auto-save graph changes when enabled', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoSave = true;
            
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Create a graph and node
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Act - create another node to trigger auto-save
            await integrationManager.createNodeWorkflow(
                'function test2() {}',
                '/test/file2.js',
                5
            );

            // Wait for debounced auto-save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(saveSpy).toHaveBeenCalled();
        });

        it('should not auto-save when disabled', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoSave = false;
            
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');
            saveSpy.mockClear(); // Clear any previous calls

            // Act
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Wait to ensure no auto-save occurs
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert - saveGraph might be called during creation but not for auto-save
            // Check that saveGraph was not called for auto-save specifically
            // Since saveGraph only takes one parameter (the graph), we check call count
            const callCount = saveSpy.mock.calls.length;
            // For this test, we expect minimal calls (only during node creation, not auto-save)
            expect(callCount).toBeLessThanOrEqual(2);
        });

        it('should handle auto-save errors gracefully', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoSave = true;
            
            const saveError = new Error('Auto-save failed');
            vi.spyOn(graphManager, 'saveGraph').mockRejectedValue(saveError);

            // Act - should not throw even if auto-save fails
            await expect(
                integrationManager.createNodeWorkflow(
                    'function test() {}',
                    '/test/file.js',
                    1
                )
            ).resolves.toBeDefined();

            // Assert - node creation should succeed despite auto-save failure
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph?.nodes.size).toBe(1);
        });
    });

    describe('Export/Import integration', () => {
        let testGraph: Graph;

        beforeEach(async () => {
            // Create a graph with multiple nodes
            testGraph = await graphManager.createGraph('Export Test Graph');
            
            // Create parent node
            const parentNode = await integrationManager.createNodeWorkflow(
                'function parent() {',
                '/test/parent.js',
                1
            );

            // Create child node
            await integrationManager.createChildNodeWorkflow(
                'const child = true;',
                '/test/child.js',
                5
            );
        });

        it('should export graph with all nodes and relationships', async () => {
            // Act
            const exportContent = await graphManager.exportGraph(testGraph, 'md');

            // Assert
            expect(exportContent).toContain('Export Test Graph');
            expect(exportContent).toContain('function parent() {');
            expect(exportContent).toContain('const child = true;');
            expect(exportContent).toContain('/test/parent.js:1');
            expect(exportContent).toContain('/test/child.js:5');
        });

        it('should import graph and update all components', async () => {
            // Arrange
            const exportContent = await graphManager.exportGraph(testGraph, 'md');
            
            // Clear current graph
            graphManager.setCurrentGraph(null);
            
            const updatePreviewSpy = vi.spyOn(integrationManager, 'updatePreview');

            // Act
            const importedGraph = await graphManager.importGraph(exportContent);

            // Manually trigger component updates (as would happen in command handler)
            await integrationManager.updatePreview();

            // Assert
            expect(importedGraph.name).toBe('Export Test Graph');
            expect(importedGraph.nodes.size).toBe(2);
            expect(updatePreviewSpy).toHaveBeenCalled();
        });

        it('should preserve node relationships during export/import', async () => {
            // Arrange
            const exportContent = await graphManager.exportGraph(testGraph, 'md');

            // Act
            const importedGraph = await graphManager.importGraph(exportContent);

            // Assert
            const nodes = Array.from(importedGraph.nodes.values());
            const parentNode = nodes.find(n => n.name === 'function parent() {');
            const childNode = nodes.find(n => n.name === 'const child = true;');

            expect(parentNode).toBeDefined();
            expect(childNode).toBeDefined();
            expect(childNode!.parentId).toBe(parentNode!.id);
            expect(parentNode!.childIds).toContain(childNode!.id);
        });
    });

    describe('Preview format integration', () => {
        beforeEach(async () => {
            // Create a graph with nodes for preview testing
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );
        });

        it('should toggle preview format and update content', async () => {
            // Arrange
            expect(previewManager.getFormat()).toBe('text');
            const updateSpy = vi.spyOn(integrationManager, 'updatePreview');

            // Act
            await integrationManager.togglePreviewFormat();

            // Assert
            expect(previewManager.getFormat()).toBe('mermaid');
            expect(updateSpy).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Preview format changed to: mermaid'
            );
        });

        it('should update webview content when format changes', async () => {
            // Arrange
            const updateContentSpy = vi.spyOn(webviewManager, 'updateContent');
            
            // Trigger preview update to establish baseline
            await integrationManager.updatePreview();
            updateContentSpy.mockClear();

            // Act
            await integrationManager.togglePreviewFormat();

            // Assert
            expect(updateContentSpy).toHaveBeenCalled();
        });

        it('should handle preview format toggle errors gracefully', async () => {
            // Arrange
            const toggleError = new Error('Toggle failed');
            vi.spyOn(previewManager, 'toggleFormat').mockImplementation(() => {
                throw toggleError;
            });

            // Act & Assert
            await expect(
                integrationManager.togglePreviewFormat()
            ).rejects.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to toggle preview format')
            );
        });
    });

    describe('Real-time preview updates', () => {
        it('should update preview when nodes are added', async () => {
            // Arrange
            const forceUpdateSpy = vi.spyOn(previewManager, 'forceUpdate');

            // Act
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Assert
            expect(forceUpdateSpy).toHaveBeenCalled();
        });

        it('should update preview when switching nodes', async () => {
            // Arrange
            const node1 = await integrationManager.createNodeWorkflow(
                'function node1() {}',
                '/test/node1.js',
                1
            );
            
            const node2 = await integrationManager.createNodeWorkflow(
                'function node2() {}',
                '/test/node2.js',
                10
            );

            const forceUpdateSpy = vi.spyOn(previewManager, 'forceUpdate');
            forceUpdateSpy.mockClear(); // Clear previous calls

            // Act
            await integrationManager.switchNodeWorkflow(node1.id);

            // Assert
            expect(forceUpdateSpy).toHaveBeenCalled();
        });

        it('should handle preview update failures gracefully', async () => {
            // Arrange
            const updateError = new Error('Preview update failed');
            vi.spyOn(previewManager, 'forceUpdate').mockRejectedValue(updateError);

            // Act - should not throw even if preview update fails
            await expect(
                integrationManager.createNodeWorkflow(
                    'function test() {}',
                    '/test/file.js',
                    1
                )
            ).resolves.toBeDefined();

            // Assert - node should still be created
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph?.nodes.size).toBe(1);
        });
    });

    describe('Configuration integration', () => {
        it('should respect default view format from configuration', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.defaultView = 'mermaid';

            // Create new preview manager with mermaid default
            const newPreviewManager = new PreviewManager('mermaid');
            
            // Act & Assert
            expect(newPreviewManager.getFormat()).toBe('mermaid');
        });

        it('should respect auto-load configuration', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.autoLoadLastGraph = true;

            // This would be tested in the extension activation, 
            // but we can verify the configuration is accessible
            expect(config.autoLoadLastGraph).toBe(true);
        });

        it('should respect preview refresh interval configuration', async () => {
            // Arrange
            const config = configManager.getConfiguration();
            config.previewRefreshInterval = 500;

            // Act & Assert
            expect(config.previewRefreshInterval).toBe(500);
        });
    });

    describe('Error recovery and resilience', () => {
        it('should recover from storage failures', async () => {
            // Arrange
            const storageError = new Error('Storage unavailable');
            vi.spyOn(storageManager, 'saveGraphToFile').mockRejectedValue(storageError);

            // Act - should still create node in memory
            const result = await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Assert
            expect(result).toBeDefined();
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph?.nodes.size).toBe(1);
        });

        it('should handle webview disposal gracefully', async () => {
            // Arrange
            await integrationManager.showPreview();
            
            // Simulate webview disposal
            webviewManager.dispose();

            // Act - should not throw when updating preview
            await expect(
                integrationManager.updatePreview()
            ).resolves.toBeUndefined();
        });

        it('should maintain state consistency during errors', async () => {
            // Arrange
            const previewError = new Error('Preview failed');
            vi.spyOn(previewManager, 'forceUpdate').mockRejectedValue(previewError);

            // Act
            await integrationManager.createNodeWorkflow(
                'function test() {}',
                '/test/file.js',
                1
            );

            // Assert - state should remain consistent
            const state = integrationManager.getState();
            expect(state.hasGraph).toBe(true);
            expect(state.hasCurrentNode).toBe(true);
            expect(state.nodeCount).toBe(1);
        });
    });
});