import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { ClipboardManager } from './ClipboardManager';
import { Node, Graph } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';

// Mock VS Code
vi.mock('vscode', () => ({
    commands: {
        executeCommand: vi.fn()
    }
}));

describe('ClipboardManager - Edge Cases and Error Handling', () => {
    let clipboardManager: ClipboardManager;
    let mockNodeManager: INodeManager;
    let mockGraphManager: IGraphManager;
    let mockGraph: Graph;
    let mockNodes: Map<string, Node>;

    const testNode: Node = {
        id: 'test-node-1',
        name: 'Test Node',
        filePath: '/test/file.ts',
        fileName: 'file.ts',
        lineNumber: 10,
        codeSnippet: 'const test = true;',
        codeHash: 'hash-test',
        createdAt: new Date('2023-01-01'),
        parentId: null,
        childIds: [],
        description: 'Test description'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);

        mockNodes = new Map([['test-node-1', testNode]]);

        mockGraph = {
            id: 'test-graph',
            name: 'Test Graph',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
            nodes: mockNodes,
            rootNodes: ['test-node-1'],
            currentNodeId: 'test-node-1'
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
        };

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

        clipboardManager = new ClipboardManager(mockNodeManager, mockGraphManager);
    });

    describe('Empty clipboard paste operations', () => {
        it('should throw error when pasting with empty clipboard', async () => {
            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                '剪贴板为空'
            );
        });

        it('should throw error when pasting after clipboard is cleared', async () => {
            await clipboardManager.copyNode('test-node-1');
            await clipboardManager.clearClipboard();

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                '剪贴板为空'
            );
        });

        it('should handle multiple paste attempts with empty clipboard', async () => {
            for (let i = 0; i < 3; i++) {
                await expect(clipboardManager.pasteNode()).rejects.toThrow(
                    '剪贴板为空'
                );
            }
        });
    });

    describe('Invalid file path handling', () => {
        it('should handle nodes with empty file paths', async () => {
            const nodeWithEmptyPath: Node = {
                ...testNode,
                id: 'empty-path-node',
                filePath: '',
                fileName: ''
            };

            mockNodes.set('empty-path-node', nodeWithEmptyPath);

            await clipboardManager.copyNode('empty-path-node');

            const mockCreatedNode: Node = {
                ...nodeWithEmptyPath,
                id: 'new-empty-path-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
            expect(mockNodeManager.createNode).toHaveBeenCalledWith(
                'Test Node',
                '',
                10,
                'const test = true;'
            );
        });

        it('should handle nodes with invalid file paths', async () => {
            const nodeWithInvalidPath: Node = {
                ...testNode,
                id: 'invalid-path-node',
                filePath: '/invalid/path/that/does/not/exist.ts',
                fileName: 'does-not-exist.ts'
            };

            mockNodes.set('invalid-path-node', nodeWithInvalidPath);

            await clipboardManager.copyNode('invalid-path-node');

            const mockCreatedNode: Node = {
                ...nodeWithInvalidPath,
                id: 'new-invalid-path-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });

        it('should handle nodes with null or undefined file paths', async () => {
            const nodeWithNullPath: Node = {
                ...testNode,
                id: 'null-path-node',
                filePath: null as any,
                fileName: undefined as any
            };

            mockNodes.set('null-path-node', nodeWithNullPath);

            await clipboardManager.copyNode('null-path-node');

            const mockCreatedNode: Node = {
                ...nodeWithNullPath,
                id: 'new-null-path-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });

        it('should handle nodes with very long file paths', async () => {
            const longPath = '/very/long/path/that/exceeds/normal/limits/' + 'a'.repeat(500) + '.ts';
            const nodeWithLongPath: Node = {
                ...testNode,
                id: 'long-path-node',
                filePath: longPath,
                fileName: 'a'.repeat(500) + '.ts'
            };

            mockNodes.set('long-path-node', nodeWithLongPath);

            await clipboardManager.copyNode('long-path-node');

            const mockCreatedNode: Node = {
                ...nodeWithLongPath,
                id: 'new-long-path-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });
    });

    describe('Permission and access error handling', () => {
        it('should handle VS Code context command permission errors', async () => {
            (vscode.commands.executeCommand as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot set context')
            );

            await expect(clipboardManager.copyNode('test-node-1')).rejects.toThrow(
                'Permission denied: Cannot set context'
            );
        });

        it('should handle node manager permission errors during creation', async () => {
            await clipboardManager.copyNode('test-node-1');

            (mockNodeManager.createNode as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot create node')
            );

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree: Permission denied: Cannot create node'
            );
        });

        it('should handle node manager permission errors during update', async () => {
            await clipboardManager.copyNode('test-node-1');

            const mockCreatedNode: Node = {
                ...testNode,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.updateNode as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot update node')
            );

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree: Permission denied: Cannot update node'
            );
        });

        it('should handle node manager permission errors during deletion', async () => {
            await clipboardManager.cutNode('test-node-1');

            const mockCreatedNode: Node = {
                ...testNode,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.deleteNodeWithChildren as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot delete node')
            );

            // Should not throw error - deletion failure is handled gracefully
            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });

        it('should handle graph manager access errors', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockImplementation(() => {
                throw new Error('Permission denied: Cannot access graph');
            });

            await expect(clipboardManager.copyNode('test-node-1')).rejects.toThrow(
                'Permission denied: Cannot access graph'
            );
        });
    });

    describe('Data corruption and recovery', () => {
        it('should handle corrupted clipboard data gracefully', async () => {
            await clipboardManager.copyNode('test-node-1');

            // Simulate data corruption by directly modifying internal state
            (clipboardManager as any).clipboardData = {
                type: 'copy',
                nodeTree: null, // Corrupted data
                timestamp: Date.now()
            };

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree'
            );
        });

        it('should handle missing node references in clipboard data', async () => {
            const parentWithMissingChild: Node = {
                ...testNode,
                id: 'parent-with-missing-child',
                childIds: ['missing-child-1', 'missing-child-2']
            };

            mockNodes.set('parent-with-missing-child', parentWithMissingChild);

            // Should handle missing children gracefully
            await clipboardManager.copyNode('parent-with-missing-child');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
        });

        it('should handle circular references in node tree', async () => {
            const circularParent: Node = {
                ...testNode,
                id: 'circular-parent',
                childIds: ['circular-child']
            };

            const circularChild: Node = {
                ...testNode,
                id: 'circular-child',
                parentId: 'circular-parent',
                childIds: ['circular-parent'] // Creates circular reference
            };

            mockNodes.set('circular-parent', circularParent);
            mockNodes.set('circular-child', circularChild);

            await expect(clipboardManager.copyNode('circular-parent')).rejects.toThrow(
                'Maximum call stack size exceeded'
            );
        });

        it('should handle deeply nested node structures', async () => {
            // Create a very deep tree structure
            const depth = 100;
            const nodes: Node[] = [];

            for (let i = 0; i < depth; i++) {
                const node: Node = {
                    ...testNode,
                    id: `deep-node-${i}`,
                    name: `Deep Node ${i}`,
                    parentId: i > 0 ? `deep-node-${i - 1}` : null,
                    childIds: i < depth - 1 ? [`deep-node-${i + 1}`] : []
                };
                nodes.push(node);
                mockNodes.set(node.id, node);
            }

            // Update root nodes
            mockGraph.rootNodes = ['deep-node-0'];

            await clipboardManager.copyNode('deep-node-0');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Deep Node 0');
        });

        it('should handle invalid node data types', async () => {
            const invalidNode = {
                id: 'invalid-node',
                name: 123, // Invalid type
                filePath: true, // Invalid type
                lineNumber: 'not-a-number', // Invalid type
                createdAt: 'not-a-date', // Invalid type
                parentId: null,
                childIds: 'not-an-array' // Invalid type
            } as any;

            mockNodes.set('invalid-node', invalidNode);

            await clipboardManager.copyNode('invalid-node');

            const mockCreatedNode: Node = {
                ...testNode,
                id: 'new-invalid-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });
    });

    describe('Concurrent operation handling', () => {
        it('should handle concurrent copy operations', async () => {
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(clipboardManager.copyNode('test-node-1'));
            }

            await Promise.all(promises);

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
            expect(info?.type).toBe('copy');
        });

        it('should handle concurrent paste operations', async () => {
            await clipboardManager.copyNode('test-node-1');

            const mockCreatedNode: Node = {
                ...testNode,
                id: 'concurrent-node',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push(clipboardManager.pasteNode());
            }

            const results = await Promise.all(promises);
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toHaveLength(1);
            });
        });

        it('should handle copy-paste race conditions', async () => {
            const copyPromise = clipboardManager.copyNode('test-node-1');
            
            // Try to paste before copy completes
            const pastePromise = clipboardManager.pasteNode().catch(error => error);

            await copyPromise;
            const pasteResult = await pastePromise;

            // Paste should fail because it started before copy completed
            expect(pasteResult).toBeInstanceOf(Error);
            expect(pasteResult.message).toMatch(/No data in clipboard|Failed to paste node/);
        });

        it('should handle cut-paste race conditions', async () => {
            const cutPromise = clipboardManager.cutNode('test-node-1');
            
            // Try to paste before cut completes
            const pastePromise = clipboardManager.pasteNode().catch(error => error);

            await cutPromise;
            const pasteResult = await pastePromise;

            // Paste should fail because it started before cut completed
            expect(pasteResult).toBeInstanceOf(Error);
            expect(pasteResult.message).toMatch(/No data in clipboard|Failed to paste node/);
        });

        it('should handle multiple cut operations on same node', async () => {
            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push(clipboardManager.cutNode('test-node-1'));
            }

            await Promise.all(promises);

            const info = clipboardManager.getClipboardInfo();
            expect(info?.type).toBe('cut');
            expect(info?.nodeName).toBe('Test Node');
        });

        it('should handle clipboard clear during operations', async () => {
            const copyPromise = clipboardManager.copyNode('test-node-1');
            const clearPromise = clipboardManager.clearClipboard();

            await Promise.all([copyPromise, clearPromise]);

            // Final state should be cleared
            expect(clipboardManager.hasClipboardData()).toBe(false);
        });
    });

    describe('Memory and resource management', () => {
        it('should handle large node trees without memory issues', async () => {
            // Create a wide tree structure
            const parentNode: Node = {
                ...testNode,
                id: 'large-parent',
                childIds: Array.from({ length: 1000 }, (_, i) => `large-child-${i}`)
            };

            mockNodes.set('large-parent', parentNode);

            // Add all child nodes
            for (let i = 0; i < 1000; i++) {
                const childNode: Node = {
                    ...testNode,
                    id: `large-child-${i}`,
                    name: `Large Child ${i}`,
                    parentId: 'large-parent',
                    childIds: []
                };
                mockNodes.set(`large-child-${i}`, childNode);
            }

            await clipboardManager.copyNode('large-parent');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
        });

        it('should handle multiple clipboard operations without memory leaks', async () => {
            for (let i = 0; i < 100; i++) {
                await clipboardManager.copyNode('test-node-1');
                await clipboardManager.clearClipboard();
            }

            expect(clipboardManager.hasClipboardData()).toBe(false);
        });

        it('should handle dispose during active operations', async () => {
            const copyPromise = clipboardManager.copyNode('test-node-1');
            const disposePromise = clipboardManager.dispose();

            await Promise.all([copyPromise, disposePromise]);

            expect(clipboardManager.hasClipboardData()).toBe(false);
        });
    });

    describe('Edge case node structures', () => {
        it('should handle nodes with extremely long names', async () => {
            const longName = 'A'.repeat(10000);
            const nodeWithLongName: Node = {
                ...testNode,
                id: 'long-name-node',
                name: longName
            };

            mockNodes.set('long-name-node', nodeWithLongName);

            await clipboardManager.copyNode('long-name-node');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe(longName);
        });

        it('should handle nodes with special characters in names', async () => {
            const specialName = '🚀 Node with émojis & spëcial chars: <>&"\'';
            const nodeWithSpecialName: Node = {
                ...testNode,
                id: 'special-name-node',
                name: specialName
            };

            mockNodes.set('special-name-node', nodeWithSpecialName);

            await clipboardManager.copyNode('special-name-node');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe(specialName);
        });

        it('should handle nodes with zero or negative line numbers', async () => {
            const nodeWithZeroLine: Node = {
                ...testNode,
                id: 'zero-line-node',
                lineNumber: 0
            };

            const nodeWithNegativeLine: Node = {
                ...testNode,
                id: 'negative-line-node',
                lineNumber: -5
            };

            mockNodes.set('zero-line-node', nodeWithZeroLine);
            mockNodes.set('negative-line-node', nodeWithNegativeLine);

            await clipboardManager.copyNode('zero-line-node');
            await clipboardManager.copyNode('negative-line-node');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
        });

        it('should handle nodes with very old or future dates', async () => {
            const nodeWithOldDate: Node = {
                ...testNode,
                id: 'old-date-node',
                createdAt: new Date('1900-01-01')
            };

            const nodeWithFutureDate: Node = {
                ...testNode,
                id: 'future-date-node',
                createdAt: new Date('2100-01-01')
            };

            mockNodes.set('old-date-node', nodeWithOldDate);
            mockNodes.set('future-date-node', nodeWithFutureDate);

            await clipboardManager.copyNode('old-date-node');
            await clipboardManager.copyNode('future-date-node');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
        });
    });

    describe('Error recovery and resilience', () => {
        it('should recover from temporary VS Code API failures', async () => {
            // First call fails, second succeeds
            (vscode.commands.executeCommand as Mock)
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValue(undefined);

            await expect(clipboardManager.copyNode('test-node-1')).rejects.toThrow(
                'Temporary failure'
            );

            // Second attempt should succeed
            await clipboardManager.copyNode('test-node-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Test Node');
        });

        it('should handle partial node creation failures during paste', async () => {
            const parentWithChildren: Node = {
                ...testNode,
                id: 'parent-node',
                childIds: ['child-1', 'child-2']
            };

            const child1: Node = {
                ...testNode,
                id: 'child-1',
                name: 'Child 1',
                parentId: 'parent-node',
                childIds: []
            };

            const child2: Node = {
                ...testNode,
                id: 'child-2',
                name: 'Child 2',
                parentId: 'parent-node',
                childIds: []
            };

            mockNodes.set('parent-node', parentWithChildren);
            mockNodes.set('child-1', child1);
            mockNodes.set('child-2', child2);

            await clipboardManager.copyNode('parent-node');

            const mockParentNode: Node = {
                ...parentWithChildren,
                id: 'new-parent',
                parentId: null
            };

            // Parent creation succeeds, first child succeeds, second child fails
            (mockNodeManager.createNode as Mock).mockResolvedValue(mockParentNode);
            (mockNodeManager.createChildNode as Mock)
                .mockResolvedValueOnce({ ...child1, id: 'new-child-1', parentId: 'new-parent' })
                .mockRejectedValue(new Error('Child creation failed'));

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree: Child creation failed'
            );
        });

        it('should handle graph state changes during operations', async () => {
            await clipboardManager.copyNode('test-node-1');

            // Change graph state
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                /No active graph found|Failed to paste node/
            );
        });

        it('should handle node deletion during cut-paste operations', async () => {
            await clipboardManager.cutNode('test-node-1');

            // Remove the original node from the graph
            mockNodes.delete('test-node-1');

            const mockCreatedNode: Node = {
                ...testNode,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            // Should still paste successfully even if original node is gone
            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });
    });
});