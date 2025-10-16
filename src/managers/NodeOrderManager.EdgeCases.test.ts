import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NodeOrderManager } from './NodeOrderManager';
import { Node, Graph } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';

describe('NodeOrderManager - Edge Cases and Error Handling', () => {
    let nodeOrderManager: NodeOrderManager;
    let mockNodeManager: INodeManager;
    let mockGraphManager: IGraphManager;
    let mockGraph: Graph;

    beforeEach(() => {
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
        };

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
        };

        nodeOrderManager = new NodeOrderManager(mockNodeManager, mockGraphManager);

        // Default test graph
        mockGraph = {
            id: 'test-graph',
            name: 'Test Graph',
            createdAt: new Date(),
            updatedAt: new Date(),
            nodes: new Map(),
            rootNodes: [],
            currentNodeId: null
        };

        (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);
    });

    describe('Boundary position movement tests', () => {
        it('should handle moving node up when already at top position', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.rootNodes = ['node1', 'node2'];

            // Try to move first node up (should return false)
            const result = await nodeOrderManager.moveNodeUp('node1');
            expect(result).toBe(false);

            // Verify no save operations were called
            expect(mockGraphManager.saveGraph).not.toHaveBeenCalled();
            expect(mockNodeManager.updateNode).not.toHaveBeenCalled();
        });

        it('should handle moving node down when already at bottom position', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.rootNodes = ['node1', 'node2'];

            // Try to move last node down (should return false)
            const result = await nodeOrderManager.moveNodeDown('node2');
            expect(result).toBe(false);

            // Verify no save operations were called
            expect(mockGraphManager.saveGraph).not.toHaveBeenCalled();
            expect(mockNodeManager.updateNode).not.toHaveBeenCalled();
        });

        it('should handle single node scenarios', async () => {
            const singleNode: Node = {
                id: 'single',
                name: 'Single Node',
                filePath: '/test/single.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('single', singleNode);
            mockGraph.rootNodes = ['single'];

            // Single node cannot move up or down
            expect(await nodeOrderManager.moveNodeUp('single')).toBe(false);
            expect(await nodeOrderManager.moveNodeDown('single')).toBe(false);

            // Position should be 1 of 1
            expect(nodeOrderManager.getNodePosition('single')).toEqual({
                position: 1,
                total: 1
            });

            // Cannot move in any direction
            expect(nodeOrderManager.canMoveUp('single')).toBe(false);
            expect(nodeOrderManager.canMoveDown('single')).toBe(false);
        });

        it('should handle empty graph scenarios', async () => {
            mockGraph.nodes.clear();
            mockGraph.rootNodes = [];

            // All operations should throw errors for empty graph
            await expect(nodeOrderManager.moveNodeUp('nonexistent')).rejects.toThrow('Node with ID nonexistent not found');
            await expect(nodeOrderManager.moveNodeDown('nonexistent')).rejects.toThrow('Node with ID nonexistent not found');
            expect(nodeOrderManager.canMoveUp('nonexistent')).toBe(false);
            expect(nodeOrderManager.canMoveDown('nonexistent')).toBe(false);
            expect(nodeOrderManager.getNodePosition('nonexistent')).toBeNull();
        });

        it('should handle child node at boundary positions', async () => {
            const parent: Node = {
                id: 'parent',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child1', 'child2']
            };

            const child1: Node = {
                id: 'child1',
                name: 'Child 1',
                filePath: '/test/child1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            const child2: Node = {
                id: 'child2',
                name: 'Child 2',
                filePath: '/test/child2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            mockGraph.nodes.set('parent', parent);
            mockGraph.nodes.set('child1', child1);
            mockGraph.nodes.set('child2', child2);
            mockGraph.rootNodes = ['parent'];

            // First child cannot move up
            expect(await nodeOrderManager.moveNodeUp('child1')).toBe(false);
            expect(nodeOrderManager.canMoveUp('child1')).toBe(false);

            // Last child cannot move down
            expect(await nodeOrderManager.moveNodeDown('child2')).toBe(false);
            expect(nodeOrderManager.canMoveDown('child2')).toBe(false);
        });
    });

    describe('Invalid input handling', () => {
        it('should handle null and undefined node IDs', async () => {
            await expect(nodeOrderManager.moveNodeUp(null as any)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(nodeOrderManager.moveNodeDown(undefined as any)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(nodeOrderManager.moveToPosition(null as any, 1)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );
        });

        it('should handle empty string node IDs', async () => {
            await expect(nodeOrderManager.moveNodeUp('')).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(nodeOrderManager.moveNodeDown('')).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            expect(nodeOrderManager.canMoveUp('')).toBe(false);
            expect(nodeOrderManager.canMoveDown('')).toBe(false);
            expect(nodeOrderManager.getNodePosition('')).toBeNull();
        });

        it('should handle non-string node IDs', async () => {
            await expect(nodeOrderManager.moveNodeUp(123 as any)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(nodeOrderManager.moveNodeDown({} as any)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(nodeOrderManager.moveToPosition([] as any, 1)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );
        });

        it('should handle invalid target positions in moveToPosition', async () => {
            const node: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('test-node', node);
            mockGraph.rootNodes = ['test-node'];

            // Zero position
            await expect(nodeOrderManager.moveToPosition('test-node', 0)).rejects.toThrow(
                'Target position must be a positive number'
            );

            // Negative position
            await expect(nodeOrderManager.moveToPosition('test-node', -1)).rejects.toThrow(
                'Target position must be a positive number'
            );

            // Position out of range
            await expect(nodeOrderManager.moveToPosition('test-node', 5)).rejects.toThrow(
                'Target position 5 is out of range (1-1)'
            );

            // Non-number position
            await expect(nodeOrderManager.moveToPosition('test-node', 'invalid' as any)).rejects.toThrow(
                'Target position must be a positive number'
            );
        });
    });

    describe('Graph state error handling', () => {
        it('should handle null graph scenarios', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            await expect(nodeOrderManager.moveNodeUp('test-node')).rejects.toThrow(
                'No active graph found'
            );

            await expect(nodeOrderManager.moveNodeDown('test-node')).rejects.toThrow(
                'No active graph found'
            );

            await expect(nodeOrderManager.moveToPosition('test-node', 1)).rejects.toThrow(
                'No active graph found'
            );

            expect(nodeOrderManager.canMoveUp('test-node')).toBe(false);
            expect(nodeOrderManager.canMoveDown('test-node')).toBe(false);
            expect(nodeOrderManager.getNodePosition('test-node')).toBeNull();
        });

        it('should handle graph manager throwing errors', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockImplementation(() => {
                throw new Error('Graph access denied');
            });

            await expect(nodeOrderManager.moveNodeUp('test-node')).rejects.toThrow(
                'Failed to move node up: Error: Graph access denied'
            );

            await expect(nodeOrderManager.moveNodeDown('test-node')).rejects.toThrow(
                'Failed to move node down: Error: Graph access denied'
            );
        });

        it('should handle missing nodes in graph', async () => {
            // Graph has no nodes
            mockGraph.nodes.clear();
            mockGraph.rootNodes = ['nonexistent'];

            await expect(nodeOrderManager.moveNodeUp('nonexistent')).rejects.toThrow(
                'Node with ID nonexistent not found'
            );

            await expect(nodeOrderManager.moveNodeDown('nonexistent')).rejects.toThrow(
                'Node with ID nonexistent not found'
            );
        });

        it('should handle corrupted parent-child relationships', async () => {
            const orphanChild: Node = {
                id: 'orphan',
                name: 'Orphan Child',
                filePath: '/test/orphan.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'missing-parent', // Parent doesn't exist
                childIds: []
            };

            mockGraph.nodes.set('orphan', orphanChild);

            await expect(nodeOrderManager.moveNodeUp('orphan')).rejects.toThrow(
                'Parent node with ID missing-parent not found'
            );

            await expect(nodeOrderManager.moveNodeDown('orphan')).rejects.toThrow(
                'Parent node with ID missing-parent not found'
            );
        });

        it('should handle inconsistent root nodes list', async () => {
            const node: Node = {
                id: 'real-node',
                name: 'Real Node',
                filePath: '/test/real.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('real-node', node);
            mockGraph.rootNodes = ['real-node', 'fake-node']; // fake-node doesn't exist

            // Should handle missing root nodes gracefully
            const result = await nodeOrderManager.moveNodeUp('real-node');
            expect(result).toBe(false); // Can't move up because it's effectively first
        });
    });

    describe('Node manager operation failures', () => {
        it('should handle node update failures', async () => {
            const parent: Node = {
                id: 'parent',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child1', 'child2']
            };

            const child1: Node = {
                id: 'child1',
                name: 'Child 1',
                filePath: '/test/child1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            const child2: Node = {
                id: 'child2',
                name: 'Child 2',
                filePath: '/test/child2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            mockGraph.nodes.set('parent', parent);
            mockGraph.nodes.set('child1', child1);
            mockGraph.nodes.set('child2', child2);
            mockGraph.rootNodes = ['parent'];

            (mockNodeManager.updateNode as Mock).mockRejectedValue(
                new Error('Update operation failed')
            );

            await expect(nodeOrderManager.moveNodeUp('child2')).rejects.toThrow(
                'Failed to swap siblings: Error: Update operation failed'
            );
        });

        it('should handle graph save failures', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.rootNodes = ['node1', 'node2'];

            (mockGraphManager.saveGraph as Mock).mockRejectedValue(
                new Error('Save operation failed')
            );

            await expect(nodeOrderManager.moveNodeUp('node2')).rejects.toThrow(
                'Failed to swap siblings: Error: Save operation failed'
            );
        });

        it('should handle permission denied errors', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.rootNodes = ['node1', 'node2'];

            (mockGraphManager.saveGraph as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot save graph')
            );

            await expect(nodeOrderManager.moveNodeUp('node2')).rejects.toThrow(
                'Failed to swap siblings: Error: Permission denied: Cannot save graph'
            );
        });
    });

    describe('Concurrent operation handling', () => {
        it('should handle concurrent move operations on same node', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node3: Node = {
                id: 'node3',
                name: 'Node 3',
                filePath: '/test/file3.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.nodes.set('node3', node3);
            mockGraph.rootNodes = ['node1', 'node2', 'node3'];

            // Simulate concurrent operations
            const moveUpPromise = nodeOrderManager.moveNodeUp('node2');
            const moveDownPromise = nodeOrderManager.moveNodeDown('node2');

            const results = await Promise.all([moveUpPromise, moveDownPromise]);

            // At least one should succeed
            expect(results.some(result => result === true)).toBe(true);
        });

        it('should handle concurrent operations on different nodes', async () => {
            const parent: Node = {
                id: 'parent',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child1', 'child2', 'child3']
            };

            const child1: Node = {
                id: 'child1',
                name: 'Child 1',
                filePath: '/test/child1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            const child2: Node = {
                id: 'child2',
                name: 'Child 2',
                filePath: '/test/child2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            const child3: Node = {
                id: 'child3',
                name: 'Child 3',
                filePath: '/test/child3.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent',
                childIds: []
            };

            mockGraph.nodes.set('parent', parent);
            mockGraph.nodes.set('child1', child1);
            mockGraph.nodes.set('child2', child2);
            mockGraph.nodes.set('child3', child3);
            mockGraph.rootNodes = ['parent'];

            // Move different children concurrently
            const promises = [
                nodeOrderManager.moveNodeDown('child1'),
                nodeOrderManager.moveNodeUp('child3')
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(2);
        });

        it('should handle rapid sequential operations', async () => {
            const nodes: Node[] = [];
            for (let i = 1; i <= 10; i++) {
                const node: Node = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: `/test/file${i}.ts`,
                    lineNumber: 1,
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };
                nodes.push(node);
                mockGraph.nodes.set(node.id, node);
            }

            mockGraph.rootNodes = nodes.map(n => n.id);

            // Perform rapid sequential moves
            const operations = [];
            for (let i = 0; i < 20; i++) {
                const nodeId = `node${(i % 10) + 1}`;
                if (i % 2 === 0) {
                    operations.push(nodeOrderManager.moveNodeUp(nodeId));
                } else {
                    operations.push(nodeOrderManager.moveNodeDown(nodeId));
                }
            }

            const results = await Promise.all(operations);
            expect(results).toHaveLength(20);
        });
    });

    describe('Data corruption scenarios', () => {
        it('should handle corrupted childIds arrays', async () => {
            const parent: Node = {
                id: 'parent',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: null as any // Corrupted data
            };

            mockGraph.nodes.set('parent', parent);
            mockGraph.rootNodes = ['parent'];

            // Should handle gracefully
            expect(nodeOrderManager.canMoveUp('parent')).toBe(false);
            expect(nodeOrderManager.canMoveDown('parent')).toBe(false);
        });

        it('should handle corrupted rootNodes array', async () => {
            const node: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('test-node', node);
            mockGraph.rootNodes = null as any; // Corrupted data

            expect(nodeOrderManager.canMoveUp('test-node')).toBe(false);
            expect(nodeOrderManager.canMoveDown('test-node')).toBe(false);
        });

        it('should handle nodes with invalid parent references', async () => {
            const node: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'invalid-parent',
                childIds: []
            };

            mockGraph.nodes.set('test-node', node);

            await expect(nodeOrderManager.moveNodeUp('test-node')).rejects.toThrow(
                'Parent node with ID invalid-parent not found'
            );
        });

        it('should handle circular parent-child relationships', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'node2',
                childIds: ['node2']
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'node1',
                childIds: ['node1']
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);

            // This should handle circular references gracefully
            const result = await nodeOrderManager.moveNodeUp('node1');
            expect(result).toBe(false); // Should return false for circular references
        });
    });

    describe('Large dataset handling', () => {
        it('should handle graphs with many root nodes', async () => {
            const nodeCount = 1000;
            const nodes: Node[] = [];

            for (let i = 0; i < nodeCount; i++) {
                const node: Node = {
                    id: `node${i}`,
                    name: `Node ${i}`,
                    filePath: `/test/file${i}.ts`,
                    lineNumber: 1,
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };
                nodes.push(node);
                mockGraph.nodes.set(node.id, node);
            }

            mockGraph.rootNodes = nodes.map(n => n.id);

            // Test operations on large dataset
            const result1 = await nodeOrderManager.moveNodeUp('node500');
            expect(result1).toBe(true);

            const result2 = await nodeOrderManager.moveNodeDown('node0');
            expect(result2).toBe(true);

            const position = nodeOrderManager.getNodePosition('node999');
            expect(position?.total).toBe(nodeCount);
        });

        it('should handle nodes with many children', async () => {
            const childCount = 1000;
            const parent: Node = {
                id: 'parent',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: Array.from({ length: childCount }, (_, i) => `child${i}`)
            };

            mockGraph.nodes.set('parent', parent);

            for (let i = 0; i < childCount; i++) {
                const child: Node = {
                    id: `child${i}`,
                    name: `Child ${i}`,
                    filePath: `/test/child${i}.ts`,
                    lineNumber: 1,
                    createdAt: new Date(),
                    parentId: 'parent',
                    childIds: []
                };
                mockGraph.nodes.set(child.id, child);
            }

            mockGraph.rootNodes = ['parent'];

            // Test operations on node with many children
            const result = await nodeOrderManager.moveNodeUp('child500');
            expect(result).toBe(true);

            const position = nodeOrderManager.getNodePosition('child999');
            expect(position?.total).toBe(childCount);
        });

        it('should handle deep node hierarchies', async () => {
            const depth = 100;
            let currentParent: string | null = null;

            for (let i = 0; i < depth; i++) {
                const node: Node = {
                    id: `deep${i}`,
                    name: `Deep Node ${i}`,
                    filePath: `/test/deep${i}.ts`,
                    lineNumber: 1,
                    createdAt: new Date(),
                    parentId: currentParent,
                    childIds: i < depth - 1 ? [`deep${i + 1}`] : []
                };

                mockGraph.nodes.set(node.id, node);

                if (i === 0) {
                    mockGraph.rootNodes = [node.id];
                }

                currentParent = node.id;
            }

            // Test operations on deep hierarchy
            const leafNode = `deep${depth - 1}`;
            expect(nodeOrderManager.canMoveUp(leafNode)).toBe(false);
            expect(nodeOrderManager.canMoveDown(leafNode)).toBe(false);

            const position = nodeOrderManager.getNodePosition(leafNode);
            expect(position).toEqual({ position: 1, total: 1 });
        });
    });

    describe('Memory and performance edge cases', () => {
        it('should handle repeated operations without memory leaks', async () => {
            const node1: Node = {
                id: 'node1',
                name: 'Node 1',
                filePath: '/test/file1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const node2: Node = {
                id: 'node2',
                name: 'Node 2',
                filePath: '/test/file2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('node1', node1);
            mockGraph.nodes.set('node2', node2);
            mockGraph.rootNodes = ['node1', 'node2'];

            // Perform many operations
            for (let i = 0; i < 1000; i++) {
                await nodeOrderManager.moveNodeUp('node2');
                await nodeOrderManager.moveNodeDown('node1');
            }

            // Should still work correctly
            expect(nodeOrderManager.canMoveUp('node2')).toBe(true);
            expect(nodeOrderManager.canMoveDown('node1')).toBe(true);
        });

        it('should handle operations with very long node names and paths', async () => {
            const longName = 'A'.repeat(10000);
            const longPath = '/very/long/path/' + 'directory/'.repeat(100) + 'file.ts';

            const node: Node = {
                id: 'long-node',
                name: longName,
                filePath: longPath,
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('long-node', node);
            mockGraph.rootNodes = ['long-node'];

            const position = nodeOrderManager.getNodePosition('long-node');
            expect(position).toEqual({ position: 1, total: 1 });

            expect(nodeOrderManager.canMoveUp('long-node')).toBe(false);
            expect(nodeOrderManager.canMoveDown('long-node')).toBe(false);
        });
    });
});