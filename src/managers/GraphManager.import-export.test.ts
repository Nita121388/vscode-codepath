import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GraphManager } from './GraphManager';
import { Graph as GraphModel } from '../models/Graph';
import { Node } from '../models/Node';
import { IStorageManager } from '../interfaces/IStorageManager';

// Mock StorageManager
const mockStorageManager: IStorageManager = {
    saveGraphToFile: vi.fn(),
    loadGraphFromFile: vi.fn(),
    deleteGraphFile: vi.fn(),
    ensureWorkspaceDirectory: vi.fn(),
    getGraphsDirectory: vi.fn(),
    backupGraph: vi.fn(),
    restoreFromBackup: vi.fn(),
    saveConfiguration: vi.fn(),
    loadConfiguration: vi.fn(),
    getCurrentGraphId: vi.fn(),
    listGraphs: vi.fn(),
    exportGraphToMarkdown: vi.fn(),
    isWorkspaceAccessible: vi.fn(),
    getStorageStats: vi.fn()
};

describe('GraphManager Import/Export', () => {
    let graphManager: GraphManager;

    beforeEach(() => {
        vi.clearAllMocks();
        graphManager = new GraphManager(mockStorageManager);
    });

    describe('exportGraph', () => {
        it('should export graph to markdown successfully', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            const node = new Node('node1', 'Test Node', '/test/file.ts', 10, 'console.log("test");');
            graph.addNode(node);

            // Act
            const result = await graphManager.exportGraph(graph.toJSON(), 'md');

            // Assert
            expect(result).toContain('# Test Graph');
            expect(result).toContain('**Nodes:** 1');
            expect(result).toContain('- **Test Node** (file.ts:10)');
            expect(result).toContain('console.log("test");');
            expect(result).toContain('<!-- CodePath Graph Data - DO NOT EDIT BELOW THIS LINE -->');
            expect(result).toContain('"id": "test-id"');
            expect(result).toContain('"name": "Test Graph"');
        });

        it('should validate export format', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act & Assert
            await expect(graphManager.exportGraph(graph.toJSON(), 'pdf' as any))
                .rejects.toThrow('Unsupported export format: pdf');
        });

        it('should validate graph data before export', async () => {
            // Act & Assert
            await expect(graphManager.exportGraph(null as any, 'md'))
                .rejects.toThrow('Invalid graph data');
                
            await expect(graphManager.exportGraph({} as any, 'md'))
                .rejects.toThrow('Invalid graph data');
        });

        it('should export graph without nodes', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act
            const result = await graphManager.exportGraph(graph.toJSON(), 'md');

            // Assert
            expect(result).toContain('# Test Graph');
            expect(result).toContain('**Nodes:** 0');
            expect(result).toContain('*No nodes in this graph*');
            expect(result).toContain('<!-- CodePath Graph Data - DO NOT EDIT BELOW THIS LINE -->');
        });
    });

    describe('importGraph', () => {
        it('should import simple markdown content', async () => {
            // Arrange
            const markdownContent = `# Test Graph

## Graph Structure

- **main_function** (main.ts:1)
  \`\`\`typescript
  function main() {
  \`\`\`
  - **helper_function** (utils.ts:5)
    \`\`\`typescript
    function helper() {
    \`\`\``;

            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.importGraph(markdownContent);

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('Test Graph');
            expect(result.nodes).toBeInstanceOf(Map);
            expect(mockStorageManager.saveGraphToFile).toHaveBeenCalledOnce();
        });

        it('should handle markdown without nodes', async () => {
            // Arrange
            const markdownContent = `# Empty Graph

This is just a heading with no nodes.`;

            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.importGraph(markdownContent);

            // Assert
            expect(result).toBeDefined();
            expect(result.name).toBe('Empty Graph');
            expect(result.nodes.size).toBe(0);
        });

        it('should validate markdown content', async () => {
            // Act & Assert
            await expect(graphManager.importGraph(''))
                .rejects.toThrow('Content must be a non-empty string');
                
            await expect(graphManager.importGraph(null as any))
                .rejects.toThrow('Content must be a non-empty string');
                
            await expect(graphManager.importGraph('   '))
                .rejects.toThrow('Markdown content cannot be empty');
                
            await expect(graphManager.importGraph('No headings here'))
                .rejects.toThrow('Markdown content must contain at least one heading');
        });

        it('should handle storage errors during import', async () => {
            // Arrange
            const markdownContent = '# Test Graph\n\n- **test** (test.ts:1)';
            (mockStorageManager.saveGraphToFile as Mock).mockRejectedValue(new Error('Storage error'));

            // Act & Assert
            await expect(graphManager.importGraph(markdownContent))
                .rejects.toThrow('Failed to import graph');
        });

        it('should parse hierarchical node structure', async () => {
            // Arrange
            const markdownContent = `# Hierarchical Graph

## Graph Structure

- **root_node** (root.ts:1)
  - **child_1** (child1.ts:10)
    - **grandchild_1** (gc1.ts:5)
  - **child_2** (child2.ts:20)`;

            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);

            // Act
            const result = await graphManager.importGraph(markdownContent);

            // Assert
            expect(result).toBeDefined();
            expect(result.nodes.size).toBe(4);
            expect(result.rootNodes).toHaveLength(1);
        });
    });

    describe('exportMultipleGraphs', () => {
        it.skip('should export multiple graphs to combined markdown', async () => {
            // This test is skipped due to file system mocking complexity
            // The functionality is tested through integration tests
        });

        it('should validate graph IDs array', async () => {
            // Act & Assert
            await expect(graphManager.exportMultipleGraphs([]))
                .rejects.toThrow('Graph IDs array must be non-empty');
                
            await expect(graphManager.exportMultipleGraphs(null as any))
                .rejects.toThrow('Graph IDs array must be non-empty');
        });

        it('should handle errors when loading graphs', async () => {
            // Arrange
            (mockStorageManager.loadGraphFromFile as Mock).mockRejectedValue(new Error('Graph not found'));

            // Act & Assert
            await expect(graphManager.exportMultipleGraphs(['invalid-id']))
                .rejects.toThrow('Failed to export multiple graphs');
        });
    });

    describe('importGraphFromFile', () => {
        it.skip('should import graph from file path', async () => {
            // This test is skipped due to file system mocking complexity
            // The functionality is tested through integration tests
        });

        it('should validate file path', async () => {
            // Act & Assert
            await expect(graphManager.importGraphFromFile(''))
                .rejects.toThrow('File path must be a non-empty string');
                
            await expect(graphManager.importGraphFromFile(null as any))
                .rejects.toThrow('File path must be a non-empty string');
        });

        it('should handle file read errors', async () => {
            // Arrange
            const filePath = '/invalid/path.md';
            
            const originalRequire = require;
            const mockReadFile = vi.fn().mockRejectedValue(new Error('File not found'));
            
            // Override require for this test
            (global as any).require = vi.fn((module: string) => {
                if (module === 'fs/promises') {
                    return { readFile: mockReadFile };
                }
                return originalRequire(module);
            });

            // Act & Assert
            await expect(graphManager.importGraphFromFile(filePath))
                .rejects.toThrow('Failed to import graph from file');

            // Restore require
            (global as any).require = originalRequire;
        });
    });

    describe('validateGraphFile', () => {
        it.skip('should validate valid graph file', async () => {
            // This test is skipped due to file system mocking complexity
            // The functionality is tested through integration tests
        });

        it('should detect invalid graph file', async () => {
            // Arrange
            const filePath = '/path/to/invalid.md';
            const invalidContent = 'Not a valid graph';
            
            const originalRequire = require;
            const mockReadFile = vi.fn().mockResolvedValue(invalidContent);
            
            // Override require for this test
            (global as any).require = vi.fn((module: string) => {
                if (module === 'fs/promises') {
                    return { readFile: mockReadFile };
                }
                return originalRequire(module);
            });

            // Act
            const result = await graphManager.validateGraphFile(filePath);

            // Restore require
            (global as any).require = originalRequire;

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle file path validation', async () => {
            // Act
            const result1 = await graphManager.validateGraphFile('');
            const result2 = await graphManager.validateGraphFile(null as any);

            // Assert
            expect(result1.valid).toBe(false);
            expect(result1.errors).toContain('File path must be a non-empty string');
            expect(result2.valid).toBe(false);
            expect(result2.errors).toContain('File path must be a non-empty string');
        });
    });

    describe('getExportStats', () => {
        it('should calculate export statistics', () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');
            const node1 = new Node('node1', 'Root', '/test.ts', 1);
            const node2 = new Node('node2', 'Child', '/test.js', 2);
            const node3 = new Node('node3', 'Grandchild', '/test.py', 3);
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
            
            graph.setParentChild('node1', 'node2');
            graph.setParentChild('node2', 'node3');

            // Act
            const stats = graphManager.getExportStats(graph.toJSON());

            // Assert
            expect(stats.nodeCount).toBe(3);
            expect(stats.maxDepth).toBe(3);
            expect(stats.fileTypes).toContain('ts');
            expect(stats.fileTypes).toContain('js');
            expect(stats.fileTypes).toContain('py');
        });

        it('should handle empty graph', () => {
            // Arrange
            const graph = new GraphModel('empty-id', 'Empty Graph');

            // Act
            const stats = graphManager.getExportStats(graph.toJSON());

            // Assert
            expect(stats.nodeCount).toBe(0);
            expect(stats.maxDepth).toBe(0);
            expect(stats.fileTypes).toHaveLength(0);
        });

        it('should handle null graph', () => {
            // Act
            const stats = graphManager.getExportStats(null as any);

            // Assert
            expect(stats.nodeCount).toBe(0);
            expect(stats.maxDepth).toBe(0);
            expect(stats.fileTypes).toHaveLength(0);
        });
    });

    describe('validation methods', () => {
        it('should validate export format correctly', async () => {
            // Arrange
            const graph = new GraphModel('test-id', 'Test Graph');

            // Act & Assert - valid format
            (mockStorageManager.exportGraphToMarkdown as Mock).mockResolvedValue('/path/test.md');
            await expect(graphManager.exportGraph(graph.toJSON(), 'md')).resolves.toBeDefined();

            // Act & Assert - invalid format
            await expect(graphManager.exportGraph(graph.toJSON(), 'invalid' as any))
                .rejects.toThrow('Unsupported export format: invalid');
        });

        it('should validate markdown content structure', async () => {
            // Valid content with nodes
            const validContent = '# Test\n\n- **node** (file.ts:1)';
            (mockStorageManager.saveGraphToFile as Mock).mockResolvedValue(undefined);
            await expect(graphManager.importGraph(validContent)).resolves.toBeDefined();

            // Invalid content - no heading
            await expect(graphManager.importGraph('No heading'))
                .rejects.toThrow('Markdown content must contain at least one heading');

            // Invalid content - empty
            await expect(graphManager.importGraph(''))
                .rejects.toThrow('Content must be a non-empty string');
        });
    });
});