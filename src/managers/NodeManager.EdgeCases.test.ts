import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { NodeManager } from './NodeManager';
import { GraphManager } from './GraphManager';
import { Node, Graph } from '../types';

// Mock VS Code
vi.mock('vscode', () => ({
    workspace: {
        fs: {
            readFile: vi.fn(),
            stat: vi.fn()
        }
    },
    FileType: {
        File: 1,
        Directory: 2
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path }))
    }
}));

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
            createGraph: vi.fn(),
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
            ).rejects.toThrow('File path cannot be empty');
        });

        it('should handle null file paths', async () => {
            await expect(
                nodeManager.createNode('Test Node', null as any, 10)
            ).rejects.toThrow('File path cannot be empty');
        });

        it('should handle undefined file paths', async () => {
            await expect(
                nodeManager.createNode('Test Node', undefined as any, 10)
            ).rejects.toThrow('File path cannot be empty');
        });

        it('should handle file paths with only whitespace', async () => {
            await expect(
                nodeManager.createNode('Test Node', '   \n\t  ', 10)
            ).rejects.toThrow('File path cannot be empty');
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
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', -5);
            expect(result.lineNumber).toBe(1); // Should default to 1
        });

        it('should handle zero line numbers', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 0);
            expect(result.lineNumber).toBe(1); // Should default to 1
        });

        it('should handle extremely large line numbers', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 999999);
            expect(result.lineNumber).toBe(999999);
        });

        it('should handle non-integer line numbers', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode('Test Node', '/test/file.ts', 10.5 as any);
            expect(result.lineNumber).toBe(10); // Should be truncated
        });

        it('should handle null line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', null as any)
            ).rejects.toThrow('Line number must be a positive integer');
        });

        it('should handle undefined line numbers', async () => {
            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', undefined as any)
            ).rejects.toThrow('Line number must be a positive integer');
        });
    });

    describe('Invalid node name handling', () => {
        it('should handle empty node names', async () => {
            await expect(
                nodeManager.createNode('', '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot be empty');
        });

        it('should handle null node names', async () => {
            await expect(
                nodeManager.createNode(null as any, '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot be empty');
        });

        it('should handle undefined node names', async () => {
            await expect(
                nodeManager.createNode(undefined as any, '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot be empty');
        });

        it('should handle node names with only whitespace', async () => {
            await expect(
                nodeManager.createNode('   \n\t  ', '/test/file.ts', 10)
            ).rejects.toThrow('Node name cannot be empty');
        });

        it('should handle extremely long node names', async () => {
            const longName = 'A'.repeat(10000);
            
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            const result = await nodeManager.createNode(longName, '/test/file.ts', 10);
            expect(result.name).toBe(longName);
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

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('No active graph found');
        });

        it('should handle undefined graph', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(undefined);

            await expect(
                nodeManager.createNode('Test Node', '/test/file.ts', 10)
            ).rejects.toThrow('No active graph found');
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
            ).rejects.toThrow('Parent node not found: non-existent-parent');
        });

        it('should handle null parent ID', async () => {
            await expect(
                nodeManager.createChildNode(null as any, 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent ID cannot be empty');
        });

        it('should handle empty parent ID', async () => {
            await expect(
                nodeManager.createChildNode('', 'Child Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent ID cannot be empty');
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
            ).rejects.toThrow('Child node not found: non-existent-child');
        });

        it('should handle node that already has a parent', async () => {
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

            await expect(
                nodeManager.createParentNode('child-1', 'New Parent', '/test/file.ts', 10)
            ).rejects.toThrow('Node already has a parent');
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
            expect(mockGraph.rootNodes).toContain(result.id);
            expect(mockGraph.rootNodes).not.toContain('root-1');
        });
    });

    describe('Bro node creation edge cases', () => {
        it('should handle missing current node', async () => {
            await expect(
                nodeManager.createBroNode('non-existent-sibling', 'Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('Sibling node not found: non-existent-sibling');
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

            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const bro = true;')
            );

            const result = await nodeManager.createBroNode('orphan-1', 'Bro Node', '/test/file.ts', 10);
            
            expect(result.parentId).toBeNull();
            expect(mockGraph.rootNodes).toContain(result.id);
        });

        it('should handle missing parent of sibling node', async () => {
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

            await expect(
                nodeManager.createBroNode('orphaned-child', 'Bro Node', '/test/file.ts', 10)
            ).rejects.toThrow('Parent node not found: missing-parent');
        });
    });

    describe('Node deletion edge cases', () => {
        it('should handle deleting non-existent node', async () => {
            await expect(
                nodeManager.deleteNode('non-existent-node')
            ).rejects.toThrow('Node not found: non-existent-node');
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

            await nodeManager.deleteNode('parent-1');

            // Children should become root nodes
            expect(mockGraph.rootNodes).toContain('child-1');
            expect(mockGraph.rootNodes).toContain('child-2');
            expect(mockGraph.nodes.has('parent-1')).toBe(false);
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

            // Should handle missing child gracefully
            await nodeManager.deleteNode('parent-1');

            expect(mockGraph.rootNodes).toContain('child-1');
            expect(mockGraph.nodes.has('parent-1')).toBe(false);
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

            await nodeManager.deleteNode('current-node');

            expect(mockGraph.currentNodeId).toBeNull();
            expect(mockGraph.nodes.has('current-node')).toBe(false);
        });
    });

    describe('Node update edge cases', () => {
        it('should handle updating non-existent node', async () => {
            await expect(
                nodeManager.updateNode('non-existent-node', { name: 'New Name' })
            ).rejects.toThrow('Node not found: non-existent-node');
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

            await expect(
                nodeManager.updateNode('test-node', { parentId: 'test-node' })
            ).rejects.toThrow();
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
            expect(result.codeSnippet).toBeDefined();
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
            expect(mockGraph.nodes.size).toBe(10);
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

            await Promise.all(promises);
            expect(mockGraph.nodes.size).toBe(0);
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

            await Promise.all(promises);

            const updatedNode = mockGraph.nodes.get('test-node');
            expect(updatedNode?.description).toBeDefined();
        });
    });

    describe('Memory and performance edge cases', () => {
        it('should handle creating many nodes without memory leaks', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            for (let i = 0; i < 1000; i++) {
                await nodeManager.createNode(`Node ${i}`, `/test/file${i}.ts`, i + 1);
            }

            expect(mockGraph.nodes.size).toBe(1000);
        });

        it('should handle deep node hierarchies', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            let currentParentId: string | null = null;

            // Create a deep hierarchy
            for (let i = 0; i < 100; i++) {
                let result;
                if (currentParentId) {
                    result = await nodeManager.createChildNode(
                        currentParentId,
                        `Deep Node ${i}`,
                        `/test/deep${i}.ts`,
                        i + 1
                    );
                } else {
                    result = await nodeManager.createNode(
                        `Deep Node ${i}`,
                        `/test/deep${i}.ts`,
                        i + 1
                    );
                }
                currentParentId = result.id;
            }

            expect(mockGraph.nodes.size).toBe(100);
        });

        it('should handle wide node hierarchies', async () => {
            (vscode.workspace.fs.readFile as Mock).mockResolvedValue(
                Buffer.from('const test = true;')
            );

            // Create parent
            const parent = await nodeManager.createNode('Parent', '/test/parent.ts', 1);

            // Create many children
            for (let i = 0; i < 1000; i++) {
                await nodeManager.createChildNode(
                    parent.id,
                    `Child ${i}`,
                    `/test/child${i}.ts`,
                    i + 1
                );
            }

            expect(mockGraph.nodes.size).toBe(1001); // Parent + 1000 children
            expect(parent.childIds).toHaveLength(1000);
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