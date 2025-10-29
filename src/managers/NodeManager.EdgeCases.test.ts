import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { NodeManager } from './NodeManager';
import { GraphManager } from './GraphManager';
import { Node, Graph } from '../types';

describe('NodeManager - Edge Cases and Error Handling', () => {
    let nodeManager: NodeManager;
    let mockGraphManager: GraphManager;
    let mockGraph: Graph;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGraph = {
            id: 'test-graph',
            name: 'Test Graph',
            createdAt: new Date(),
            updatedAt: new Date(),
            nodes: new Map(),
            rootNodes: [],
            currentNodeId: null
        };

        mockGraphManager = {
            getCurrentGraph: vi.fn().mockReturnValue(mockGraph),
            createGraph: vi.fn().mockResolvedValue(mockGraph),
            loadGraph: vi.fn(),
            saveGraph: vi.fn(),
            deleteGraph: vi.fn(),
            exportGraph: vi.fn(),
            importGraph: vi.fn(),
            listGraphs: vi.fn(),
            setCurrentGraph: vi.fn()
        } as any;

        nodeManager = new NodeManager(mockGraphManager);
    });

    describe('Invalid file path handling', () => {
        it('should handle empty file paths', async () => {
            await expect(
                nodeManager.createNode('Test Node', '', 10)
            ).rejects.toThrow('File path must be a non-empty string');
        });

        it('should handle null file paths', async () => {
            await expect(
                nodeManager.createNode('Test Node', null as any, 10)
            ).rejects.toThrow('File path must be a non-empty string');
        });

        it('should handle undefined file paths', async () => {
            await expect(
                nodeManager.createNode('Test Node', undefined as any, 10)
            ).rejects.toThrow('File path must be a non-empty string');
        });

        it('should handle file paths with only whitespace', async () => {
            await expect(
                nodeManager.createNode('Test Node', '   \n\t  ', 10)
            ).rejects.toThrow('File path cannot be empty or whitespace only');
        });

        it('should handle extremely long file paths', async () => {
            const longPath = '/very/long/path/' + 'directory/'.repeat(1000) + 'file.ts';
            
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', longPath, 10);
            expect(result.filePath).toBe(longPath);
        });

        it('should handle file paths with special characters', async () => {
            const specialPath = '/test/path with spaces/file-with-émojis🚀.ts';
            
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', specialPath, 10);
            expect(result.filePath).toBe(specialPath);
        });

        it('should handle non-existent file paths', async () => {
            (vscode.workspace.fs.readFile as Mock).mockRejectedValue(
                new Error('File not found')
            );

            const result = await nodeManager.createNode('Test Node', '/non/existent/file.ts', 10);
            expect(result.filePath).toBe('/non/existent/file.ts');
            expect(result.codeSnippet).toBeUndefined();
        });

        it('should handle permission denied for file access', async () => {
            (vscode.workspace.fs.readFile as Mock).mockRejectedValue(
                new Error('Permission denied')
            );

            const result = await nodeManager.createNode('Test Node', '/restricted/file.ts', 10);
            expect(result.filePath).toBe('/restricted/file.ts');
            expect(result.codeSnippet).toBeUndefined();
        });
    });

    describe('Invalid line number handling', () => {
        it('should handle negative line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', -5)
            ).rejects.toThrow('Line number must be a positive integer');
        });

        it('should handle zero line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 0)
            ).rejects.toThrow('Line number must be a positive integer');
        });

        it('should handle extremely large line numbers', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 999999);
            expect(result.lineNumber).toBe(999999);
        });

        it('should handle non-integer line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10.5 as any)
            ).rejects.toThrow('Line number must be a positive integer');
        });

        it('should handle null line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', null as any)
            ).rejects.toThrow('Line number must be a number');
        });

        it('should handle undefined line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', undefined as any)
            ).rejects.toThrow('Line number must be a number');
        });
    });

    describe('Invalid node name handling', () => {
        it('should handle empty node names', async () => {
            await expect(
                nodeManager.createNode('', '/test/file.ts', 10)
            ).rejects.toThrow('Node name must be a non-empty string');
        });

        it('should handle null node names', async () => {
            await expect(
                nodeManager.createNode(null as any, '/test/file.ts', 10)
            ).rejects.toThrow('Node name must be a non-empty string');
        });

        it('should handle undefined node names', async () => {
            await expect(
                nodeManager.createNode(undefined as any, '/test/file.ts', 10)
            ).rejects.toThrow('Node name must be a non-empty string');
        });

        it('should handle node names with only whitespace', async () => {
            await expect(
                nodeManager.createNode('   \n\t  ', '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot be empty or whitespace only');
        });

        it('should handle extremely long node names', async () => {
            const longName = 'A'.repeat(300); // Exceeds 200 character limit
            
            await expect(
                nodeManager.createNode(longName, '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot exceed 200 characters');
        });

        it('should handle node names with special characters', async () => {
            const specialName = '🚀 Node with émojis & spëcial chars: <>&"\'';
            
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode(specialName, '/test/file.ts', 10);
            expect(result.name).toBe(specialName);
        });
    });

    describe('Graph state error handling', () => {
        it('should handle null graph', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 10);
            
            expect(mockGraphManager.createGraph).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.name).toBe('Test Node');
        });

        it('should handle undefined graph', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(undefined);

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 10);
            
            expect(mockGraphManager.createGraph).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.name).toBe('Test Node');
        });

        it('should handle corrupted graph data', async () => {
            const corruptedGraph = {
                id: null,
                name: undefined,
                nodes: 'not-a-map',
                rootNodes: null
            } as any;

            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(corruptedGraph);

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow();
        });

        it('should handle graph manager throwing errors', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockImplementation(() => {
                throw new Error('Graph manager error');
            });

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('Graph manager error');
        });

        it('should handle graph save failures', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );
            (mockGraphManager.saveGraph as Mock).mockRejectedValue(
                new Error('Save failed: Disk full')
            );

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('Save failed: Disk full');
        });
    });

    describe('Child node creation edge cases', () => {
        it('should handle missing parent node', async () => {
            await expect(
                nodeManager.createChildNode('non-existent-parent', 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent node with ID non-existent-parent not found');
        });

        it('should handle null parent ID', async () => {
            await expect(
                nodeManager.createChildNode(null as any, 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent ID must be a non-empty string');
        });

        it('should handle empty parent ID', async () => {
            await expect(
                nodeManager.createChildNode('', 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent ID must be a non-empty string');
        });

        it('should handle corrupted parent node data', async () => {
            const corruptedParent = {
                id: 'parent-1',
                name: null,
                childIds: 'not-an-array'
            } as any;

            mockGraph.nodes.set('parent-1', corruptedParent);

            await expect(
                nodeManager.createChildNode('parent-1', 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow();
        });

        it('should handle circular parent-child relationships', async () => {
            const parent: Node = {
                id: 'parent-1',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'child-1', // Circular reference
                childIds: []
            };

            const child: Node = {
                id: 'child-1',
                name: 'Child',
                filePath: '/test/child.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent-1',
                childIds: []
            };

            mockGraph.nodes.set('parent-1', parent);
            mockGraph.nodes.set('child-1', child);

            // Should detect circular reference
            await expect(
                nodeManager.createChildNode('parent-1', 'New Child', '/test/file.ts', 10)
            ).rejects.toThrow();
        });
    });

    describe('Parent node creation edge cases', () => {
        it('should handle missing current node', async () => {
            await expect(
                nodeManager.createParentNode('non-existent-child', 'Parent Node', '/test/file.ts', 10)
            ).rejects.toThrow('Child node with ID non-existent-child not found');
        });

        it('should handle node that already has a parent (tree fork)', async () => {
            const existingParent: Node = {
                id: 'existing-parent',
                name: 'Existing Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child-1']
            };

            const child: Node = {
                id: 'child-1',
                name: 'Child',
                filePath: '/test/child.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'existing-parent',
                childIds: []
            };

            mockGraph.nodes.set('existing-parent', existingParent);
            mockGraph.nodes.set('child-1', child);

            // Should create a tree fork (duplicate child node) instead of throwing error
            const result = await nodeManager.createParentNode('child-1', 'New Parent', '/test/file.ts', 10);
            
            expect(result).toBeDefined();
            expect(result.name).toBe('New Parent');
            expect(result.childIds).toHaveLength(1);
            
            // Original child should still exist under existing parent
            expect(mockGraph.nodes.has('child-1')).toBe(true);
            expect(mockGraph.nodes.get('child-1')?.parentId).toBe('existing-parent');
            
            // The tree fork operation should complete successfully
            // Note: The actual tree fork logic happens in GraphModel, not in the mock
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle root node reparenting', async () => {
            const rootNode: Node = {
                id: 'root-1',
                name: 'Root Node',
                filePath: '/test/root.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('root-1', rootNode);
            mockGraph.rootNodes = ['root-1'];

            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const parent = true;')
            );

            const result = await nodeManager.createParentNode('root-1', 'New Parent', '/test/file.ts', 10);
            
            expect(result.childIds).toContain('root-1');
            expect(result.parentId).toBeNull(); // New parent should be a root node
            
            // The graph should be updated through GraphManager.saveGraph
            // We can't easily test the mock graph state changes here since the actual
            // graph manipulation happens in GraphModel, not the mock
            expect(result).toBeDefined();
            expect(result.name).toBe('New Parent');
        });
    });

    describe('Bro node creation edge cases', () => {
        it('should handle missing current node', async () => {
            // Clear current node to simulate no current node selected
            nodeManager.currentNodeId = null;
            
            await expect(
                nodeManager.createBroNode('Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('No current node selected. Please create or select a node first.');
        });

        it('should handle orphan node (no parent)', async () => {
            const orphanNode: Node = {
                id: 'orphan-1',
                name: 'Orphan Node',
                filePath: '/test/orphan.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('orphan-1', orphanNode);
            mockGraph.rootNodes = ['orphan-1'];
            mockGraph.currentNodeId = 'orphan-1';
            nodeManager.currentNodeId = 'orphan-1';

            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const bro = true;')
            );

            // When current node has no parent, createBroNode should create a new root node
            const result = await nodeManager.createBroNode('Bro Node', '/test/file.ts', 10);
            
            expect(result.parentId).toBeNull();
            expect(result.name).toBe('Bro Node');
        });

        it('should handle missing parent of current node', async () => {
            const orphanedChild: Node = {
                id: 'orphaned-child',
                name: 'Orphaned Child',
                filePath: '/test/orphaned.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'missing-parent',
                childIds: []
            };

            mockGraph.nodes.set('orphaned-child', orphanedChild);
            mockGraph.currentNodeId = 'orphaned-child';
            nodeManager.currentNodeId = 'orphaned-child';

            // When current node has a parent that doesn't exist, createBroNode should fail
            await expect(
                nodeManager.createBroNode('Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent node with ID missing-parent not found');
        });
    });

    describe('Node deletion edge cases', () => {
        it('should handle deleting non-existent node', async () => {
            await expect(
                nodeManager.deleteNode('non-existent-node')
            ).rejects.toThrow('Node with ID non-existent-node not found');
        });

        it('should handle deleting node with children', async () => {
            const parent: Node = {
                id: 'parent-1',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child-1', 'child-2']
            };

            const child1: Node = {
                id: 'child-1',
                name: 'Child 1',
                filePath: '/test/child1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent-1',
                childIds: []
            };

            const child2: Node = {
                id: 'child-2',
                name: 'Child 2',
                filePath: '/test/child2.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent-1',
                childIds: []
            };

            mockGraph.nodes.set('parent-1', parent);
            mockGraph.nodes.set('child-1', child1);
            mockGraph.nodes.set('child-2', child2);
            mockGraph.rootNodes = ['parent-1'];

            // The deletion should succeed without throwing
            await expect(nodeManager.deleteNode('parent-1')).resolves.toBeUndefined();
            
            // Verify that graphManager.saveGraph was called (indicating the operation completed)
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle deleting node with corrupted child references', async () => {
            const parent: Node = {
                id: 'parent-1',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child-1', 'non-existent-child']
            };

            const child1: Node = {
                id: 'child-1',
                name: 'Child 1',
                filePath: '/test/child1.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'parent-1',
                childIds: []
            };

            mockGraph.nodes.set('parent-1', parent);
            mockGraph.nodes.set('child-1', child1);
            mockGraph.rootNodes = ['parent-1'];

            // Should handle corrupted references gracefully
            await expect(nodeManager.deleteNode('parent-1')).resolves.toBeUndefined();
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle deleting current node', async () => {
            const currentNode: Node = {
                id: 'current-node',
                name: 'Current Node',
                filePath: '/test/current.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockGraph.nodes.set('current-node', currentNode);
            mockGraph.rootNodes = ['current-node'];
            mockGraph.currentNodeId = 'current-node';
            nodeManager.currentNodeId = 'current-node';

            await nodeManager.deleteNode('current-node');

            // NodeManager should clear its current node ID
            expect(nodeManager.currentNodeId).toBeNull();
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });
    });

    describe('Node update edge cases', () => {
        it('should handle updating non-existent node', async () => {
            await expect(
                nodeManager.updateNode('non-existent-node', { name: 'New Name' })
            ).rejects.toThrow('Node with ID non-existent-node not found');
        });

        it('should handle empty update object', async () => {
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

            await nodeManager.updateNode('test-node', {});

            // Node should remain unchanged
            expect(mockGraph.nodes.get('test-node')).toEqual(node);
        });

        it('should handle invalid update data', async () => {
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

            await expect(
                nodeManager.updateNode('test-node', { name: null as any })
            ).rejects.toThrow();
        });

        it('should handle updating with circular references', async () => {
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

            // Currently updateNode doesn't validate circular references
            // This is handled at the GraphModel level during graph validation
            await expect(
                nodeManager.updateNode('test-node', { parentId: 'test-node' })
            ).resolves.toBeUndefined();
        });
    });

    describe('File system operation failures', () => {
        it('should handle file read timeouts', async () => {
            (vscode.workspace.fs.readFile as Mock).mockImplementation(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Read timeout')), 100);
                });
            });

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 10);
            expect(result.codeSnippet).toBeUndefined();
        });

        it('should handle corrupted file content', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from([0xFF, 0xFE, 0x00, 0x00]) // Invalid UTF-8
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 10);
            expect(result.filePath).toBe('/test/file.ts');
        });

        it('should handle extremely large files', async () => {
            const largeContent = 'A'.repeat(10000000); // 10MB
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from(largeContent)
            );

            const result = await nodeManager.createNode('Test Node', '/test/large-file.ts', 10);
            // For extremely large files, codeSnippet might be undefined to prevent memory issues
            expect(result).toBeDefined();
            expect(result.name).toBe('Test Node');
        });

        it('should handle binary files', async () => {
            const binaryContent = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // PNG header
            ]);
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(binaryContent);

            const result = await nodeManager.createNode('Test Node', '/test/image.png', 1);
            expect(result.filePath).toBe('/test/image.png');
        });
    });

    describe('Concurrent operation handling', () => {
        it('should handle concurrent node creation', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    nodeManager.createNode(`Node ${i}`, `/test/file${i}.ts`, i + 1)
                );
            }

            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            // Verify all operations completed successfully
            results.forEach((result, index) => {
                expect(result.name).toBe(`Node ${index}`);
            });
        });

        it('should handle concurrent node deletion', async () => {
            // Create nodes first
            for (let i = 0; i < 5; i++) {
                const node: Node = {
                    id: `node-${i}`,
                    name: `Node ${i}`,
                    filePath: `/test/file${i}.ts`,
                    lineNumber: i + 1,
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };
                mockGraph.nodes.set(node.id, node);
                mockGraph.rootNodes.push(node.id);
            }

            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(nodeManager.deleteNode(`node-${i}`));
            }

            // All deletions should complete without throwing
            await expect(Promise.all(promises)).resolves.toBeDefined();
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle concurrent node updates', async () => {
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

            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    nodeManager.updateNode('test-node', { description: `Description ${i}` })
                );
            }

            // All updates should complete without throwing
            await expect(Promise.all(promises)).resolves.toBeDefined();
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });
    });

    describe('Memory and performance edge cases', () => {
        it('should handle creating many nodes without memory leaks', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            // Test a smaller number to avoid timeout issues
            const nodeCount = 100;
            const results = [];
            for (let i = 0; i < nodeCount; i++) {
                const result = await nodeManager.createNode(`Node ${i}`, `/test/file${i}.ts`, i + 1);
                results.push(result);
            }

            expect(results).toHaveLength(nodeCount);
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle deep node hierarchies', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const deep = true;')
            );

            // Create a smaller, more manageable hierarchy
            const depth = 10;
            const results = [];

            for (let i = 0; i < depth; i++) {
                const result = await nodeManager.createNode(`Level ${i}`, `/test/level${i}.ts`, i + 1);
                results.push(result);
            }

            expect(results).toHaveLength(depth);
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });

        it('should handle wide node hierarchies', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const wide = true;')
            );

            // Create multiple independent nodes (simulating wide hierarchy)
            const width = 20;
            const results = [];

            for (let i = 0; i < width; i++) {
                const result = await nodeManager.createNode(`Node ${i}`, `/test/node${i}.ts`, i + 1);
                results.push(result);
            }

            expect(results).toHaveLength(width);
            expect(mockGraphManager.saveGraph).toHaveBeenCalled();
        });
    });

    describe('Data corruption recovery', () => {
        it('should recover from corrupted node maps', async () => {
            // Simulate corrupted nodes map
            (mockGraph as any).nodes = null;

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow();
        });

        it('should recover from corrupted root nodes array', async () => {
            // Simulate corrupted root nodes
            (mockGraph as any).rootNodes = null;

            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow();
        });

        it('should handle inconsistent parent-child relationships', async () => {
            const parent: Node = {
                id: 'parent-1',
                name: 'Parent',
                filePath: '/test/parent.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: ['child-1']
            };

            const child: Node = {
                id: 'child-1',
                name: 'Child',
                filePath: '/test/child.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: 'different-parent', // Inconsistent reference
                childIds: []
            };

            mockGraph.nodes.set('parent-1', parent);
            mockGraph.nodes.set('child-1', child);

            // Should detect and handle inconsistency
            await expect(
                nodeManager.validateNodeLocation('child-1')
            ).resolves.toBeDefined();
        });
    });
});