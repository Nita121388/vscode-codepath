import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NodeManager } from './NodeManager';
import { GraphManager } from './GraphManager';
import { StorageManager } from './StorageManager';

describe('NodeManager - Tree Fork Feature', () => {
    let nodeManager: NodeManager;
    let graphManager: GraphManager;
    let storageManager: StorageManager;

    beforeEach(async () => {
        // Provide a valid workspace root path
        storageManager = new StorageManager('/mock/workspace');
        graphManager = new GraphManager(storageManager);
        nodeManager = new NodeManager(graphManager);

        // Create initial graph
        await graphManager.createGraph('test-fork');
    });

    it('should create a tree fork when adding parent to node with existing parent', async () => {
        // Create initial tree structure:
        // root -> child -> grandchild
        const root = await nodeManager.createNode('root', 'test.ts', 10);
        const child = await nodeManager.createChildNode(root.id, 'child', 'test.ts', 20);
        const grandchild = await nodeManager.createChildNode(child.id, 'grandchild', 'test.ts', 30);

        // Get initial state
        const graphBefore = graphManager.getCurrentGraph();
        expect(graphBefore?.nodes.size).toBe(3);
        expect(graphBefore?.rootNodes.length).toBe(1);

        // Add a new parent to child (which already has root as parent)
        const newParent = await nodeManager.createParentNode(child.id, 'newParent', 'other.ts', 45);

        // Get updated state
        const graphAfter = graphManager.getCurrentGraph();
        
        // Should have created a fork:
        // - Original: root -> child
        // - New branch: newParent -> child (duplicate) -> grandchild
        expect(graphAfter?.nodes.size).toBe(5); // root, child, grandchild, newParent, duplicated child
        expect(graphAfter?.rootNodes.length).toBe(2); // root and newParent

        // Verify newParent is a root node
        const newParentNode = graphAfter?.nodes.get(newParent.id);
        expect(newParentNode?.parentId).toBeNull();
        expect(newParentNode?.childIds.length).toBe(1);

        // Verify original child still has root as parent
        const originalChild = graphAfter?.nodes.get(child.id);
        expect(originalChild?.parentId).toBe(root.id);
        expect(originalChild?.childIds.length).toBe(0); // Children moved to duplicate

        // Find the duplicated child
        const allNodes = Array.from(graphAfter?.nodes.values() || []);
        const duplicatedChild = allNodes.find(
            n => n.id !== child.id && n.name === 'child' && n.parentId === newParent.id
        );
        expect(duplicatedChild).toBeDefined();
        expect(duplicatedChild?.childIds).toContain(grandchild.id);

        // Verify grandchild now points to duplicated child as parent
        const grandchildNode = graphAfter?.nodes.get(grandchild.id);
        expect(grandchildNode?.parentId).toBe(duplicatedChild?.id);
    });

    it('should not create fork when adding parent to node without existing parent', async () => {
        // Create a root node
        const root = await nodeManager.createNode('root', 'test.ts', 10);

        // Get initial state
        const graphBefore = graphManager.getCurrentGraph();
        expect(graphBefore?.nodes.size).toBe(1);
        expect(graphBefore?.rootNodes.length).toBe(1);

        // Add a parent to root (which has no parent)
        const newParent = await nodeManager.createParentNode(root.id, 'newParent', 'other.ts', 5);

        // Get updated state
        const graphAfter = graphManager.getCurrentGraph();
        
        // Should NOT create a fork, just establish parent-child relationship
        expect(graphAfter?.nodes.size).toBe(2); // newParent and root
        expect(graphAfter?.rootNodes.length).toBe(1); // only newParent

        // Verify newParent is the root
        const newParentNode = graphAfter?.nodes.get(newParent.id);
        expect(newParentNode?.parentId).toBeNull();
        expect(newParentNode?.childIds).toContain(root.id);

        // Verify root now has newParent as parent
        const rootNode = graphAfter?.nodes.get(root.id);
        expect(rootNode?.parentId).toBe(newParent.id);
    });

    it('should preserve all descendants in the forked branch', async () => {
        // Create a deeper tree:
        // root -> child -> grandchild -> greatGrandchild
        const root = await nodeManager.createNode('root', 'test.ts', 10);
        const child = await nodeManager.createChildNode(root.id, 'child', 'test.ts', 20);
        const grandchild = await nodeManager.createChildNode(child.id, 'grandchild', 'test.ts', 30);
        const greatGrandchild = await nodeManager.createChildNode(grandchild.id, 'greatGrandchild', 'test.ts', 40);

        // Add new parent to child
        const newParent = await nodeManager.createParentNode(child.id, 'newParent', 'other.ts', 45);

        const graphAfter = graphManager.getCurrentGraph();
        
        // Find the duplicated child
        const allNodes = Array.from(graphAfter?.nodes.values() || []);
        const duplicatedChild = allNodes.find(
            n => n.id !== child.id && n.name === 'child' && n.parentId === newParent.id
        );

        // Verify the entire descendant chain is preserved
        expect(duplicatedChild?.childIds).toContain(grandchild.id);
        
        const grandchildNode = graphAfter?.nodes.get(grandchild.id);
        expect(grandchildNode?.parentId).toBe(duplicatedChild?.id);
        expect(grandchildNode?.childIds).toContain(greatGrandchild.id);

        const greatGrandchildNode = graphAfter?.nodes.get(greatGrandchild.id);
        expect(greatGrandchildNode?.parentId).toBe(grandchild.id);
    });

    it('should maintain code properties in duplicated node', async () => {
        // Create nodes with code snippets
        const root = await nodeManager.createNode('root', 'test.ts', 10, 'const x = 1;');
        const child = await nodeManager.createChildNode(root.id, 'child', 'test.ts', 20);

        // Add new parent to child
        await nodeManager.createParentNode(child.id, 'newParent', 'other.ts', 45);

        const graphAfter = graphManager.getCurrentGraph();
        
        // Find the duplicated child
        const allNodes = Array.from(graphAfter?.nodes.values() || []);
        const duplicatedChild = allNodes.find(
            n => n.id !== child.id && n.name === 'child'
        );

        // Verify all properties are copied
        const originalChild = graphAfter?.nodes.get(child.id);
        expect(duplicatedChild?.name).toBe(originalChild?.name);
        expect(duplicatedChild?.filePath).toBe(originalChild?.filePath);
        expect(duplicatedChild?.lineNumber).toBe(originalChild?.lineNumber);
        expect(duplicatedChild?.codeSnippet).toBe(originalChild?.codeSnippet);
        expect(duplicatedChild?.codeHash).toBe(originalChild?.codeHash);
    });
});
