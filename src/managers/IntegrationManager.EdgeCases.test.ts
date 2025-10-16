import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { IntegrationManager } from './IntegrationManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { WebviewManager } from './WebviewManager';
import { StatusBarManager } from './StatusBarManager';
import { Node, Graph } from '../types';

// Mock VS Code
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn()
    },
    commands: {
        executeCommand: vi.fn()
    }
}));

describe('IntegrationManager - Edge Cases and Error Handling', () => {
    let integrationManager: IntegrationManager;
    let mockGraphManager: GraphManager;
    let mockNodeManager: NodeManager;
    let mockWebviewManager: WebviewManager;
    let mockStatusBarManager: StatusBarManager;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock managers
        mockGraphManager = {
            getCurrentGraph: vi.fn(),
            createGraph: vi.fn(),
            loadGraph: vi.fn(),
            saveGraph: vi.fn(),
            deleteGraph: vi.fn(),
            exportGraph: vi.fn(),
            importGraph: vi.fn(),
            listGraphs: vi.fn(),
            setCurrentGraph: vi.fn()
        } as any;

        mockNodeManager = {
            createNode: vi.fn(),
            createChildNode: vi.fn(),
            createParentNode: vi.fn(),
            createBroNode: vi.fn(),
            deleteNode: vi.fn(),
            deleteNodeWithChildren: vi.fn(),
            updateNode: vi.fn(),
            findNodesByName: vi.fn(),
            findNodesByLocation: vi.fn(),
            setCurrentNode: vi.fn(),
            getCurrentNode: vi.fn(),
            validateNodeLocation: vi.fn(),
            relocateNode: vi.fn(),
            validateAllNodes: vi.fn(),
            getLocationTracker: vi.fn(),
            dispose: vi.fn()
        } as any;

        mockWebviewManager = {
            showPreview: vi.fn(),
            updatePreview: vi.fn(),
            hidePreview: vi.fn(),
            toggleFormat: vi.fn(),
            dispose: vi.fn()
        } as any;

        mockStatusBarManager = {
            updateStatus: vi.fn(),
            showMessage: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn()
        } as any;

        integrationManager = new IntegrationManager(
            mockGraphManager,
            mockNodeManager,
            mockWebviewManager,
            mockStatusBarManager
        );
    });

    describe('Node creation workflow failures', () => {
        it('should handle node manager creation failures', async () => {
            (mockNodeManager.createNode as Mock).mockRejectedValue(
                new Error('Node creation failed: Permission denied')
            );

            await expect(
                integrationManager.createNodeWorkflow('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('Node creation failed: Permission denied');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('创建节点失败')
            );
        });

        it('should handle invalid input parameters', async () => {
            await expect(
                integrationManager.createNodeWorkflow('', '/test/file.ts', 10)
            ).rejects.toThrow();

            await expect(
                integrationManager.createNodeWorkflow('Test Node', '', 10)
            ).rejects.toThrow();

            await expect(
                integrationManager.createNodeWorkflow('Test Node', '/test/file.ts', -1)
            ).rejects.toThrow();
        });

        it('should handle null or undefined parameters', async () => {
            await expect(
                integrationManager.createNodeWorkflow(null as any, '/test/file.ts', 10)
            ).rejects.toThrow();

            await expect(
                integrationManager.createNodeWorkflow('Test Node', null as any, 10)
            ).rejects.toThrow();

            await expect(
                integrationManager.createNodeWorkflow('Test Node', '/test/file.ts', null as any)
            ).rejects.toThrow();
        });

        it('should handle extremely long node names', async () => {
            const longName = 'A'.repeat(10000);
            const mockNode: Node = {
                id: 'test-node',
                name: longName,
                filePath: '/test/file.ts',
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            const result = await integrationManager.createNodeWorkflow(longName, '/test/file.ts', 10);
            expect(result.name).toBe(longName);
        });

        it('should handle file paths with special characters', async () => {
            const specialPath = '/test/path with spaces/file-with-émojis🚀.ts';
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: specialPath,
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            const result = await integrationManager.createNodeWorkflow('Test Node', specialPath, 10);
            expect(result.filePath).toBe(specialPath);
        });
    });

    describe('Child node creation workflow failures', () => {
        it('should handle missing current node', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            await expect(
                integrationManager.createChildNodeWorkflow('Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('No current node selected');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('创建子节点失败')
            );
        });

        it('should handle corrupted current node data', async () => {
            const corruptedNode = {
                id: null,
                name: undefined,
                filePath: 123
            } as any;

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(corruptedNode);

            await expect(
                integrationManager.createChildNodeWorkflow('Child Node', '/test/file.ts', 10)
            ).rejects.toThrow();
        });

        it('should handle child node creation failures', async () => {
            const mockCurrentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 5,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createChildNode as Mock).mockRejectedValue(
                new Error('Child creation failed: Database error')
            );

            await expect(
                integrationManager.createChildNodeWorkflow('Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Child creation failed: Database error');
        });
    });

    describe('Parent node creation workflow failures', () => {
        it('should handle missing current node for parent creation', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            await expect(
                integrationManager.createParentNodeWorkflow('Parent Node', '/test/file.ts', 10)
            ).rejects.toThrow('No current node selected');
        });

        it('should handle parent node creation failures', async () => {
            const mockCurrentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 5,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createParentNode as Mock).mockRejectedValue(
                new Error('Parent creation failed: Circular reference detected')
            );

            await expect(
                integrationManager.createParentNodeWorkflow('Parent Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent creation failed: Circular reference detected');
        });

        it('should handle current node with existing parent', async () => {
            const mockCurrentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 5,
                createdAt: new Date(),
                parentId: 'existing-parent',
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createParentNode as Mock).mockRejectedValue(
                new Error('Node already has a parent')
            );

            await expect(
                integrationManager.createParentNodeWorkflow('Parent Node', '/test/file.ts', 10)
            ).rejects.toThrow('Node already has a parent');
        });
    });

    describe('Bro node creation workflow failures', () => {
        it('should handle missing current node for bro creation', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            await expect(
                integrationManager.createBroNodeWorkflow('Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('No current node selected');
        });

        it('should handle bro node creation failures', async () => {
            const mockCurrentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 5,
                createdAt: new Date(),
                parentId: 'parent-node',
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createBroNode as Mock).mockRejectedValue(
                new Error('Bro creation failed: Parent not found')
            );

            await expect(
                integrationManager.createBroNodeWorkflow('Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('Bro creation failed: Parent not found');
        });

        it('should handle orphan node (no parent) for bro creation', async () => {
            const mockCurrentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 5,
                createdAt: new Date(),
                parentId: null, // Orphan node
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createBroNode as Mock).mockRejectedValue(
                new Error('Cannot create sibling for root node')
            );

            await expect(
                integrationManager.createBroNodeWorkflow('Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('Cannot create sibling for root node');
        });
    });

    describe('Preview update failures', () => {
        it('should handle webview manager update failures', async () => {
            (mockWebviewManager.updatePreview as Mock).mockRejectedValue(
                new Error('Webview update failed: Rendering error')
            );

            await expect(integrationManager.updatePreview()).rejects.toThrow(
                'Webview update failed: Rendering error'
            );
        });

        it('should handle missing webview manager', async () => {
            (integrationManager as any).webviewManager = null;

            await expect(integrationManager.updatePreview()).rejects.toThrow();
        });

        it('should handle webview manager disposal during update', async () => {
            (mockWebviewManager.updatePreview as Mock).mockImplementation(async () => {
                // Simulate disposal during update
                throw new Error('WebView has been disposed');
            });

            await expect(integrationManager.updatePreview()).rejects.toThrow(
                'WebView has been disposed'
            );
        });

        it('should handle concurrent preview updates', async () => {
            let updateCount = 0;
            (mockWebviewManager.updatePreview as Mock).mockImplementation(async () => {
                updateCount++;
                // Simulate slow update
                await new Promise(resolve => setTimeout(resolve, 100));
                if (updateCount > 1) {
                    throw new Error('Concurrent update detected');
                }
            });

            const promises = [
                integrationManager.updatePreview(),
                integrationManager.updatePreview(),
                integrationManager.updatePreview()
            ];

            const results = await Promise.allSettled(promises);
            
            // At least one should fail due to concurrency
            const failures = results.filter(r => r.status === 'rejected');
            expect(failures.length).toBeGreaterThan(0);
        });
    });

    describe('Status bar update failures', () => {
        it('should handle status bar manager update failures', async () => {
            (mockStatusBarManager.updateStatus as Mock).mockImplementation(() => {
                throw new Error('Status bar update failed');
            });

            // Should not throw error, just handle gracefully
            await (integrationManager as any).updateStatusBar();

            expect(mockStatusBarManager.updateStatus).toHaveBeenCalled();
        });

        it('should handle missing status bar manager', async () => {
            (integrationManager as any).statusBarManager = null;

            // Should not throw error
            await (integrationManager as any).updateStatusBar();
        });

        it('should handle status bar manager disposal', async () => {
            (mockStatusBarManager.updateStatus as Mock).mockImplementation(() => {
                throw new Error('Status bar has been disposed');
            });

            // Should handle gracefully
            await (integrationManager as any).updateStatusBar();
        });
    });

    describe('Graph switching workflow failures', () => {
        it('should handle invalid graph ID', async () => {
            await expect(integrationManager.switchGraphWorkflow('')).rejects.toThrow();
            await expect(integrationManager.switchGraphWorkflow(null as any)).rejects.toThrow();
            await expect(integrationManager.switchGraphWorkflow(undefined as any)).rejects.toThrow();
        });

        it('should handle non-existent graph', async () => {
            (mockGraphManager.loadGraph as Mock).mockRejectedValue(
                new Error('Graph not found: invalid-graph-id')
            );

            await expect(
                integrationManager.switchGraphWorkflow('invalid-graph-id')
            ).rejects.toThrow('Graph not found: invalid-graph-id');
        });

        it('should handle graph loading failures', async () => {
            (mockGraphManager.loadGraph as Mock).mockRejectedValue(
                new Error('Graph loading failed: Corrupted data')
            );

            await expect(
                integrationManager.switchGraphWorkflow('test-graph-id')
            ).rejects.toThrow('Graph loading failed: Corrupted data');
        });

        it('should handle graph manager failures during switch', async () => {
            const mockGraph: Graph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            (mockGraphManager.loadGraph as Mock).mockResolvedValue(mockGraph);
            (mockGraphManager.setCurrentGraph as Mock).mockImplementation(() => {
                throw new Error('Failed to set current graph');
            });

            await expect(
                integrationManager.switchGraphWorkflow('test-graph-id')
            ).rejects.toThrow('Failed to set current graph');
        });
    });

    describe('Node switching workflow failures', () => {
        it('should handle invalid node ID', async () => {
            await expect(integrationManager.switchNodeWorkflow('')).rejects.toThrow();
            await expect(integrationManager.switchNodeWorkflow(null as any)).rejects.toThrow();
            await expect(integrationManager.switchNodeWorkflow(undefined as any)).rejects.toThrow();
        });

        it('should handle non-existent node', async () => {
            const mockGraph: Graph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);

            await expect(
                integrationManager.switchNodeWorkflow('non-existent-node')
            ).rejects.toThrow('Node not found: non-existent-node');
        });

        it('should handle node manager failures during switch', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const mockGraph: Graph = {
                id: 'test-graph',
                name: 'Test Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map([['test-node', mockNode]]),
                rootNodes: ['test-node'],
                currentNodeId: null
            };

            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);
            (mockNodeManager.setCurrentNode as Mock).mockRejectedValue(
                new Error('Failed to set current node')
            );

            await expect(
                integrationManager.switchNodeWorkflow('test-node')
            ).rejects.toThrow('Failed to set current node');
        });

        it('should handle missing graph during node switch', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            await expect(
                integrationManager.switchNodeWorkflow('test-node')
            ).rejects.toThrow('No active graph');
        });
    });

    describe('Component update failures', () => {
        it('should handle partial component update failures', async () => {
            (mockWebviewManager.updatePreview as Mock).mockResolvedValue(undefined);
            (mockStatusBarManager.updateStatus as Mock).mockImplementation(() => {
                throw new Error('Status update failed');
            });

            // Should complete preview update even if status update fails
            await integrationManager.updatePreview();

            expect(mockWebviewManager.updatePreview).toHaveBeenCalled();
            expect(mockStatusBarManager.updateStatus).toHaveBeenCalled();
        });

        it('should handle all component update failures', async () => {
            (mockWebviewManager.updatePreview as Mock).mockRejectedValue(
                new Error('Preview update failed')
            );
            (mockStatusBarManager.updateStatus as Mock).mockImplementation(() => {
                throw new Error('Status update failed');
            });

            await expect(integrationManager.updatePreview()).rejects.toThrow(
                'Preview update failed'
            );
        });

        it('should handle component disposal during updates', async () => {
            (mockWebviewManager.updatePreview as Mock).mockImplementation(async () => {
                // Simulate component disposal
                (integrationManager as any).webviewManager = null;
                throw new Error('Component disposed during update');
            });

            await expect(integrationManager.updatePreview()).rejects.toThrow(
                'Component disposed during update'
            );
        });
    });

    describe('Concurrent operation handling', () => {
        it('should handle concurrent node creation workflows', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    integrationManager.createNodeWorkflow(`Node ${i}`, `/test/file${i}.ts`, i + 1)
                );
            }

            const results = await Promise.all(promises);
            expect(results).toHaveLength(5);
            expect(mockNodeManager.createNode).toHaveBeenCalledTimes(5);
        });

        it('should handle concurrent preview updates', async () => {
            let updateCount = 0;
            (mockWebviewManager.updatePreview as Mock).mockImplementation(async () => {
                updateCount++;
                await new Promise(resolve => setTimeout(resolve, 50));
            });

            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push(integrationManager.updatePreview());
            }

            await Promise.all(promises);
            expect(updateCount).toBe(3);
        });

        it('should handle concurrent graph switches', async () => {
            const mockGraph1: Graph = {
                id: 'graph1',
                name: 'Graph 1',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            const mockGraph2: Graph = {
                id: 'graph2',
                name: 'Graph 2',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            (mockGraphManager.loadGraph as Mock)
                .mockResolvedValueOnce(mockGraph1)
                .mockResolvedValueOnce(mockGraph2);

            const promises = [
                integrationManager.switchGraphWorkflow('graph1'),
                integrationManager.switchGraphWorkflow('graph2')
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(2);
        });
    });

    describe('Memory and resource management', () => {
        it('should handle repeated workflow operations without memory leaks', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            // Perform many operations
            for (let i = 0; i < 100; i++) {
                await integrationManager.createNodeWorkflow(`Node ${i}`, `/test/file${i}.ts`, i + 1);
            }

            expect(mockNodeManager.createNode).toHaveBeenCalledTimes(100);
        });

        it('should handle large node data without performance issues', async () => {
            const largeCodeSnippet = 'A'.repeat(100000);
            const mockNode: Node = {
                id: 'large-node',
                name: 'Large Node',
                filePath: '/test/large-file.ts',
                lineNumber: 10,
                codeSnippet: largeCodeSnippet,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            const result = await integrationManager.createNodeWorkflow(
                'Large Node',
                '/test/large-file.ts',
                10
            );

            expect(result.codeSnippet).toBe(largeCodeSnippet);
        });

        it('should handle disposal during active workflows', async () => {
            (mockNodeManager.createNode as Mock).mockImplementation(async () => {
                // Simulate long-running operation
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    id: 'test-node',
                    name: 'Test Node',
                    filePath: '/test/file.ts',
                    lineNumber: 10,
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };
            });

            const workflowPromise = integrationManager.createNodeWorkflow(
                'Test Node',
                '/test/file.ts',
                10
            );

            // Dispose during operation
            integrationManager.dispose();

            const result = await workflowPromise;
            expect(result).toBeDefined();
        });
    });

    describe('Error recovery and resilience', () => {
        it('should recover from temporary component failures', async () => {
            // First update fails, second succeeds
            (mockWebviewManager.updatePreview as Mock)
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValue(undefined);

            await expect(integrationManager.updatePreview()).rejects.toThrow('Temporary failure');

            // Second attempt should succeed
            await integrationManager.updatePreview();
            expect(mockWebviewManager.updatePreview).toHaveBeenCalledTimes(2);
        });

        it('should handle component reinitialization after failures', async () => {
            (mockWebviewManager.updatePreview as Mock).mockRejectedValue(
                new Error('Component not initialized')
            );

            await expect(integrationManager.updatePreview()).rejects.toThrow(
                'Component not initialized'
            );

            // Simulate component reinitialization
            (mockWebviewManager.updatePreview as Mock).mockResolvedValue(undefined);

            await integrationManager.updatePreview();
            expect(mockWebviewManager.updatePreview).toHaveBeenCalledTimes(2);
        });

        it('should handle VS Code API unavailability', async () => {
            // Simulate VS Code API being unavailable
            (vscode.window as any).showErrorMessage = undefined;
            (vscode.window as any).showInformationMessage = undefined;

            (mockNodeManager.createNode as Mock).mockRejectedValue(
                new Error('Node creation failed')
            );

            // Should not throw additional errors due to missing VS Code API
            await expect(
                integrationManager.createNodeWorkflow('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('Node creation failed');
        });

        it('should handle partial workflow completion', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 10,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);
            (mockWebviewManager.updatePreview as Mock).mockRejectedValue(
                new Error('Preview update failed')
            );

            // Node should be created even if preview update fails
            const result = await integrationManager.createNodeWorkflow(
                'Test Node',
                '/test/file.ts',
                10
            );

            expect(result).toEqual(mockNode);
            expect(mockNodeManager.createNode).toHaveBeenCalled();
        });
    });
});