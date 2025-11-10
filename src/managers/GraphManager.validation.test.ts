import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GraphManager } from './GraphManager';
import { Graph as GraphModel } from '../models/Graph';
import { Node } from '../models/Node';
import { IStorageManager } from '../interfaces/IStorageManager';

// Create mock instance
const mockValidateLocation = vi.fn();
const mockDispose = vi.fn();

// Mock LocationTracker
vi.mock('./LocationTracker', () => ({
    LocationTracker: vi.fn().mockImplementation(() => ({
        validateLocation: mockValidateLocation,
        dispose: mockDispose
    }))
}));

const mockStorageManager: IStorageManager = {
    saveGraphToFile: vi.fn(),
    loadGraphFromFile: vi.fn(),
    deleteGraphFile: vi.fn(),
    ensureWorkspaceDirectory: vi.fn(),
    workspaceDirectoryExists: vi.fn(),
    getGraphsDirectory: vi.fn(),
    saveConfiguration: vi.fn(),
    loadConfiguration: vi.fn(),
    isWorkspaceAccessible: vi.fn(),
    listGraphs: vi.fn(),
    getCurrentGraphId: vi.fn(),
    setCurrentGraphId: vi.fn(),
    backupGraph: vi.fn(),
    restoreFromBackup: vi.fn(),
    getStorageStats: vi.fn(),
    exportGraphToMarkdown: vi.fn(),
    getWorkspaceRootPath: vi.fn(() => '/workspace')
};

describe('GraphManager - Node Location Validation on Load', () => {
    let graphManager: GraphManager;

    beforeEach(() => {
        vi.clearAllMocks();
        graphManager = new GraphManager(mockStorageManager);
    });

    describe('loadGraph with validation', () => {
        it('should validate node locations when loading a graph', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node1 = new Node('node1', 'ValidNode', 'test.ts', 10, 'const x = 1;');
            const node2 = new Node('node2', 'InvalidNode', 'missing.ts', 20, 'const y = 2;');
            
            graph.addNode(node1);
            graph.addNode(node2);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation results
            mockValidateLocation
                .mockResolvedValueOnce({
                    isValid: true,
                    confidence: 'exact'
                })
                .mockResolvedValueOnce({
                    isValid: false,
                    confidence: 'failed',
                    reason: 'File not found'
                });

            // Act
            const result = await graphManager.loadGraph(graphId);

            // Assert
            expect(mockValidateLocation).toHaveBeenCalledTimes(2);
            expect(mockDispose).toHaveBeenCalled();
            
            // Check that the graph was loaded
            expect(result.id).toBe(graphId);
        });

        it('should mark nodes with validation warnings when code snippet not found', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node = new Node('node1', 'TestNode', 'test.ts', 10, 'const x = 1;');
            graph.addNode(node);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation failure
            mockValidateLocation.mockResolvedValue({
                isValid: false,
                confidence: 'failed',
                reason: 'Code snippet not found in file'
            });

            // Act
            await graphManager.loadGraph(graphId);

            // Assert
            const loadedNode = graph.getNode('node1');
            expect(loadedNode?.validationWarning).toBe('Code snippet not found in file');
        });

        it('should clear validation warnings for valid nodes', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node = new Node('node1', 'TestNode', 'test.ts', 10, 'const x = 1;');
            node.validationWarning = 'Old warning';
            graph.addNode(node);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation success
            mockValidateLocation.mockResolvedValue({
                isValid: true,
                confidence: 'exact'
            });

            // Act
            await graphManager.loadGraph(graphId);

            // Assert
            const loadedNode = graph.getNode('node1');
            expect(loadedNode?.validationWarning).toBeUndefined();
        });

        it('should skip validation for nodes without code snippets', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node = new Node('node1', 'TestNode', 'test.ts', 10);
            graph.addNode(node);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);

            // Act
            await graphManager.loadGraph(graphId);

            // Assert
            expect(mockValidateLocation).not.toHaveBeenCalled();
        });

        it('should handle validation errors gracefully', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node = new Node('node1', 'TestNode', 'test.ts', 10, 'const x = 1;');
            graph.addNode(node);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation error
            mockValidateLocation.mockRejectedValue(new Error('Validation failed'));

            // Act
            await graphManager.loadGraph(graphId);

            // Assert - should not throw, but mark node with warning
            const loadedNode = graph.getNode('node1');
            expect(loadedNode?.validationWarning).toBe('Validation failed');
        });

        it('should continue loading graph even if validation fails', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node = new Node('node1', 'TestNode', 'test.ts', 10, 'const x = 1;');
            graph.addNode(node);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation throwing an error
            mockValidateLocation.mockRejectedValue(new Error('Validation error'));

            // Act & Assert - should not throw
            const result = await graphManager.loadGraph(graphId);
            expect(result.id).toBe(graphId);
        });

        it('should validate multiple nodes and count warnings', async () => {
            // Arrange
            const graphId = 'test-graph';
            const graph = new GraphModel(graphId, 'Test Graph');
            
            const node1 = new Node('node1', 'Node1', 'test1.ts', 10, 'const x = 1;');
            const node2 = new Node('node2', 'Node2', 'test2.ts', 20, 'const y = 2;');
            const node3 = new Node('node3', 'Node3', 'test3.ts', 30, 'const z = 3;');
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
            
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(graph);
            
            // Mock validation results: 1 valid, 2 invalid
            mockValidateLocation
                .mockResolvedValueOnce({
                    isValid: true,
                    confidence: 'exact'
                })
                .mockResolvedValueOnce({
                    isValid: false,
                    confidence: 'failed',
                    reason: 'File not found'
                })
                .mockResolvedValueOnce({
                    isValid: false,
                    confidence: 'failed',
                    reason: 'Code snippet not found in file'
                });

            // Act
            await graphManager.loadGraph(graphId);

            // Assert
            expect(mockValidateLocation).toHaveBeenCalledTimes(3);
            
            const loadedNode1 = graph.getNode('node1');
            const loadedNode2 = graph.getNode('node2');
            const loadedNode3 = graph.getNode('node3');
            
            expect(loadedNode1?.validationWarning).toBeUndefined();
            expect(loadedNode2?.validationWarning).toBe('File not found');
            expect(loadedNode3?.validationWarning).toBe('Code snippet not found in file');
        });
    });
});
