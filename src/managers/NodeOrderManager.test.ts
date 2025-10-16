import { NodeOrderManager } from './NodeOrderManager';
import { Node, Graph } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';

// Mock implementations
class MockNodeManager implements Partial<INodeManager> {
    public updateNodeCalls: Array<{ nodeId: string; updates: Partial<Node> }> = [];

    async updateNode(nodeId: string, updates: Partial<Node>): Promise<void> {
        this.updateNodeCalls.push({ nodeId, updates });
    }

    // Add other required methods as stubs
    async createNode(): Promise<Node> { throw new Error('Not implemented'); }
    async createChildNode(): Promise<Node> { throw new Error('Not implemented'); }
    async createParentNode(): Promise<Node> { throw new Error('Not implemented'); }
    async createBroNode(): Promise<Node> { throw new Error('Not implemented'); }
    async deleteNode(): Promise<void> { throw new Error('Not implemented'); }
    async deleteNodeWithChildren(): Promise<void> { throw new Error('Not implemented'); }
    findNodesByName(): Node[] { throw new Error('Not implemented'); }
    findNodesByLocation(): Node[] { throw new Error('Not implemented'); }
    async setCurrentNode(): Promise<void> { throw new Error('Not implemented'); }
    getCurrentNode(): Node | null { throw new Error('Not implemented'); }
    async validateNodeLocation(): Promise<any> { throw new Error('Not implemented'); }
    async relocateNode(): Promise<void> { throw new Error('Not implemented'); }
    async validateAllNodes(): Promise<any> { throw new Error('Not implemented'); }
    getLocationTracker(): any { throw new Error('Not implemented'); }
    dispose(): void { throw new Error('Not implemented'); }
}

class MockGraphManager implements Partial<IGraphManager> {
    private currentGraph: Graph | null = null;
    public saveGraphCalls: Graph[] = [];

    setMockGraph(graph: Graph | null): void {
        this.currentGraph = graph;
    }

    getCurrentGraph(): Graph | null {
        return this.currentGraph;
    }

    async saveGraph(graph: Graph): Promise<void> {
        this.saveGraphCalls.push(graph);
        this.currentGraph = graph;
    }

    // Add other required methods as stubs
    async createGraph(): Promise<Graph> { throw new Error('Not implemented'); }
    async loadGraph(): Promise<Graph> { throw new Error('Not implemented'); }
    async deleteGraph(): Promise<void> { throw new Error('Not implemented'); }
    async exportGraph(): Promise<string> { throw new Error('Not implemented'); }
    async importGraph(): Promise<Graph> { throw new Error('Not implemented'); }
    async listGraphs(): Promise<any[]> { throw new Error('Not implemented'); }
    setCurrentGraph(): void { throw new Error('Not implemented'); }
}

describe('NodeOrderManager', () => {
    let nodeOrderManager: NodeOrderManager;
    let mockNodeManager: MockNodeManager;
    let mockGraphManager: MockGraphManager;

    beforeEach(() => {
        mockNodeManager = new MockNodeManager();
        mockGraphManager = new MockGraphManager();
        nodeOrderManager = new NodeOrderManager(
            mockNodeManager as INodeManager,
            mockGraphManager as IGraphManager
        );
    });

    // Helper function to create a test graph
    const createTestGraph = (): Graph => {
        const node1: Node = {
            id: 'node1',
            name: 'Node 1',
            filePath: '/test/file1.ts',
            lineNumber: 1,
            createdAt: new Date(),
            parentId: null,
            childIds: ['child1', 'child2']
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

        const child1: Node = {
            id: 'child1',
            name: 'Child 1',
            filePath: '/test/file3.ts',
            lineNumber: 1,
            createdAt: new Date(),
            parentId: 'node1',
            childIds: []
        };

        const child2: Node = {
            id: 'child2',
            name: 'Child 2',
            filePath: '/test/file4.ts',
            lineNumber: 1,
            createdAt: new Date(),
            parentId: 'node1',
            childIds: []
        };

        return {
            id: 'test-graph',
            name: 'Test Graph',
            createdAt: new Date(),
            updatedAt: new Date(),
            nodes: new Map([
                ['node1', node1],
                ['node2', node2],
                ['child1', child1],
                ['child2', child2]
            ]),
            rootNodes: ['node1', 'node2'],
            currentNodeId: null
        };
    };

    describe('moveNodeUp', () => {
        it('should move root node up successfully', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeUp('node2');

            expect(result).toBe(true);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(1);
            expect(mockGraphManager.saveGraphCalls[0].rootNodes).toEqual(['node2', 'node1']);
        });

        it('should move child node up successfully', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeUp('child2');

            expect(result).toBe(true);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(1);
            expect(mockNodeManager.updateNodeCalls[0].nodeId).toBe('node1');
            expect(mockNodeManager.updateNodeCalls[0].updates.childIds).toEqual(['child2', 'child1']);
        });

        it('should return false when node is already at top (root)', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeUp('node1');

            expect(result).toBe(false);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(0);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(0);
        });

        it('should return false when child node is already at top', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeUp('child1');

            expect(result).toBe(false);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(0);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(0);
        });

        it('should throw error when node ID is invalid', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveNodeUp('')).rejects.toThrow('Node ID must be a non-empty string');
            await expect(nodeOrderManager.moveNodeUp(null as any)).rejects.toThrow('Node ID must be a non-empty string');
        });

        it('should throw error when no active graph', async () => {
            mockGraphManager.setMockGraph(null);

            await expect(nodeOrderManager.moveNodeUp('node1')).rejects.toThrow('No active graph found');
        });

        it('should throw error when node not found', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveNodeUp('nonexistent')).rejects.toThrow('Node with ID nonexistent not found');
        });
    });

    describe('moveNodeDown', () => {
        it('should move root node down successfully', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeDown('node1');

            expect(result).toBe(true);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(1);
            expect(mockGraphManager.saveGraphCalls[0].rootNodes).toEqual(['node2', 'node1']);
        });

        it('should move child node down successfully', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeDown('child1');

            expect(result).toBe(true);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(1);
            expect(mockNodeManager.updateNodeCalls[0].nodeId).toBe('node1');
            expect(mockNodeManager.updateNodeCalls[0].updates.childIds).toEqual(['child2', 'child1']);
        });

        it('should return false when node is already at bottom (root)', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeDown('node2');

            expect(result).toBe(false);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(0);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(0);
        });

        it('should return false when child node is already at bottom', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveNodeDown('child2');

            expect(result).toBe(false);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(0);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(0);
        });

        it('should throw error when node ID is invalid', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveNodeDown('')).rejects.toThrow('Node ID must be a non-empty string');
            await expect(nodeOrderManager.moveNodeDown(null as any)).rejects.toThrow('Node ID must be a non-empty string');
        });

        it('should throw error when no active graph', async () => {
            mockGraphManager.setMockGraph(null);

            await expect(nodeOrderManager.moveNodeDown('node1')).rejects.toThrow('No active graph found');
        });

        it('should throw error when node not found', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveNodeDown('nonexistent')).rejects.toThrow('Node with ID nonexistent not found');
        });
    });

    describe('canMoveUp', () => {
        it('should return true when root node can move up', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveUp('node2')).toBe(true);
        });

        it('should return true when child node can move up', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveUp('child2')).toBe(true);
        });

        it('should return false when node is at top', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveUp('node1')).toBe(false);
            expect(nodeOrderManager.canMoveUp('child1')).toBe(false);
        });

        it('should return false for invalid inputs', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveUp('')).toBe(false);
            expect(nodeOrderManager.canMoveUp(null as any)).toBe(false);
            expect(nodeOrderManager.canMoveUp('nonexistent')).toBe(false);
        });

        it('should return false when no active graph', () => {
            mockGraphManager.setMockGraph(null);

            expect(nodeOrderManager.canMoveUp('node1')).toBe(false);
        });
    });

    describe('canMoveDown', () => {
        it('should return true when root node can move down', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveDown('node1')).toBe(true);
        });

        it('should return true when child node can move down', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveDown('child1')).toBe(true);
        });

        it('should return false when node is at bottom', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveDown('node2')).toBe(false);
            expect(nodeOrderManager.canMoveDown('child2')).toBe(false);
        });

        it('should return false for invalid inputs', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.canMoveDown('')).toBe(false);
            expect(nodeOrderManager.canMoveDown(null as any)).toBe(false);
            expect(nodeOrderManager.canMoveDown('nonexistent')).toBe(false);
        });

        it('should return false when no active graph', () => {
            mockGraphManager.setMockGraph(null);

            expect(nodeOrderManager.canMoveDown('node1')).toBe(false);
        });
    });

    describe('getNodePosition', () => {
        it('should return correct position for root nodes', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.getNodePosition('node1')).toEqual({ position: 1, total: 2 });
            expect(nodeOrderManager.getNodePosition('node2')).toEqual({ position: 2, total: 2 });
        });

        it('should return correct position for child nodes', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.getNodePosition('child1')).toEqual({ position: 1, total: 2 });
            expect(nodeOrderManager.getNodePosition('child2')).toEqual({ position: 2, total: 2 });
        });

        it('should return null for invalid inputs', () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            expect(nodeOrderManager.getNodePosition('')).toBeNull();
            expect(nodeOrderManager.getNodePosition(null as any)).toBeNull();
            expect(nodeOrderManager.getNodePosition('nonexistent')).toBeNull();
        });

        it('should return null when no active graph', () => {
            mockGraphManager.setMockGraph(null);

            expect(nodeOrderManager.getNodePosition('node1')).toBeNull();
        });
    });

    describe('moveToPosition', () => {
        it('should move root node to specific position', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveToPosition('node2', 1);

            expect(result).toBe(true);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(1);
            expect(mockGraphManager.saveGraphCalls[0].rootNodes).toEqual(['node2', 'node1']);
        });

        it('should move child node to specific position', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveToPosition('child2', 1);

            expect(result).toBe(true);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(1);
            expect(mockNodeManager.updateNodeCalls[0].nodeId).toBe('node1');
            expect(mockNodeManager.updateNodeCalls[0].updates.childIds).toEqual(['child2', 'child1']);
        });

        it('should return true when already at target position', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            const result = await nodeOrderManager.moveToPosition('node1', 1);

            expect(result).toBe(true);
            expect(mockGraphManager.saveGraphCalls).toHaveLength(0);
            expect(mockNodeManager.updateNodeCalls).toHaveLength(0);
        });

        it('should throw error for invalid node ID', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveToPosition('', 1)).rejects.toThrow('Node ID must be a non-empty string');
            await expect(nodeOrderManager.moveToPosition(null as any, 1)).rejects.toThrow('Node ID must be a non-empty string');
        });

        it('should throw error for invalid target position', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveToPosition('node1', 0)).rejects.toThrow('Target position must be a positive number');
            await expect(nodeOrderManager.moveToPosition('node1', -1)).rejects.toThrow('Target position must be a positive number');
            await expect(nodeOrderManager.moveToPosition('node1', 3)).rejects.toThrow('Target position 3 is out of range (1-2)');
        });

        it('should throw error when no active graph', async () => {
            mockGraphManager.setMockGraph(null);

            await expect(nodeOrderManager.moveToPosition('node1', 1)).rejects.toThrow('No active graph found');
        });

        it('should throw error when node not found', async () => {
            const graph = createTestGraph();
            mockGraphManager.setMockGraph(graph);

            await expect(nodeOrderManager.moveToPosition('nonexistent', 1)).rejects.toThrow('Node with ID nonexistent not found');
        });
    });

    describe('edge cases', () => {
        it('should handle single node scenarios', () => {
            const singleNodeGraph: Graph = {
                id: 'single-graph',
                name: 'Single Node Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map([
                    ['single', {
                        id: 'single',
                        name: 'Single Node',
                        filePath: '/test/single.ts',
                        lineNumber: 1,
                        createdAt: new Date(),
                        parentId: null,
                        childIds: []
                    }]
                ]),
                rootNodes: ['single'],
                currentNodeId: null
            };

            mockGraphManager.setMockGraph(singleNodeGraph);

            expect(nodeOrderManager.canMoveUp('single')).toBe(false);
            expect(nodeOrderManager.canMoveDown('single')).toBe(false);
            expect(nodeOrderManager.getNodePosition('single')).toEqual({ position: 1, total: 1 });
        });

        it('should handle empty graph', () => {
            const emptyGraph: Graph = {
                id: 'empty-graph',
                name: 'Empty Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map(),
                rootNodes: [],
                currentNodeId: null
            };

            mockGraphManager.setMockGraph(emptyGraph);

            expect(nodeOrderManager.canMoveUp('nonexistent')).toBe(false);
            expect(nodeOrderManager.canMoveDown('nonexistent')).toBe(false);
            expect(nodeOrderManager.getNodePosition('nonexistent')).toBeNull();
        });

        it('should handle missing parent node gracefully', async () => {
            const corruptedGraph: Graph = {
                id: 'corrupted-graph',
                name: 'Corrupted Graph',
                createdAt: new Date(),
                updatedAt: new Date(),
                nodes: new Map([
                    ['orphan', {
                        id: 'orphan',
                        name: 'Orphan Node',
                        filePath: '/test/orphan.ts',
                        lineNumber: 1,
                        createdAt: new Date(),
                        parentId: 'missing-parent',
                        childIds: []
                    }]
                ]),
                rootNodes: [],
                currentNodeId: null
            };

            mockGraphManager.setMockGraph(corruptedGraph);

            await expect(nodeOrderManager.moveNodeUp('orphan')).rejects.toThrow('Parent node with ID missing-parent not found');
        });
    });
});