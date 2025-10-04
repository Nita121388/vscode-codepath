import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GraphManager } from './GraphManager';
import { Graph as GraphModel } from '../models/Graph';
import { Node } from '../models/Node';
import { IStorageManager } from '../interfaces/IStorageManager';
import { Graph, GraphMetadata } from '../types';

// Mock StorageManager
const mockStorageManager: IStorageManager = {
    saveGraphToFile: vi.fn(),
    loadGraphFromFile: vi.fn(),
    deleteGraphFile: vi.fn(),
    ensureWorkspaceDirectory: vi.fn(),
    getGraphsDirectory: vi.fn(),
    backupGraph: vi.fn(),
    restoreFromBackup: vi.fn(),
    getCurrentGraphId: vi.fn(),
    listGraphs: vi.fn(),
    saveConfiguration: vi.fn(),
    loadConfiguration: vi.fn(),
    exportGraphToMarkdown: vi.fn(),
    isWorkspaceAccessible: vi.fn(),
    getStorageStats: vi.fn()
};

describe('GraphManager', () => {
    let graphManager: GraphManager;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Create new instance with mocked storage manager
        graphManager = new GraphManager(mockStorageManager);
    });

    describe('createGraph', () => {
        it('should create a new graph with default name', async () => {
            // Arrange
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.createGraph();

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toContain('Graph');
            expect(result.nodes).toBeInstanceOf(Map);
            expect(result.rootNodes).toEqual([]);
            expect(result.currentNodeId).toBeNull();
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should create a new graph with custom name', async () => {
            // Arrange
            const customName = 'My Custom Graph';
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.createGraph(customName);

            // Assert
            expect(result.name).toBe(customName);
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should set created graph as current graph', async () => {
            // Arrange
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.createGraph();
            const currentGraph = graphManager.getCurrentGraph();

            // Assert
            expect(currentGraph).toBeDefined();
            expect(currentGraph!.id).toBe(result.id);
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            (mockStorageManager.saveGraphToFile as Mock).mockRejectedValue(new Error('Storage error'));

            // Act & Assert
            await expect(graphManager.createGraph()).rejects.toThrow('Failed to create graph');
        });
    });

    describe('loadGraph', () => {
        it('should load graph by ID', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            const mockGraph = new GraphModel(graphId, 'Test Graph');
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(mockGraph);

            // Act
            const result = await graphManager.loadGraph(graphId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(graphId);
            expect(result.name).toBe('Test Graph');
            expect(mockStorageManager.loadGraphFromFile).toHaveBeenCalledWith(graphId);
        });

        it('should set loaded graph as current graph', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            const mockGraph = new GraphModel(graphId, 'Test Graph');
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(mockGraph);

            // Act
            await graphManager.loadGraph(graphId);
            const currentGraph = graphManager.getCurrentGraph();

            // Assert
            expect(currentGraph).toBeDefined();
            expect(currentGraph!.id).toBe(graphId);
        });

        it('should throw error for invalid graph ID', async () => {
            // Act & Assert
            await expect(graphManager.loadGraph('')).rejects.toThrow('Graph ID must be a non-empty string');
            await expect(graphManager.loadGraph(null as any)).rejects.toThrow('Graph ID must be a non-empty string');
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            (mockStorageManager.loadGraphFromFile as Mock).mockRejectedValue(new Error('Graph not found'));

            // Act & Assert
            await expect(graphManager.loadGraph(graphId)).rejects.toThrow('Failed to load graph test-graph-id');
        });
    });

    describe('saveGraph', () => {
        it('should save graph successfully', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.saveGraph(graph.toJSON());

            // Assert
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should update current graph when saving same graph', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            graphManager.setCurrentGraph(graph.toJSON());
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const updatedGraph = graph.toJSON();
            updatedGraph.name = 'Updated Name';
            await graphManager.saveGraph(updatedGraph);

            // Assert
            const currentGraph = graphManager.getCurrentGraph();
            expect(currentGraph!.name).toBe('Updated Name');
        });

        it('should throw error for invalid graph data', async () => {
            // Act & Assert
            await expect(graphManager.saveGraph(null as any)).rejects.toThrow('Invalid graph data');
            await expect(graphManager.saveGraph({} as any)).rejects.toThrow('Invalid graph data');
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            (mockStorageManager.saveGraphToFile as Mock).mockRejectedValue(new Error('Storage error'));

            // Act & Assert
            await expect(graphManager.saveGraph(graph.toJSON())).rejects.toThrow('Failed to save graph test-id');
        });
    });

    describe('deleteGraph', () => {
        it('should delete graph successfully', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            (mockStorageManager.deleteGraphFile as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.deleteGraph(graphId);

            // Assert
            expect(mockStorageManager.deleteGraphFile).toHaveBeenCalledWith(graphId);
        });

        it('should clear current graph when deleting current graph', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            const graph = new GraphModel(graphId, 'Test Graph');
            graphManager.setCurrentGraph(graph.toJSON());
            (mockStorageManager.deleteGraphFile as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.deleteGraph(graphId);

            // Assert
            expect(graphManager.getCurrentGraph()).toBeNull();
        });

        it('should throw error for invalid graph ID', async () => {
            // Act & Assert
            await expect(graphManager.deleteGraph('')).rejects.toThrow('Graph ID must be a non-empty string');
            await expect(graphManager.deleteGraph(null as any)).rejects.toThrow('Graph ID must be a non-empty string');
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            (mockStorageManager.deleteGraphFile as Mock).mockRejectedValue(new Error('Delete failed'));

            // Act & Assert
            await expect(graphManager.deleteGraph(graphId)).rejects.toThrow('Failed to delete graph test-graph-id');
        });
    });

    describe('exportGraph', () => {
        it('should export graph to markdown', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act
            const result = await graphManager.exportGraph(graph.toJSON(), 'md');

            // Assert
            expect(result).toContain('# Test Graph');
            expect(result).toContain('<!-- CodePath Graph Data - DO NOT EDIT BELOW THIS LINE -->');
            expect(result).toContain('"id": "test-id"');
        });

        it('should throw error for unsupported format', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act & Assert
            await expect(graphManager.exportGraph(graph.toJSON(), 'pdf' as any)).rejects.toThrow('Unsupported export format: pdf');
        });

        it('should throw error for invalid graph data', async () => {
            // Act & Assert
            await expect(graphManager.exportGraph(null as any, 'md')).rejects.toThrow('Invalid graph data');
        });

        it('should export graph with code snippets', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            const node = new Node('node1', 'Test Node', '/test/file.ts', 10, 'const x = 1;');
            graph.addNode(node);

            // Act
            const result = await graphManager.exportGraph(graph.toJSON(), 'md');

            // Assert
            expect(result).toContain('- **Test Node**');
            expect(result).toContain('const x = 1;');
            expect(result).toContain('```ts');
        });
    });

    describe('importGraph', () => {
        it('should import graph from markdown content', async () => {
            // Arrange
            const markdownContent = '# Test Graph\n\nSome content';
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.importGraph(markdownContent);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Test Graph');
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should throw error for invalid content', async () => {
            // Act & Assert
            await expect(graphManager.importGraph('')).rejects.toThrow('Content must be a non-empty string');
            await expect(graphManager.importGraph(null as any)).rejects.toThrow('Content must be a non-empty string');
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            const markdownContent = '# Test Graph';
            (mockStorageManager.saveGraphToFile as Mock).mockRejectedValue(new Error('Save failed'));

            // Act & Assert
            await expect(graphManager.importGraph(markdownContent)).rejects.toThrow('Failed to import graph');
        });
    });

    describe('listGraphs', () => {
        it('should list all graphs', async () => {
            // Arrange
            const mockGraphList = [
                {
                    id: 'graph1',
                    name: 'Graph 1',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    nodeCount: 5
                },
                {
                    id: 'graph2',
                    name: 'Graph 2',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    nodeCount: 3
                }
            ];
            (mockStorageManager.listGraphs as Mock).mockResolvedValue(mockGraphList);

            // Act
            const result = await graphManager.listGraphs();

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('graph1');
            expect(result[1].id).toBe('graph2');
            expect(mockStorageManager.listGraphs).toHaveBeenCalledOnce();
        });

        it('should return empty array when no graphs exist', async () => {
            // Arrange
            (mockStorageManager.listGraphs as Mock).mockResolvedValue([]);

            // Act
            const result = await graphManager.listGraphs();

            // Assert
            expect(result).toEqual([]);
        });

        it('should throw error when storage fails', async () => {
            // Arrange
            (mockStorageManager.listGraphs as Mock).mockRejectedValue(new Error('List failed'));

            // Act & Assert
            await expect(graphManager.listGraphs()).rejects.toThrow('Failed to list graphs');
        });
    });

    describe('getCurrentGraph', () => {
        it('should return null when no current graph', () => {
            // Act
            const result = graphManager.getCurrentGraph();

            // Assert
            expect(result).toBeNull();
        });

        it('should return current graph when set', () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            graphManager.setCurrentGraph(graph.toJSON());

            // Act
            const result = graphManager.getCurrentGraph();

            // Assert
            expect(result).toBeDefined();
            expect(result!.id).toBe('test-id');
            expect(result!.name).toBe('Test Graph');
        });
    });

    describe('setCurrentGraph', () => {
        it('should set current graph successfully', () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act
            graphManager.setCurrentGraph(graph.toJSON());
            const result = graphManager.getCurrentGraph();

            // Assert
            expect(result).toBeDefined();
            expect(result!.id).toBe('test-id');
        });

        it('should throw error for invalid graph data', () => {
            // Act & Assert
            // null is allowed to clear current graph
            expect(() => graphManager.setCurrentGraph(null)).not.toThrow();
            expect(() => graphManager.setCurrentGraph({} as any)).toThrow('Invalid graph data');
        });
    });

    describe('loadLastUsedGraph', () => {
        it('should load last used graph successfully', async () => {
            // Arrange
            const graphId = 'last-used-graph';
            const mockGraph = new GraphModel(graphId, 'Last Used Graph');
            (mockStorageManager.getCurrentGraphId as Mock).mockResolvedValue(graphId);
            (mockStorageManager.loadGraphFromFile as Mock).mockResolvedValue(mockGraph);

            // Act
            const result = await graphManager.loadLastUsedGraph();

            // Assert
            expect(result).toBeDefined();
            expect(result!.id).toBe(graphId);
            expect(mockStorageManager.getCurrentGraphId).toHaveBeenCalledOnce();
            expect(mockStorageManager.loadGraphFromFile).toHaveBeenCalledWith(graphId);
        });

        it('should return null when no last used graph', async () => {
            // Arrange
            (mockStorageManager.getCurrentGraphId as Mock).mockResolvedValue(null);

            // Act
            const result = await graphManager.loadLastUsedGraph();

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when loading fails', async () => {
            // Arrange
            const graphId = 'invalid-graph';
            (mockStorageManager.getCurrentGraphId as Mock).mockResolvedValue(graphId);
            (mockStorageManager.loadGraphFromFile as Mock).mockRejectedValue(new Error('Graph not found'));

            // Act
            const result = await graphManager.loadLastUsedGraph();

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('backupCurrentGraph', () => {
        it('should backup current graph successfully', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            graphManager.setCurrentGraph(graph.toJSON());
            (mockStorageManager.backupGraph as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.backupCurrentGraph();

            // Assert
            expect(mockStorageManager.backupGraph).toHaveBeenCalledOnce();
        });

        it('should throw error when no current graph', async () => {
            // Act & Assert
            await expect(graphManager.backupCurrentGraph()).rejects.toThrow('No current graph to backup');
        });

        it('should throw error when backup fails', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            graphManager.setCurrentGraph(graph.toJSON());
            (mockStorageManager.backupGraph as Mock).mockRejectedValue(new Error('Backup failed'));

            // Act & Assert
            await expect(graphManager.backupCurrentGraph()).rejects.toThrow('Failed to backup current graph');
        });
    });

    describe('restoreGraphFromBackup', () => {
        it('should restore graph from backup successfully', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            const mockGraph = new GraphModel(graphId, 'Restored Graph');
            (mockStorageManager.restoreFromBackup as Mock).mockResolvedValue(mockGraph);
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.restoreGraphFromBackup(graphId);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe(graphId);
            expect(mockStorageManager.restoreFromBackup).toHaveBeenCalledWith(graphId);
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should set restored graph as current graph', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            const mockGraph = new GraphModel(graphId, 'Restored Graph');
            (mockStorageManager.restoreFromBackup as Mock).mockResolvedValue(mockGraph);
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.restoreGraphFromBackup(graphId);
            const currentGraph = graphManager.getCurrentGraph();

            // Assert
            expect(currentGraph).toBeDefined();
            expect(currentGraph!.id).toBe(graphId);
        });

        it('should throw error for invalid graph ID', async () => {
            // Act & Assert
            await expect(graphManager.restoreGraphFromBackup('')).rejects.toThrow('Graph ID must be a non-empty string');
        });

        it('should throw error when restore fails', async () => {
            // Arrange
            const graphId = 'test-graph-id';
            (mockStorageManager.restoreFromBackup as Mock).mockRejectedValue(new Error('Restore failed'));

            // Act & Assert
            await expect(graphManager.restoreGraphFromBackup(graphId)).rejects.toThrow('Failed to restore graph test-graph-id from backup');
        });
    });

    describe('utility methods', () => {
        it('should get storage stats', async () => {
            // Arrange
            const mockStats = { graphCount: 5, totalSize: 1024, backupCount: 10 };
            (mockStorageManager.getStorageStats as Mock).mockResolvedValue(mockStats);

            // Act
            const result = await graphManager.getStorageStats();

            // Assert
            expect(result).toEqual(mockStats);
            expect(mockStorageManager.getStorageStats).toHaveBeenCalledOnce();
        });

        it('should check workspace accessibility', async () => {
            // Arrange
            (mockStorageManager.isWorkspaceAccessible as Mock).mockResolvedValue(true);

            // Act
            const result = await graphManager.isWorkspaceAccessible();

            // Assert
            expect(result).toBe(true);
            expect(mockStorageManager.isWorkspaceAccessible).toHaveBeenCalledOnce();
        });

        it('should ensure workspace setup', async () => {
            // Arrange
            (mockStorageManager.ensureWorkspaceDirectory as Mock).mockResolvedValue(undefined);

            // Act
            await graphManager.ensureWorkspaceSetup();

            // Assert
            expect(mockStorageManager.ensureWorkspaceDirectory).toHaveBeenCalledOnce();
        });
    });
});