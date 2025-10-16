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
import { Node } from '../models/Node';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
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
                postMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            dispose: vi.fn(),
            reveal: vi.fn()
        }))
    },
    commands: {
        executeCommand: vi.fn(),
        registerCommand: vi.fn()
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
    },
    MarkdownString: class {
        public value: string;
        constructor(value?: string) {
            this.value = value || '';
        }
        appendText(value: string) {
            this.value += value;
            return this;
        }
        appendMarkdown(value: string) {
            this.value += value;
            return this;
        }
    }
}));

describe('Bro Node End-to-End Integration Tests', () => {
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

    describe('Complete Bro Node Workflow: Root → Child → Bro Node', () => {
        it('should create root node, then child node, then bro node successfully', async () => {
            // Step 1: Create root node
            const rootNode = await integrationManager.createNodeWorkflow(
                'function parentFunction() {',
                '/test/parent.ts',
                10
            );

            // Verify root node creation
            expect(rootNode).toBeDefined();
            expect(rootNode.name).toBe('function parentFunction() {');
            expect(rootNode.parentId).toBeNull();
            expect(nodeManager.getCurrentNode()?.id).toBe(rootNode.id);

            // Step 2: Create child node
            const childNode = await integrationManager.createChildNodeWorkflow(
                'const childVar = true;',
                '/test/child.ts',
                20
            );

            // Verify child node creation and relationships
            expect(childNode).toBeDefined();
            expect(childNode.name).toBe('const childVar = true;');
            expect(childNode.parentId).toBe(rootNode.id);
            expect(nodeManager.getCurrentNode()?.id).toBe(childNode.id);

            // Verify parent-child relationship
            const currentGraph = graphManager.getCurrentGraph()!;
            const updatedRootNode = currentGraph.nodes.get(rootNode.id)!;
            expect(updatedRootNode.childIds).toContain(childNode.id);

            // Step 3: Create bro node (sibling of child node)
            const broNode = await integrationManager.createBroNodeWorkflow(
                'const broVar = false;',
                '/test/bro.ts',
                30
            );

            // Verify bro node creation and relationships
            expect(broNode).toBeDefined();
            expect(broNode.name).toBe('const broVar = false;');
            expect(broNode.parentId).toBe(rootNode.id); // Same parent as child
            expect(nodeManager.getCurrentNode()?.id).toBe(broNode.id);

            // Verify sibling relationships
            const finalGraph = graphManager.getCurrentGraph()!;
            const finalRootNode = finalGraph.nodes.get(rootNode.id)!;
            expect(finalRootNode.childIds).toContain(childNode.id);
            expect(finalRootNode.childIds).toContain(broNode.id);
            expect(finalRootNode.childIds).toHaveLength(2);

            // Verify both siblings have same parent
            const finalChildNode = finalGraph.nodes.get(childNode.id)!;
            const finalBroNode = finalGraph.nodes.get(broNode.id)!;
            expect(finalChildNode.parentId).toBe(rootNode.id);
            expect(finalBroNode.parentId).toBe(rootNode.id);

            // Verify success messages were shown
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Created node:')
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Created child node:')
            );
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已创建兄弟节点:')
            );
        });

        it('should verify node relationships are correctly established', async () => {
            // Create the hierarchy: root → child → bro
            const rootNode = await integrationManager.createNodeWorkflow(
                'function main() {',
                '/test/main.ts',
                1
            );

            const childNode = await integrationManager.createChildNodeWorkflow(
                'if (condition) {',
                '/test/condition.ts',
                10
            );

            const broNode = await integrationManager.createBroNodeWorkflow(
                'else {',
                '/test/else.ts',
                15
            );

            // Verify the complete graph structure
            const graph = graphManager.getCurrentGraph()!;
            expect(graph.nodes.size).toBe(3);

            // Verify root node
            const root = graph.nodes.get(rootNode.id)!;
            expect(root.parentId).toBeNull();
            expect(root.childIds).toHaveLength(2);
            expect(root.childIds).toContain(childNode.id);
            expect(root.childIds).toContain(broNode.id);

            // Verify child node
            const child = graph.nodes.get(childNode.id)!;
            expect(child.parentId).toBe(rootNode.id);
            expect(child.childIds).toHaveLength(0);

            // Verify bro node
            const bro = graph.nodes.get(broNode.id)!;
            expect(bro.parentId).toBe(rootNode.id);
            expect(bro.childIds).toHaveLength(0);

            // Verify they are siblings (same parent, different IDs)
            expect(child.parentId).toBe(bro.parentId);
            expect(child.id).not.toBe(bro.id);
        });

        it('should verify preview panel correctly updates after each step', async () => {
            const updateSpy = vi.spyOn(integrationManager, 'updatePreview');

            // Step 1: Create root node
            await integrationManager.createNodeWorkflow(
                'function start() {',
                '/test/start.ts',
                1
            );
            expect(updateSpy).toHaveBeenCalledTimes(1);

            // Step 2: Create child node
            await integrationManager.createChildNodeWorkflow(
                'console.log("child");',
                '/test/child.ts',
                5
            );
            expect(updateSpy).toHaveBeenCalledTimes(2);

            // Step 3: Create bro node
            await integrationManager.createBroNodeWorkflow(
                'console.log("bro");',
                '/test/bro.ts',
                10
            );
            expect(updateSpy).toHaveBeenCalledTimes(3);

            // Verify preview updates were called for each node creation
            expect(updateSpy).toHaveBeenCalled();
        });

        it('should verify status bar correctly updates after each step', async () => {
            const updateGraphInfoSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');
            const updateNodeInfoSpy = vi.spyOn(statusBarManager, 'updateCurrentNode');

            // Step 1: Create root node
            await integrationManager.createNodeWorkflow(
                'function root() {',
                '/test/root.ts',
                1
            );
            expect(updateGraphInfoSpy).toHaveBeenCalled();
            expect(updateNodeInfoSpy).toHaveBeenCalled();

            // Step 2: Create child node
            await integrationManager.createChildNodeWorkflow(
                'const child = 1;',
                '/test/child.ts',
                5
            );
            expect(updateGraphInfoSpy).toHaveBeenCalledTimes(2);
            expect(updateNodeInfoSpy).toHaveBeenCalledTimes(2);

            // Step 3: Create bro node
            await integrationManager.createBroNodeWorkflow(
                'const bro = 2;',
                '/test/bro.ts',
                10
            );
            expect(updateGraphInfoSpy).toHaveBeenCalledTimes(3);
            expect(updateNodeInfoSpy).toHaveBeenCalledTimes(3);
        });
    });

    describe('Bro Node Creation on Root Nodes', () => {
        it('should create bro node when current node is a root node', async () => {
            // Step 1: Create first root node
            const rootNode1 = await integrationManager.createNodeWorkflow(
                'function firstRoot() {',
                '/test/root1.ts',
                1
            );

            // Verify it's a root node
            expect(rootNode1.parentId).toBeNull();
            expect(nodeManager.getCurrentNode()?.id).toBe(rootNode1.id);

            // Step 2: Create bro node (should become another root node)
            const broRootNode = await integrationManager.createBroNodeWorkflow(
                'function secondRoot() {',
                '/test/root2.ts',
                10
            );

            // Verify bro node is also a root node
            expect(broRootNode.parentId).toBeNull();
            expect(nodeManager.getCurrentNode()?.id).toBe(broRootNode.id);

            // Verify both are root nodes in the graph
            const graph = graphManager.getCurrentGraph()!;
            expect(graph.nodes.size).toBe(2);
            expect(graph.rootNodes).toContain(rootNode1.id);
            expect(graph.rootNodes).toContain(broRootNode.id);

            // Verify they are independent (no parent-child relationship)
            const root1 = graph.nodes.get(rootNode1.id)!;
            const root2 = graph.nodes.get(broRootNode.id)!;
            expect(root1.parentId).toBeNull();
            expect(root2.parentId).toBeNull();
            expect(root1.childIds).not.toContain(broRootNode.id);
            expect(root2.childIds).not.toContain(rootNode1.id);
        });

        it('should handle multiple root-level bro nodes', async () => {
            // Create first root node
            const root1 = await integrationManager.createNodeWorkflow(
                'function root1() {',
                '/test/root1.ts',
                1
            );

            // Create second root node (bro of first)
            const root2 = await integrationManager.createBroNodeWorkflow(
                'function root2() {',
                '/test/root2.ts',
                10
            );

            // Switch back to first root and create third root node
            nodeManager.setCurrentNode(root1.id);
            const root3 = await integrationManager.createBroNodeWorkflow(
                'function root3() {',
                '/test/root3.ts',
                20
            );

            // Verify all are root nodes
            const graph = graphManager.getCurrentGraph()!;
            expect(graph.nodes.size).toBe(3);
            expect(graph.rootNodes).toHaveLength(3);
            expect(graph.rootNodes).toContain(root1.id);
            expect(graph.rootNodes).toContain(root2.id);
            expect(graph.rootNodes).toContain(root3.id);

            // Verify all have null parent
            [root1, root2, root3].forEach(node => {
                const graphNode = graph.nodes.get(node.id)!;
                expect(graphNode.parentId).toBeNull();
            });
        });
    });

    describe('Multiple Bro Nodes Creation', () => {
        it('should create multiple bro nodes under same parent', async () => {
            // Create parent node
            const parentNode = await integrationManager.createNodeWorkflow(
                'function parent() {',
                '/test/parent.ts',
                1
            );

            // Create first child
            const child1 = await integrationManager.createChildNodeWorkflow(
                'const first = 1;',
                '/test/child1.ts',
                10
            );

            // Create first bro node
            const bro1 = await integrationManager.createBroNodeWorkflow(
                'const second = 2;',
                '/test/bro1.ts',
                20
            );

            // Switch back to first child and create another bro
            nodeManager.setCurrentNode(child1.id);
            const bro2 = await integrationManager.createBroNodeWorkflow(
                'const third = 3;',
                '/test/bro2.ts',
                30
            );

            // Switch to first bro and create another bro
            nodeManager.setCurrentNode(bro1.id);
            const bro3 = await integrationManager.createBroNodeWorkflow(
                'const fourth = 4;',
                '/test/bro3.ts',
                40
            );

            // Verify all siblings have same parent
            const graph = graphManager.getCurrentGraph()!;
            const parent = graph.nodes.get(parentNode.id)!;
            
            expect(parent.childIds).toHaveLength(4);
            expect(parent.childIds).toContain(child1.id);
            expect(parent.childIds).toContain(bro1.id);
            expect(parent.childIds).toContain(bro2.id);
            expect(parent.childIds).toContain(bro3.id);

            // Verify all children have same parent
            [child1, bro1, bro2, bro3].forEach(node => {
                const graphNode = graph.nodes.get(node.id)!;
                expect(graphNode.parentId).toBe(parentNode.id);
            });
        });

        it('should maintain correct node count in status bar', async () => {
            const updateGraphInfoSpy = vi.spyOn(statusBarManager, 'updateGraphInfo');

            // Create parent and multiple siblings
            await integrationManager.createNodeWorkflow('parent', '/test/parent.ts', 1);
            expect(updateGraphInfoSpy).toHaveBeenCalled();

            await integrationManager.createChildNodeWorkflow('child1', '/test/child1.ts', 10);
            await integrationManager.createBroNodeWorkflow('bro1', '/test/bro1.ts', 20);
            await integrationManager.createBroNodeWorkflow('bro2', '/test/bro2.ts', 30);

            // Verify status bar was updated for each node creation
            expect(updateGraphInfoSpy).toHaveBeenCalledTimes(4);

            // Verify final node count
            const graph = graphManager.getCurrentGraph()!;
            expect(graph.nodes.size).toBe(4);
        });
    });

    describe('Error Handling in Bro Node Workflow', () => {
        it('should handle no current node error', async () => {
            // Clear the current graph to ensure no current node
            graphManager.setCurrentGraph(null);

            // Attempt to create bro node
            await expect(
                integrationManager.createBroNodeWorkflow(
                    'const bro = true;',
                    '/test/bro.ts',
                    10
                )
            ).rejects.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });

        it('should handle empty selected text error', async () => {
            // Create a node first
            await integrationManager.createNodeWorkflow(
                'function test() {',
                '/test/test.ts',
                1
            );

            // Attempt to create bro node with empty text
            await expect(
                integrationManager.createBroNodeWorkflow(
                    '',
                    '/test/bro.ts',
                    10
                )
            ).rejects.toThrow('请先选择代码文本');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('请先选择代码文本')
            );
        });

        it('should handle whitespace-only selected text error', async () => {
            // Create a node first
            await integrationManager.createNodeWorkflow(
                'function test() {',
                '/test/test.ts',
                1
            );

            // Attempt to create bro node with whitespace-only text
            await expect(
                integrationManager.createBroNodeWorkflow(
                    '   \n\t  ',
                    '/test/bro.ts',
                    10
                )
            ).rejects.toThrow('请先选择代码文本');
        });

        it('should handle no active graph error', async () => {
            // Clear the current graph
            graphManager.setCurrentGraph(null);

            // Attempt to create bro node
            await expect(
                integrationManager.createBroNodeWorkflow(
                    'const bro = true;',
                    '/test/bro.ts',
                    10
                )
            ).rejects.toThrow();

            expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        });
    });

    describe('VS Code Context Updates', () => {
        it('should update VS Code context after bro node creation', async () => {
            // Create initial node
            await integrationManager.createNodeWorkflow(
                'function initial() {',
                '/test/initial.ts',
                1
            );

            // Create bro node
            await integrationManager.createBroNodeWorkflow(
                'function bro() {',
                '/test/bro.ts',
                10
            );

            // Verify context was updated
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext', 'codepath.hasCurrentNode', true
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext', 'codepath.hasCurrentGraph', true
            );
        });
    });

    describe('Auto-save Integration', () => {
        it('should trigger auto-save after bro node creation', async () => {
            // Enable auto-save
            const config = configManager.getConfiguration();
            config.autoSave = true;
            
            const saveSpy = vi.spyOn(graphManager, 'saveGraph');

            // Create initial node
            await integrationManager.createNodeWorkflow(
                'function initial() {',
                '/test/initial.ts',
                1
            );

            // Create bro node
            await integrationManager.createBroNodeWorkflow(
                'function bro() {',
                '/test/bro.ts',
                10
            );

            // Wait for debounced save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify save was called
            expect(saveSpy).toHaveBeenCalled();
        });
    });

    describe('Preview Panel Auto-Open', () => {
        it('should auto-open preview panel when not visible', async () => {
            // Mock webview as not visible
            vi.spyOn(webviewManager, 'isVisible').mockReturnValue(false);
            const showSpy = vi.spyOn(webviewManager, 'showPreview');

            // Create initial node
            await integrationManager.createNodeWorkflow(
                'function initial() {',
                '/test/initial.ts',
                1
            );

            // Create bro node
            await integrationManager.createBroNodeWorkflow(
                'function bro() {',
                '/test/bro.ts',
                10
            );

            // Verify preview panel was shown
            expect(showSpy).toHaveBeenCalled();
        });

        it('should not auto-open preview panel when already visible', async () => {
            // Mock webview as visible
            vi.spyOn(webviewManager, 'isVisible').mockReturnValue(true);
            const showSpy = vi.spyOn(webviewManager, 'showPreview');

            // Create initial node
            await integrationManager.createNodeWorkflow(
                'function initial() {',
                '/test/initial.ts',
                1
            );

            // Clear the spy calls from the first node creation
            showSpy.mockClear();

            // Create bro node
            await integrationManager.createBroNodeWorkflow(
                'function bro() {',
                '/test/bro.ts',
                10
            );

            // Verify preview panel show was not called for the bro node (already visible)
            expect(showSpy).not.toHaveBeenCalled();
        });
    });

    describe('Complex Hierarchical Scenarios', () => {
        it('should handle deep hierarchy with bro nodes at different levels', async () => {
            // Create root
            const root = await integrationManager.createNodeWorkflow(
                'function root() {',
                '/test/root.ts',
                1
            );

            // Create first level children
            const child1 = await integrationManager.createChildNodeWorkflow(
                'if (condition1) {',
                '/test/child1.ts',
                10
            );

            const bro1 = await integrationManager.createBroNodeWorkflow(
                'else if (condition2) {',
                '/test/bro1.ts',
                20
            );

            // Create second level under child1
            nodeManager.setCurrentNode(child1.id);
            const grandchild1 = await integrationManager.createChildNodeWorkflow(
                'console.log("gc1");',
                '/test/gc1.ts',
                30
            );

            const grandBro1 = await integrationManager.createBroNodeWorkflow(
                'console.log("gb1");',
                '/test/gb1.ts',
                40
            );

            // Create second level under bro1
            nodeManager.setCurrentNode(bro1.id);
            const grandchild2 = await integrationManager.createChildNodeWorkflow(
                'console.log("gc2");',
                '/test/gc2.ts',
                50
            );

            // Verify complex hierarchy - get fresh graph reference
            const graph = graphManager.getCurrentGraph()!;
            
            // Verify root level
            const rootNode = graph.nodes.get(root.id)!;
            expect(rootNode.childIds).toHaveLength(2);
            expect(rootNode.childIds).toContain(child1.id);
            expect(rootNode.childIds).toContain(bro1.id);

            // Verify first branch - get fresh node reference
            const child1Node = graph.nodes.get(child1.id)!;
            console.log('child1Node.childIds:', child1Node.childIds);
            console.log('grandchild1.id:', grandchild1.id);
            console.log('grandBro1.id:', grandBro1.id);
            console.log('All nodes in graph:', Array.from(graph.nodes.keys()));
            
            // Check if the grandchildren actually exist in the graph
            const gc1InGraph = graph.nodes.get(grandchild1.id);
            const gb1InGraph = graph.nodes.get(grandBro1.id);
            console.log('grandchild1 in graph:', !!gc1InGraph, gc1InGraph?.parentId);
            console.log('grandBro1 in graph:', !!gb1InGraph, gb1InGraph?.parentId);
            
            expect(child1Node.childIds).toHaveLength(2);
            expect(child1Node.childIds).toContain(grandchild1.id);
            expect(child1Node.childIds).toContain(grandBro1.id);

            // Verify second branch
            const bro1Node = graph.nodes.get(bro1.id)!;
            expect(bro1Node.childIds).toHaveLength(1);
            expect(bro1Node.childIds).toContain(grandchild2.id);

            // Verify grandchildren relationships
            expect(graph.nodes.get(grandchild1.id)!.parentId).toBe(child1.id);
            expect(graph.nodes.get(grandBro1.id)!.parentId).toBe(child1.id);
            expect(graph.nodes.get(grandchild2.id)!.parentId).toBe(bro1.id);
        });
    });
});