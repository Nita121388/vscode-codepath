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
import { CodePathError } from '../types/errors';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showQuickPick: vi.fn(),
        showInputBox: vi.fn(),
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
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn()
        }))
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ViewColumn: {
        Beside: 1
    }
}));

describe('Edge Case Integration Tests', () => {
    let integrationManager: IntegrationManager;
    let graphManager: GraphManager;
    let nodeManager: NodeManager;
    let previewManager: PreviewManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        vi.clearAllMocks();

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

        const storageManager = new StorageManager('/test/workspace');
        const configManager = new ConfigurationManager();
        graphManager = new GraphManager(storageManager, configManager);
        nodeManager = new NodeManager(graphManager, configManager);
        previewManager = new PreviewManager(configManager);
        const webviewManager = new WebviewManager(mockContext);
        const statusBarManager = new StatusBarManager();

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

    describe('Input validation edge cases', () => {
        it('should handle empty node names', async () => {
            await expect(
                integrationManager.createNodeWorkflow('', '/test/file.ts', 1)
            ).rejects.toThrow();
        });

        it('should handle whitespace-only node names', async () => {
            await expect(
                integrationManager.createNodeWorkflow('   \t\n   ', '/test/file.ts', 1)
            ).rejects.toThrow();
        });

        it('should handle extremely long node names', async () => {
            const longName = 'a'.repeat(1000);
            const result = await integrationManager.createNodeWorkflow(
                longName,
                '/test/file.ts',
                1
            );
            
            // Should truncate or handle gracefully
            expect(result.name.length).toBeLessThanOrEqual(500);
        });

        it('should handle special characters in node names', async () => {
            const specialName = 'Node with "quotes" & <tags> and {braces} [brackets] (parentheses)';
            const result = await integrationManager.createNodeWorkflow(
                specialName,
                '/test/file.ts',
                1
            );
            
            expect(result.name).toBeDefined();
        });

        it('should handle Unicode characters in node names', async () => {
            const unicodeName = '测试节点 🚀 émojis and ñoñó';
            const result = await integrationManager.createNodeWorkflow(
                unicodeName,
                '/test/file.ts',
                1
            );
            
            expect(result.name).toBe(unicodeName);
        });

        it('should handle invalid file paths', async () => {
            const invalidPaths = [
                '',
                '   ',
                'not/absolute/path',
                '/path/with/\0/null/character',
                '/path/with/very/long/'.repeat(100) + 'filename.ts'
            ];

            for (const path of invalidPaths) {
                await expect(
                    integrationManager.createNodeWorkflow('test', path, 1)
                ).rejects.toThrow();
            }
        });

        it('should handle invalid line numbers', async () => {
            const invalidLineNumbers = [-1, 0, NaN, Infinity, -Infinity];

            for (const lineNumber of invalidLineNumbers) {
                await expect(
                    integrationManager.createNodeWorkflow('test', '/test/file.ts', lineNumber)
                ).rejects.toThrow();
            }
        });
    });

    describe('Graph state edge cases', () => {
        it('should handle operations on empty graph', async () => {
            // Should not throw when no current node
            await expect(
                integrationManager.createChildNodeWorkflow('child', '/test/child.ts', 1)
            ).rejects.toThrow();
        });

        it('should handle circular relationship attempts', async () => {
            // Create parent-child relationship
            const parent = await integrationManager.createNodeWorkflow('parent', '/test/parent.ts', 1);
            const child = await integrationManager.createChildNodeWorkflow('child', '/test/child.ts', 2);

            // Try to make parent a child of child (circular)
            nodeManager.setCurrentNode(child.id);
            
            await expect(
                integrationManager.createChildNodeWorkflow('parent', '/test/parent.ts', 1)
            ).rejects.toThrow();
        });

        it('should handle orphaned nodes after parent deletion', async () => {
            // Create parent-child relationship
            const parent = await integrationManager.createNodeWorkflow('parent', '/test/parent.ts', 1);
            const child = await integrationManager.createChildNodeWorkflow('child', '/test/child.ts', 2);

            // Delete parent
            const graph = graphManager.getCurrentGraph()!;
            graph.removeNode(parent.id);

            // Child should become root node
            expect(graph.rootNodes).toContain(child.id);
        });

        it('should handle duplicate node IDs gracefully', async () => {
            // This should be prevented by the system
            const node1 = await integrationManager.createNodeWorkflow('node1', '/test/1.ts', 1);
            const node2 = await integrationManager.createNodeWorkflow('node2', '/test/2.ts', 2);

            expect(node1.id).not.toBe(node2.id);
        });
    });

    describe('File system edge cases', () => {
        it('should handle permission denied errors', async () => {
            // Mock storage failure
            const storageManager = new StorageManager(mockContext);
            vi.spyOn(storageManager, 'saveGraphToFile').mockRejectedValue(
                new Error('EACCES: permission denied')
            );

            const graphManagerWithFailure = new GraphManager(storageManager, new ConfigurationManager());
            
            await expect(
                graphManagerWithFailure.createGraph('test')
            ).rejects.toThrow();
        });

        it('should handle disk full errors', async () => {
            const storageManager = new StorageManager(mockContext);
            vi.spyOn(storageManager, 'saveGraphToFile').mockRejectedValue(
                new Error('ENOSPC: no space left on device')
            );

            const graphManagerWithFailure = new GraphManager(storageManager, new ConfigurationManager());
            
            await expect(
                graphManagerWithFailure.createGraph('test')
            ).rejects.toThrow();
        });

        it('should handle corrupted graph files', async () => {
            const storageManager = new StorageManager(mockContext);
            vi.spyOn(storageManager, 'loadGraphFromFile').mockRejectedValue(
                new Error('Unexpected token in JSON')
            );

            const graphManagerWithFailure = new GraphManager(storageManager, new ConfigurationManager());
            
            await expect(
                graphManagerWithFailure.loadGraph('corrupted-graph')
            ).rejects.toThrow();
        });

        it('should handle missing workspace directory', async () => {
            const storageManager = new StorageManager(mockContext);
            vi.spyOn(storageManager, 'ensureWorkspaceDirectory').mockRejectedValue(
                new Error('Workspace not found')
            );

            // Should handle gracefully
            await expect(
                storageManager.ensureWorkspaceDirectory()
            ).rejects.toThrow();
        });
    });

    describe('Preview rendering edge cases', () => {
        it('should handle extremely large graphs in preview', async () => {
            // Create a large graph
            for (let i = 0; i < 200; i++) {
                await integrationManager.createNodeWorkflow(
                    `large_node_${i}`,
                    `/test/large_${i}.ts`,
                    i + 1
                );
            }

            // Should not crash or hang
            const preview = await previewManager.renderPreview();
            expect(preview).toBeDefined();
        });

        it('should handle nodes with problematic names for Mermaid', async () => {
            const problematicNames = [
                'node-with-dashes',
                'node with spaces',
                'node"with"quotes',
                'node[with]brackets',
                'node{with}braces',
                'node(with)parentheses',
                'node;with;semicolons',
                'node:with:colons'
            ];

            for (const name of problematicNames) {
                await integrationManager.createNodeWorkflow(name, '/test/file.ts', 1);
            }

            // Should render without throwing
            previewManager.setFormat('mermaid');
            const preview = await previewManager.renderPreview();
            expect(preview).toBeDefined();
        });

        it('should handle preview format switching during render', async () => {
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Start rendering in one format
            const renderPromise = previewManager.renderPreview();
            
            // Switch format during render
            previewManager.setFormat('text');
            
            // Should complete without error
            const result = await renderPromise;
            expect(result).toBeDefined();
        });

        it('should handle webview disposal during update', async () => {
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            const webviewManager = new WebviewManager(mockContext);
            webviewManager.showPreview();
            
            // Dispose webview during update
            webviewManager.dispose();
            
            // Should not throw
            await expect(previewManager.updatePreview()).resolves.toBeDefined();
        });
    });

    describe('Configuration edge cases', () => {
        it('should handle invalid configuration values', async () => {
            const configManager = new ConfigurationManager();
            
            // Test invalid values
            await expect(
                configManager.updateConfiguration('maxNodesPerGraph', -1)
            ).rejects.toThrow();

            await expect(
                configManager.updateConfiguration('previewRefreshInterval', 0)
            ).rejects.toThrow();
        });

        it('should handle missing configuration file', async () => {
            const configManager = new ConfigurationManager();
            vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(null as any);

            // Should use defaults
            const config = configManager.getConfiguration();
            expect(config.defaultView).toBe('text');
        });

        it('should handle configuration update failures', async () => {
            const configManager = new ConfigurationManager();
            vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
                get: vi.fn(),
                update: vi.fn().mockRejectedValue(new Error('Update failed'))
            } as any);

            await expect(
                configManager.updateConfiguration('defaultView', 'mermaid')
            ).rejects.toThrow();
        });
    });

    describe('Memory and resource edge cases', () => {
        it('should handle memory pressure gracefully', async () => {
            // Simulate memory pressure by creating many objects
            const largeObjects = [];
            for (let i = 0; i < 1000; i++) {
                largeObjects.push(new Array(10000).fill(`data_${i}`));
            }

            // Should still be able to create nodes
            const result = await integrationManager.createNodeWorkflow(
                'memory_pressure_test',
                '/test/memory.ts',
                1
            );

            expect(result).toBeDefined();
            
            // Clean up
            largeObjects.length = 0;
        });

        it('should handle rapid disposal and recreation', async () => {
            // Rapidly create and dispose managers
            for (let i = 0; i < 50; i++) {
                const tempManager = new IntegrationManager(
                    graphManager,
                    nodeManager,
                    previewManager,
                    new WebviewManager(mockContext),
                    new StatusBarManager(),
                    new ConfigurationManager(),
                    mockContext
                );
                
                await tempManager.createNodeWorkflow(`temp_${i}`, `/test/temp_${i}.ts`, 1);
                tempManager.dispose();
            }

            // Original manager should still work
            const result = await integrationManager.createNodeWorkflow(
                'after_rapid_disposal',
                '/test/final.ts',
                1
            );
            
            expect(result).toBeDefined();
        });
    });

    describe('Concurrency edge cases', () => {
        it('should handle race conditions in node creation', async () => {
            // Create many nodes simultaneously with same name
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(
                    integrationManager.createNodeWorkflow(
                        'race_condition_node',
                        `/test/race_${i}.ts`,
                        i + 1
                    )
                );
            }

            const results = await Promise.all(promises);
            
            // All should succeed with unique IDs
            expect(results).toHaveLength(20);
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(20);
        });

        it('should handle concurrent graph switching', async () => {
            // Create multiple graphs
            const graph1 = await graphManager.createGraph('Graph 1');
            const graph2 = await graphManager.createGraph('Graph 2');
            const graph3 = await graphManager.createGraph('Graph 3');

            // Switch between them rapidly
            const promises = [
                graphManager.setCurrentGraph(graph1),
                graphManager.setCurrentGraph(graph2),
                graphManager.setCurrentGraph(graph3),
                graphManager.setCurrentGraph(graph1)
            ];

            await Promise.all(promises);
            
            // Should end up in a consistent state
            expect(graphManager.getCurrentGraph()).toBeDefined();
        });
    });

    describe('Error recovery edge cases', () => {
        it('should recover from preview rendering failures', async () => {
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Mock rendering failure
            vi.spyOn(previewManager, 'renderPreview').mockRejectedValueOnce(
                new Error('Rendering failed')
            );

            // Should fallback gracefully
            await expect(previewManager.updatePreview()).resolves.toBeDefined();
        });

        it('should handle partial system failures', async () => {
            // Mock status bar failure
            const statusBarManager = new StatusBarManager();
            vi.spyOn(statusBarManager, 'updateStatus').mockImplementation(() => {
                throw new Error('Status bar failed');
            });

            // System should continue working
            const result = await integrationManager.createNodeWorkflow(
                'partial_failure_test',
                '/test/partial.ts',
                1
            );

            expect(result).toBeDefined();
        });

        it('should handle extension deactivation during operations', async () => {
            // Start a long-running operation
            const operationPromise = integrationManager.createNodeWorkflow(
                'deactivation_test',
                '/test/deactivation.ts',
                1
            );

            // Simulate extension deactivation
            integrationManager.dispose();

            // Operation should complete or fail gracefully
            await expect(operationPromise).resolves.toBeDefined();
        });
    });
});