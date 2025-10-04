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
import { PerformanceMonitor } from '../managers/PerformanceMonitor';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
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

describe('Performance Integration Tests', () => {
    let integrationManager: IntegrationManager;
    let graphManager: GraphManager;
    let nodeManager: NodeManager;
    let previewManager: PreviewManager;
    let performanceMonitor: PerformanceMonitor;
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
        performanceMonitor = new PerformanceMonitor(configManager);

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

    describe('Large graph performance', () => {
        it('should handle 100 nodes within performance limits', async () => {
            // Arrange
            const startTime = performance.now();
            const maxNodes = 100;

            // Act
            for (let i = 0; i < maxNodes; i++) {
                await integrationManager.createNodeWorkflow(
                    `performance_node_${i}`,
                    `/test/perf_${i}.ts`,
                    i + 1
                );
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Assert
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(maxNodes);
        });

        it('should maintain preview performance with large graphs', async () => {
            // Arrange - Create a large graph
            for (let i = 0; i < 50; i++) {
                await integrationManager.createNodeWorkflow(
                    `large_graph_node_${i}`,
                    `/test/large_${i}.ts`,
                    i + 1
                );
            }

            // Act
            const startTime = performance.now();
            await previewManager.updatePreview();
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Assert
            expect(duration).toBeLessThan(2000); // Preview should update within 2 seconds
        });

        it('should handle deep hierarchies efficiently', async () => {
            // Arrange - Create a 20-level deep hierarchy
            let currentNodeId: string | null = null;
            const startTime = performance.now();

            for (let i = 0; i < 20; i++) {
                if (currentNodeId) {
                    nodeManager.setCurrentNode(currentNodeId);
                    const result = await integrationManager.createChildNodeWorkflow(
                        `deep_node_${i}`,
                        `/test/deep_${i}.ts`,
                        i + 1
                    );
                    currentNodeId = result.id;
                } else {
                    const result = await integrationManager.createNodeWorkflow(
                        `root_deep_node`,
                        `/test/deep_root.ts`,
                        1
                    );
                    currentNodeId = result.id;
                }
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Assert
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(20);
        });
    });

    describe('Memory usage optimization', () => {
        it('should not leak memory during rapid operations', async () => {
            // Arrange
            const initialMemory = process.memoryUsage().heapUsed;

            // Act - Perform many operations
            for (let cycle = 0; cycle < 5; cycle++) {
                // Create nodes
                for (let i = 0; i < 20; i++) {
                    await integrationManager.createNodeWorkflow(
                        `memory_test_${cycle}_${i}`,
                        `/test/memory_${cycle}_${i}.ts`,
                        i + 1
                    );
                }

                // Update preview multiple times
                for (let i = 0; i < 10; i++) {
                    await previewManager.updatePreview();
                }

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Assert - Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });

        it('should properly dispose of resources', () => {
            // Arrange
            const initialSubscriptions = mockContext.subscriptions.length;

            // Act - Create and dispose multiple managers
            for (let i = 0; i < 10; i++) {
                const tempManager = new IntegrationManager(
                    graphManager,
                    nodeManager,
                    previewManager,
                    new WebviewManager(mockContext),
                    new StatusBarManager(),
                    new ConfigurationManager(),
                    mockContext
                );
                tempManager.dispose();
            }

            // Assert - Should not accumulate subscriptions
            expect(mockContext.subscriptions.length).toBeLessThanOrEqual(initialSubscriptions + 5);
        });
    });

    describe('Concurrent operations', () => {
        it('should handle concurrent node creation', async () => {
            // Act - Create nodes concurrently
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(
                    integrationManager.createNodeWorkflow(
                        `concurrent_node_${i}`,
                        `/test/concurrent_${i}.ts`,
                        i + 1
                    )
                );
            }

            const results = await Promise.all(promises);

            // Assert
            expect(results).toHaveLength(20);
            expect(graphManager.getCurrentGraph()?.nodes.size).toBe(20);
            
            // All nodes should have unique IDs
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(20);
        });

        it('should handle concurrent preview updates', async () => {
            // Arrange
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Act - Trigger multiple concurrent preview updates
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(previewManager.updatePreview());
            }

            // Should not throw errors
            await expect(Promise.all(promises)).resolves.toBeDefined();
        });

        it('should handle concurrent graph operations', async () => {
            // Act - Perform concurrent graph operations
            const promises = [
                graphManager.createGraph('Graph 1'),
                graphManager.createGraph('Graph 2'),
                graphManager.createGraph('Graph 3')
            ];

            const results = await Promise.all(promises);

            // Assert
            expect(results).toHaveLength(3);
            expect(results[0].name).toBe('Graph 1');
            expect(results[1].name).toBe('Graph 2');
            expect(results[2].name).toBe('Graph 3');
        });
    });

    describe('Performance monitoring', () => {
        it('should track operation performance', async () => {
            // Act
            const metrics = performanceMonitor.startOperation('node_creation');
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);
            performanceMonitor.endOperation(metrics);

            // Assert
            const stats = performanceMonitor.getOperationStats('node_creation');
            expect(stats.count).toBe(1);
            expect(stats.averageTime).toBeGreaterThan(0);
        });

        it('should detect performance bottlenecks', async () => {
            // Arrange - Simulate slow operation
            const slowOperation = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return integrationManager.createNodeWorkflow('slow', '/test/slow.ts', 1);
            };

            // Act
            const metrics = performanceMonitor.startOperation('slow_operation');
            await slowOperation();
            performanceMonitor.endOperation(metrics);

            // Assert
            const stats = performanceMonitor.getOperationStats('slow_operation');
            expect(stats.averageTime).toBeGreaterThan(100);
        });

        it('should provide memory usage statistics', () => {
            // Act
            const memoryStats = performanceMonitor.getMemoryStats();

            // Assert
            expect(memoryStats.heapUsed).toBeGreaterThan(0);
            expect(memoryStats.heapTotal).toBeGreaterThan(0);
            expect(memoryStats.external).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Scalability limits', () => {
        it('should warn when approaching node limits', async () => {
            // Arrange
            const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
            
            // Mock configuration to set low limit for testing
            vi.spyOn(configManager, 'getConfiguration').mockReturnValue({
                maxNodesPerGraph: 5
            } as any);

            // Act - Create nodes up to the limit
            for (let i = 0; i < 6; i++) {
                await integrationManager.createNodeWorkflow(
                    `limit_node_${i}`,
                    `/test/limit_${i}.ts`,
                    i + 1
                );
            }

            // Assert
            expect(warnSpy).toHaveBeenCalled();
        });

        it('should handle preview timeout gracefully', async () => {
            // Arrange - Mock a slow renderer
            vi.spyOn(previewManager, 'renderPreview').mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 6000)); // 6 second delay
                return 'slow preview';
            });

            // Act & Assert - Should not hang indefinitely
            const startTime = Date.now();
            await previewManager.updatePreview();
            const duration = Date.now() - startTime;
            
            // Should timeout within reasonable time
            expect(duration).toBeLessThan(7000);
        });
    });

    describe('Resource cleanup', () => {
        it('should clean up after graph deletion', async () => {
            // Arrange
            const graph = await graphManager.createGraph('Test Graph');
            await integrationManager.createNodeWorkflow('test', '/test/file.ts', 1);

            // Act
            await graphManager.deleteGraph(graph.id);

            // Assert - Should not have references to deleted graph
            expect(graphManager.getCurrentGraph()).toBeNull();
        });

        it('should handle webview disposal properly', () => {
            // Arrange
            const webviewManager = new WebviewManager(mockContext);
            const disposeSpy = vi.fn();
            
            // Mock webview panel
            const mockPanel = {
                webview: { html: '', onDidReceiveMessage: vi.fn(), postMessage: vi.fn() },
                onDidDispose: vi.fn(),
                dispose: disposeSpy
            };
            
            (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);

            // Act
            webviewManager.showPreview();
            webviewManager.dispose();

            // Assert
            expect(disposeSpy).toHaveBeenCalled();
        });
    });
});