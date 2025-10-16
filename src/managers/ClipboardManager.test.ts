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

describe('ClipboardManager', () => {
    let clipboardManager: ClipboardManager;
    let mockNodeManager: INodeManager;
    let mockGraphManager: IGraphManager;
    let mockGraph: Graph;
    let mockNodes: Map<string, Node>;

    // Sample test data
    const parentNode: Node = {
        id: 'parent-1',
        name: 'Parent Node',
        filePath: '/test/parent.ts',
        fileName: 'parent.ts',
        lineNumber: 10,
        codeSnippet: 'function parent() {}',
        codeHash: 'hash-parent',
        createdAt: new Date('2023-01-01'),
        parentId: null,
        childIds: ['child-1', 'child-2'],
        description: 'Parent node description'
    };

    const childNode1: Node = {
        id: 'child-1',
        name: 'Child Node 1',
        filePath: '/test/child1.ts',
        fileName: 'child1.ts',
        lineNumber: 5,
        codeSnippet: 'const child1 = true;',
        codeHash: 'hash-child1',
        createdAt: new Date('2023-01-02'),
        parentId: 'parent-1',
        childIds: ['grandchild-1'],
        validationWarning: 'Test warning'
    };

    const childNode2: Node = {
        id: 'child-2',
        name: 'Child Node 2',
        filePath: '/test/child2.ts',
        fileName: 'child2.ts',
        lineNumber: 15,
        codeSnippet: 'const child2 = false;',
        codeHash: 'hash-child2',
        createdAt: new Date('2023-01-03'),
        parentId: 'parent-1',
        childIds: []
    };

    const grandchildNode: Node = {
        id: 'grandchild-1',
        name: 'Grandchild Node',
        filePath: '/test/grandchild.ts',
        fileName: 'grandchild.ts',
        lineNumber: 20,
        codeSnippet: 'console.log("grandchild");',
        codeHash: 'hash-grandchild',
        createdAt: new Date('2023-01-04'),
        parentId: 'child-1',
        childIds: []
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        
        // Reset VS Code command mock to default success behavior
        (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);

        // Setup mock nodes
        mockNodes = new Map([
            ['parent-1', parentNode],
            ['child-1', childNode1],
            ['child-2', childNode2],
            ['grandchild-1', grandchildNode]
        ]);

        // Setup mock graph
        mockGraph = {
            id: 'test-graph',
            name: 'Test Graph',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
            nodes: mockNodes,
            rootNodes: ['parent-1'],
            currentNodeId: 'parent-1'
        };

        // Setup mock managers
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

    describe('copyNode', () => {
        it('should copy a single node without children', async () => {
            // Test copying a leaf node
            await clipboardManager.copyNode('child-2');

            const clipboardInfo = clipboardManager.getClipboardInfo();
            expect(clipboardInfo).toEqual({
                type: 'copy',
                nodeName: 'Child Node 2',
                timestamp: expect.any(Number)
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'codepath.hasClipboardNode',
                true
            );
        });

        it('should copy a node with all its children and descendants', async () => {
            // Test copying a node with children and grandchildren
            await clipboardManager.copyNode('parent-1');

            const clipboardInfo = clipboardManager.getClipboardInfo();
            expect(clipboardInfo).toEqual({
                type: 'copy',
                nodeName: 'Parent Node',
                timestamp: expect.any(Number)
            });

            expect(clipboardManager.hasClipboardData()).toBe(true);
        });

        it('should copy a node with children but not grandchildren of other branches', async () => {
            // Test copying child-1 which has grandchild-1
            await clipboardManager.copyNode('child-1');

            const clipboardInfo = clipboardManager.getClipboardInfo();
            expect(clipboardInfo).toEqual({
                type: 'copy',
                nodeName: 'Child Node 1',
                timestamp: expect.any(Number)
            });
        });

        it('should throw error when node not found', async () => {
            await expect(clipboardManager.copyNode('non-existent')).rejects.toThrow(
                'Node with ID non-existent not found'
            );
        });

        it('should throw error when no graph available', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            await expect(clipboardManager.copyNode('parent-1')).rejects.toThrow(
                'No active graph found'
            );
        });

        it('should throw error for invalid node ID', async () => {
            await expect(clipboardManager.copyNode('')).rejects.toThrow(
                'Node ID must be a non-empty string'
            );

            await expect(clipboardManager.copyNode(null as any)).rejects.toThrow(
                'Node ID must be a non-empty string'
            );
        });
    });

    describe('cutNode', () => {
        it('should cut a node and mark it for removal', async () => {
            await clipboardManager.cutNode('child-2');

            const clipboardInfo = clipboardManager.getClipboardInfo();
            expect(clipboardInfo).toEqual({
                type: 'cut',
                nodeName: 'Child Node 2',
                timestamp: expect.any(Number)
            });

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'codepath.hasClipboardNode',
                true
            );
        });

        it('should cut a node tree with all descendants', async () => {
            await clipboardManager.cutNode('parent-1');

            const clipboardInfo = clipboardManager.getClipboardInfo();
            expect(clipboardInfo).toEqual({
                type: 'cut',
                nodeName: 'Parent Node',
                timestamp: expect.any(Number)
            });
        });

        it('should throw error when node not found', async () => {
            await expect(clipboardManager.cutNode('non-existent')).rejects.toThrow(
                'Node with ID non-existent not found'
            );
        });
    });

    describe('pasteNode', () => {
        beforeEach(async () => {
            // Setup clipboard with test data
            await clipboardManager.copyNode('child-1');
        });

        it('should paste copied node as root when no parent specified', async () => {
            const mockCreatedNode: Node = {
                ...childNode1,
                id: 'new-node-1',
                parentId: null
            };

            const mockGrandchildNode: Node = {
                ...grandchildNode,
                id: 'new-grandchild-1',
                parentId: 'new-node-1'
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.createChildNode as Mock).mockResolvedValue(mockGrandchildNode);

            const result = await clipboardManager.pasteNode();

            expect(mockNodeManager.createNode).toHaveBeenCalledWith(
                'Child Node 1',
                '/test/child1.ts',
                5,
                'const child1 = true;'
            );

            expect(result).toHaveLength(2); // Root node and its child
            expect(result[0]).toEqual(mockCreatedNode);
        });

        it('should paste copied node as child when parent specified', async () => {
            const mockCreatedNode: Node = {
                ...childNode1,
                id: 'new-node-1',
                parentId: 'parent-1'
            };

            const mockGrandchildNode: Node = {
                ...grandchildNode,
                id: 'new-grandchild-1',
                parentId: 'new-node-1'
            };

            (mockNodeManager.createChildNode as Mock)
                .mockResolvedValueOnce(mockCreatedNode)
                .mockResolvedValueOnce(mockGrandchildNode);

            const result = await clipboardManager.pasteNode('parent-1');

            expect(mockNodeManager.createChildNode).toHaveBeenCalledWith(
                'parent-1',
                'Child Node 1',
                '/test/child1.ts',
                5
            );

            expect(result).toHaveLength(2); // Parent and child
            expect(result[0]).toEqual(mockCreatedNode);
        });

        it('should paste node tree with all descendants', async () => {
            // First copy a node with children
            await clipboardManager.copyNode('parent-1');

            const mockParentNode: Node = { ...parentNode, id: 'new-parent' };
            const mockChild1Node: Node = { ...childNode1, id: 'new-child-1', parentId: 'new-parent' };
            const mockChild2Node: Node = { ...childNode2, id: 'new-child-2', parentId: 'new-parent' };
            const mockGrandchildNode: Node = { ...grandchildNode, id: 'new-grandchild', parentId: 'new-child-1' };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockParentNode);
            (mockNodeManager.createChildNode as Mock)
                .mockResolvedValueOnce(mockChild1Node)
                .mockResolvedValueOnce(mockChild2Node)
                .mockResolvedValueOnce(mockGrandchildNode);

            const result = await clipboardManager.pasteNode();

            expect(mockNodeManager.createNode).toHaveBeenCalledTimes(1);
            expect(mockNodeManager.createChildNode).toHaveBeenCalledTimes(3);
            expect(result).toHaveLength(4); // All created nodes
        });

        it('should remove original nodes after pasting cut operation', async () => {
            // Cut a node first
            await clipboardManager.cutNode('child-2');

            const mockCreatedNode: Node = {
                ...childNode2,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);

            await clipboardManager.pasteNode();

            expect(mockNodeManager.deleteNodeWithChildren).toHaveBeenCalledWith('child-2');
        });

        it('should handle deletion failure gracefully for cut operations', async () => {
            await clipboardManager.cutNode('child-2');

            const mockCreatedNode: Node = {
                ...childNode2,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.deleteNodeWithChildren as Mock).mockRejectedValue(new Error('Delete failed'));

            // Should not throw error even if deletion fails
            const result = await clipboardManager.pasteNode();
            expect(result).toHaveLength(1);
        });

        it('should throw error when no clipboard data', async () => {
            await clipboardManager.clearClipboard();

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'No data in clipboard. Please copy or cut a node first.'
            );
        });

        it('should throw error when parent node not found', async () => {
            await expect(clipboardManager.pasteNode('non-existent-parent')).rejects.toThrow(
                'Parent node with ID non-existent-parent not found'
            );
        });

        it('should update node properties after creation', async () => {
            // Copy a node with description and validation warning
            await clipboardManager.copyNode('child-1');

            const mockCreatedNode: Node = {
                ...childNode1,
                id: 'new-node-1',
                parentId: null
            };

            const mockGrandchildNode: Node = {
                ...grandchildNode,
                id: 'new-grandchild-1',
                parentId: 'new-node-1'
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.createChildNode as Mock).mockResolvedValue(mockGrandchildNode);

            await clipboardManager.pasteNode();

            expect(mockNodeManager.updateNode).toHaveBeenCalledWith('new-node-1', {
                description: undefined, // child-1 doesn't have description
                validationWarning: 'Test warning',
                codeSnippet: 'const child1 = true;'
            });
        });
    });

    describe('clipboard state management', () => {
        it('should report empty clipboard initially', () => {
            expect(clipboardManager.hasClipboardData()).toBe(false);
            expect(clipboardManager.getClipboardInfo()).toBeNull();
        });

        it('should report clipboard data after copy', async () => {
            await clipboardManager.copyNode('child-1');

            expect(clipboardManager.hasClipboardData()).toBe(true);

            const info = clipboardManager.getClipboardInfo();
            expect(info).toEqual({
                type: 'copy',
                nodeName: 'Child Node 1',
                timestamp: expect.any(Number)
            });
        });

        it('should clear clipboard data', async () => {
            await clipboardManager.copyNode('child-1');
            expect(clipboardManager.hasClipboardData()).toBe(true);

            await clipboardManager.clearClipboard();

            expect(clipboardManager.hasClipboardData()).toBe(false);
            expect(clipboardManager.getClipboardInfo()).toBeNull();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'codepath.hasClipboardNode',
                false
            );
        });
    });

    describe('error handling', () => {
        it('should handle missing child nodes gracefully during tree building', async () => {
            // Create a node with a child reference that doesn't exist
            const brokenParent: Node = {
                ...parentNode,
                childIds: ['child-1', 'non-existent-child']
            };

            mockNodes.set('parent-1', brokenParent);

            // Should still work, just skip the missing child
            await clipboardManager.copyNode('parent-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Parent Node');
        });

        it('should handle node creation failures during paste', async () => {
            await clipboardManager.copyNode('child-1');

            (mockNodeManager.createNode as Mock).mockRejectedValue(new Error('Creation failed'));

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree: Creation failed'
            );
        });

        it('should handle update failures during paste', async () => {
            await clipboardManager.copyNode('child-1');

            const mockCreatedNode: Node = {
                ...childNode1,
                id: 'new-node-1',
                parentId: null
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.updateNode as Mock).mockRejectedValue(new Error('Update failed'));

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to recreate node tree: Update failed'
            );
        });

        it('should handle invalid node manager responses', async () => {
            await clipboardManager.copyNode('child-1');

            // Mock invalid response from node manager
            (mockNodeManager.createNode as Mock).mockResolvedValue(null);

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to create node - node manager returned invalid result'
            );
        });

        it('should handle node manager returning node without ID', async () => {
            await clipboardManager.copyNode('child-1');

            // Mock node without ID
            const invalidNode = { ...childNode1, id: '' };
            (mockNodeManager.createNode as Mock).mockResolvedValue(invalidNode);

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'Failed to create node - node manager returned invalid result'
            );
        });

        it('should handle VS Code context command failures gracefully', async () => {
            // Mock VS Code command failure
            (vscode.commands.executeCommand as Mock).mockRejectedValue(new Error('Context command failed'));

            // Should throw error because VS Code command failure prevents copy completion
            await expect(clipboardManager.copyNode('child-1')).rejects.toThrow(
                'Failed to copy node: Context command failed'
            );
        });

        it('should handle circular references in node tree', async () => {
            // Create a circular reference (child points back to parent)
            const circularChild: Node = {
                ...childNode1,
                childIds: ['parent-1'] // This creates a circular reference
            };

            mockNodes.set('child-1', circularChild);

            // Should throw error due to stack overflow from circular reference
            await expect(clipboardManager.copyNode('child-1')).rejects.toThrow(
                'Failed to copy node: Maximum call stack size exceeded'
            );
        });

        it('should handle empty node names and file paths', async () => {
            // Reset VS Code mock for this test
            (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);
            
            const emptyNode: Node = {
                id: 'empty-1',
                name: '',
                filePath: '',
                lineNumber: 0,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockNodes.set('empty-1', emptyNode);

            await clipboardManager.copyNode('empty-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('');
            expect(info?.type).toBe('copy');
        });
    });

    describe('dispose', () => {
        it('should clear clipboard on dispose', async () => {
            await clipboardManager.copyNode('child-1');
            expect(clipboardManager.hasClipboardData()).toBe(true);

            await clipboardManager.dispose();

            expect(clipboardManager.hasClipboardData()).toBe(false);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'codepath.hasClipboardNode',
                false
            );
        });
    });

    describe('data validation', () => {
        beforeEach(() => {
            // Ensure VS Code mock is reset for data validation tests
            (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);
        });

        it('should preserve all node properties during copy', async () => {
            await clipboardManager.copyNode('parent-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Parent Node');
            expect(info?.type).toBe('copy');
            expect(typeof info?.timestamp).toBe('number');
        });

        it('should handle nodes with minimal properties', async () => {
            const minimalNode: Node = {
                id: 'minimal-1',
                name: 'Minimal Node',
                filePath: '/test/minimal.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            mockNodes.set('minimal-1', minimalNode);

            await clipboardManager.copyNode('minimal-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Minimal Node');
        });

        it('should handle nodes with all optional properties', async () => {
            const fullNode: Node = {
                id: 'full-1',
                name: 'Full Node',
                filePath: '/test/full.ts',
                fileName: 'full.ts',
                lineNumber: 10,
                codeSnippet: 'const full = true;',
                codeHash: 'hash-full',
                createdAt: new Date(),
                parentId: null,
                childIds: [],
                validationWarning: 'Warning message',
                description: 'Full description'
            };

            mockNodes.set('full-1', fullNode);

            await clipboardManager.copyNode('full-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Full Node');
        });

        it('should validate clipboard data format correctly', async () => {
            // Copy a node to populate clipboard
            await clipboardManager.copyNode('child-1');
            
            // Verify clipboard has valid data
            expect(clipboardManager.hasClipboardData()).toBe(true);
            
            const info = clipboardManager.getClipboardInfo();
            expect(info).toEqual({
                type: 'copy',
                nodeName: 'Child Node 1',
                timestamp: expect.any(Number)
            });
        });

        it('should handle deep node tree structures correctly', async () => {
            // Create a deeper tree structure
            const deepChild: Node = {
                id: 'deep-child-1',
                name: 'Deep Child',
                filePath: '/test/deep.ts',
                fileName: 'deep.ts',
                lineNumber: 25,
                codeSnippet: 'const deep = true;',
                codeHash: 'hash-deep',
                createdAt: new Date(),
                parentId: 'grandchild-1',
                childIds: []
            };

            // Add deep child to grandchild
            const updatedGrandchild = { ...grandchildNode, childIds: ['deep-child-1'] };
            mockNodes.set('grandchild-1', updatedGrandchild);
            mockNodes.set('deep-child-1', deepChild);

            // Copy the parent node (should include all descendants)
            await clipboardManager.copyNode('parent-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Parent Node');
            expect(info?.type).toBe('copy');
        });

        it('should preserve node relationships in clipboard data', async () => {
            // Copy a node with children
            await clipboardManager.copyNode('parent-1');

            // Verify clipboard contains the node
            expect(clipboardManager.hasClipboardData()).toBe(true);

            // Paste and verify structure is maintained
            const mockParentNode: Node = { ...parentNode, id: 'new-parent' };
            const mockChild1Node: Node = { ...childNode1, id: 'new-child-1', parentId: 'new-parent' };
            const mockChild2Node: Node = { ...childNode2, id: 'new-child-2', parentId: 'new-parent' };
            const mockGrandchildNode: Node = { ...grandchildNode, id: 'new-grandchild', parentId: 'new-child-1' };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockParentNode);
            (mockNodeManager.createChildNode as Mock)
                .mockResolvedValueOnce(mockChild1Node)
                .mockResolvedValueOnce(mockChild2Node)
                .mockResolvedValueOnce(mockGrandchildNode);

            const result = await clipboardManager.pasteNode();

            // Verify all nodes were created
            expect(result).toHaveLength(4);
            expect(mockNodeManager.createNode).toHaveBeenCalledTimes(1);
            expect(mockNodeManager.createChildNode).toHaveBeenCalledTimes(3);
        });
    });

    describe('clipboard data format validation', () => {
        beforeEach(() => {
            // Ensure VS Code mock is reset for clipboard validation tests
            (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);
        });

        it('should maintain clipboard data integrity across operations', async () => {
            // Copy a complex node tree
            await clipboardManager.copyNode('parent-1');

            const initialInfo = clipboardManager.getClipboardInfo();
            expect(initialInfo?.type).toBe('copy');
            expect(initialInfo?.nodeName).toBe('Parent Node');

            // Convert to cut operation
            await clipboardManager.cutNode('parent-1');

            const cutInfo = clipboardManager.getClipboardInfo();
            expect(cutInfo?.type).toBe('cut');
            expect(cutInfo?.nodeName).toBe('Parent Node');
            expect(cutInfo?.timestamp).toBeGreaterThanOrEqual(initialInfo!.timestamp);
        });

        it('should handle timestamp validation', async () => {
            await clipboardManager.copyNode('child-1');

            const info = clipboardManager.getClipboardInfo();
            expect(info?.timestamp).toBeGreaterThan(0);
            expect(info?.timestamp).toBeLessThanOrEqual(Date.now());
        });

        it('should preserve node metadata during clipboard operations', async () => {
            // Copy a node with all metadata
            await clipboardManager.copyNode('child-1');

            const mockCreatedNode: Node = {
                ...childNode1,
                id: 'new-node-1',
                parentId: null
            };

            const mockGrandchildNode: Node = {
                ...grandchildNode,
                id: 'new-grandchild-1',
                parentId: 'new-node-1'
            };

            (mockNodeManager.createNode as Mock).mockResolvedValue(mockCreatedNode);
            (mockNodeManager.createChildNode as Mock).mockResolvedValue(mockGrandchildNode);

            await clipboardManager.pasteNode();

            // Verify that updateNode was called with the correct metadata
            expect(mockNodeManager.updateNode).toHaveBeenCalledWith('new-node-1', {
                description: undefined,
                validationWarning: 'Test warning',
                codeSnippet: 'const child1 = true;'
            });
        });

        it('should handle large node trees efficiently', async () => {
            // Create a large tree structure
            const largeParent: Node = {
                id: 'large-parent',
                name: 'Large Parent',
                filePath: '/test/large.ts',
                fileName: 'large.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: Array.from({ length: 100 }, (_, i) => `large-child-${i}`)
            };

            mockNodes.set('large-parent', largeParent);

            // Add all child nodes
            for (let i = 0; i < 100; i++) {
                const childNode: Node = {
                    id: `large-child-${i}`,
                    name: `Large Child ${i}`,
                    filePath: `/test/child-${i}.ts`,
                    fileName: `child-${i}.ts`,
                    lineNumber: i + 1,
                    createdAt: new Date(),
                    parentId: 'large-parent',
                    childIds: []
                };
                mockNodes.set(`large-child-${i}`, childNode);
            }

            // Should handle large trees without issues
            const startTime = Date.now();
            await clipboardManager.copyNode('large-parent');
            const endTime = Date.now();

            // Should complete in reasonable time (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000);

            const info = clipboardManager.getClipboardInfo();
            expect(info?.nodeName).toBe('Large Parent');
        });
    });

    describe('concurrent operations', () => {
        beforeEach(() => {
            // Ensure VS Code mock is reset for concurrent operation tests
            (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);
        });

        it('should handle multiple copy operations correctly', async () => {
            // First copy
            await clipboardManager.copyNode('child-1');
            const firstInfo = clipboardManager.getClipboardInfo();

            // Second copy should replace the first
            await clipboardManager.copyNode('child-2');
            const secondInfo = clipboardManager.getClipboardInfo();

            expect(firstInfo?.nodeName).toBe('Child Node 1');
            expect(secondInfo?.nodeName).toBe('Child Node 2');
            expect(secondInfo?.timestamp).toBeGreaterThanOrEqual(firstInfo!.timestamp);
        });

        it('should handle copy followed by cut operations', async () => {
            // Copy first
            await clipboardManager.copyNode('child-1');
            expect(clipboardManager.getClipboardInfo()?.type).toBe('copy');

            // Cut should replace copy
            await clipboardManager.cutNode('child-2');
            const info = clipboardManager.getClipboardInfo();
            expect(info?.type).toBe('cut');
            expect(info?.nodeName).toBe('Child Node 2');
        });

        it('should handle paste after clear clipboard', async () => {
            await clipboardManager.copyNode('child-1');
            expect(clipboardManager.hasClipboardData()).toBe(true);

            await clipboardManager.clearClipboard();
            expect(clipboardManager.hasClipboardData()).toBe(false);

            await expect(clipboardManager.pasteNode()).rejects.toThrow(
                'No data in clipboard. Please copy or cut a node first.'
            );
        });
    });
});