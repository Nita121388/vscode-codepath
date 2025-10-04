import { describe, it, expect, beforeEach } from 'vitest';
import { TextRenderer } from './TextRenderer';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';

describe('TextRenderer', () => {
    let renderer: TextRenderer;
    let graph: Graph;

    beforeEach(() => {
        renderer = new TextRenderer();
        graph = new Graph('test-graph', 'Test Graph');
    });

    describe('render', () => {
        it('should render empty graph correctly', () => {
            const result = renderer.render(graph);
            
            expect(result).toContain('Graph: Test Graph');
            expect(result).toContain('No nodes in this graph yet.');
        });

        it('should render single root node', () => {
            const node = new Node('node1', 'Root Node', '/src/main.ts', 10, 'console.log("hello")');
            graph.addNode(node);

            const result = renderer.render(graph);
            
            expect(result).toContain('Graph: Test Graph (1 nodes, 1 roots)');
            expect(result).toContain('└─ Root Node → main.ts:10');
        });

        it('should render hierarchical structure with parent-child relationships', () => {
            const parent = new Node('parent', 'Parent Node', '/src/parent.ts', 5);
            const child1 = new Node('child1', 'Child 1', '/src/child1.ts', 15);
            const child2 = new Node('child2', 'Child 2', '/src/child2.ts', 25);
            
            graph.addNode(parent);
            graph.addNode(child1);
            graph.addNode(child2);
            
            graph.setParentChild('parent', 'child1');
            graph.setParentChild('parent', 'child2');

            const result = renderer.render(graph);
            
            expect(result).toContain('Parent Node → parent.ts:5 (2 children)');
            expect(result).toContain('├─ Child 1 → child1.ts:15');
            expect(result).toContain('└─ Child 2 → child2.ts:25');
        });

        it('should render multiple root nodes', () => {
            const root1 = new Node('root1', 'Root 1', '/src/root1.ts', 1);
            const root2 = new Node('root2', 'Root 2', '/src/root2.ts', 2);
            
            graph.addNode(root1);
            graph.addNode(root2);

            const result = renderer.render(graph);
            
            expect(result).toContain('├─ Root 1 → root1.ts:1');
            expect(result).toContain('└─ Root 2 → root2.ts:2');
        });

        it('should mark current node with indicator', () => {
            const node = new Node('node1', 'Current Node', '/src/current.ts', 20);
            graph.addNode(node);
            graph.setCurrentNode('node1');

            const result = renderer.render(graph);
            
            expect(result).toContain('Current Node 🟢');
            expect(result).toContain('Current Node: Current Node → current.ts:20');
        });

        it('should render deep hierarchy correctly', () => {
            const grandparent = new Node('gp', 'Grandparent', '/src/gp.ts', 1);
            const parent = new Node('p', 'Parent', '/src/p.ts', 2);
            const child = new Node('c', 'Child', '/src/c.ts', 3);
            
            graph.addNode(grandparent);
            graph.addNode(parent);
            graph.addNode(child);
            
            graph.setParentChild('gp', 'p');
            graph.setParentChild('p', 'c');

            const result = renderer.render(graph);
            
            expect(result).toContain('└─ Grandparent → gp.ts:1 (1 children)');
            expect(result).toContain('  └─ Parent → p.ts:2 (1 children)');
            expect(result).toContain('    └─ Child → c.ts:3');
        });

        it('should handle complex branching structure', () => {
            const root = new Node('root', 'Root', '/src/root.ts', 1);
            const branch1 = new Node('b1', 'Branch 1', '/src/b1.ts', 10);
            const branch2 = new Node('b2', 'Branch 2', '/src/b2.ts', 20);
            const leaf1 = new Node('l1', 'Leaf 1', '/src/l1.ts', 30);
            const leaf2 = new Node('l2', 'Leaf 2', '/src/l2.ts', 40);
            
            graph.addNode(root);
            graph.addNode(branch1);
            graph.addNode(branch2);
            graph.addNode(leaf1);
            graph.addNode(leaf2);
            
            graph.setParentChild('root', 'b1');
            graph.setParentChild('root', 'b2');
            graph.setParentChild('b1', 'l1');
            graph.setParentChild('b2', 'l2');

            const result = renderer.render(graph);
            
            expect(result).toContain('└─ Root → root.ts:1 (2 children)');
            expect(result).toContain('  ├─ Branch 1 → b1.ts:10 (1 children)');
            expect(result).toContain('  │ └─ Leaf 1 → l1.ts:30');
            expect(result).toContain('  └─ Branch 2 → b2.ts:20 (1 children)');
            expect(result).toContain('    └─ Leaf 2 → l2.ts:40');
        });
    });

    describe('renderPath', () => {
        it('should render path from root to target node', () => {
            const root = new Node('root', 'Root', '/src/root.ts', 1);
            const middle = new Node('middle', 'Middle', '/src/middle.ts', 10);
            const target = new Node('target', 'Target', '/src/target.ts', 20);
            
            graph.addNode(root);
            graph.addNode(middle);
            graph.addNode(target);
            
            graph.setParentChild('root', 'middle');
            graph.setParentChild('middle', 'target');

            const result = renderer.renderPath(graph, 'target');
            
            expect(result).toBe('Path: Root (root.ts:1) → Middle (middle.ts:10) → Target (target.ts:20)');
        });

        it('should handle root node path', () => {
            const root = new Node('root', 'Root Node', '/src/root.ts', 5);
            graph.addNode(root);

            const result = renderer.renderPath(graph, 'root');
            
            expect(result).toBe('Path: Root Node (root.ts:5)');
        });

        it('should throw error for non-existent node', () => {
            expect(() => {
                renderer.renderPath(graph, 'non-existent');
            }).toThrow('Node with ID non-existent not found');
        });
    });

    describe('renderSummary', () => {
        it('should render basic graph summary', () => {
            const node1 = new Node('n1', 'Node 1', '/src/n1.ts', 1);
            const node2 = new Node('n2', 'Node 2', '/src/n2.ts', 2);
            
            graph.addNode(node1);
            graph.addNode(node2);

            const result = renderer.renderSummary(graph);
            
            expect(result).toBe('Graph: Test Graph | Nodes: 2 | Roots: 2 | Max Depth: 0');
        });

        it('should include current node in summary', () => {
            const node = new Node('node', 'Test Node', '/src/test.ts', 10);
            graph.addNode(node);
            graph.setCurrentNode('node');

            const result = renderer.renderSummary(graph);
            
            expect(result).toContain('Current: Test Node');
        });

        it('should calculate max depth correctly', () => {
            const root = new Node('root', 'Root', '/src/root.ts', 1);
            const child = new Node('child', 'Child', '/src/child.ts', 2);
            const grandchild = new Node('grandchild', 'Grandchild', '/src/gc.ts', 3);
            
            graph.addNode(root);
            graph.addNode(child);
            graph.addNode(grandchild);
            
            graph.setParentChild('root', 'child');
            graph.setParentChild('child', 'grandchild');

            const result = renderer.renderSummary(graph);
            
            expect(result).toContain('Max Depth: 2');
        });
    });

    describe('renderByFile', () => {
        it('should group nodes by file path', () => {
            const node1 = new Node('n1', 'Function A', '/src/utils.ts', 10);
            const node2 = new Node('n2', 'Function B', '/src/utils.ts', 20);
            const node3 = new Node('n3', 'Main Function', '/src/main.ts', 5);
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);

            const result = renderer.renderByFile(graph);
            
            expect(result).toContain('main.ts (/src/main.ts):');
            expect(result).toContain('utils.ts (/src/utils.ts):');
            expect(result).toContain('├─ Main Function :5 (root)');
            expect(result).toContain('├─ Function A :10 (root)');
            expect(result).toContain('├─ Function B :20 (root)');
        });

        it('should sort nodes by line number within files', () => {
            const node1 = new Node('n1', 'Function C', '/src/test.ts', 30);
            const node2 = new Node('n2', 'Function A', '/src/test.ts', 10);
            const node3 = new Node('n3', 'Function B', '/src/test.ts', 20);
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);

            const result = renderer.renderByFile(graph);
            
            const lines = result.split('\n');
            const functionAIndex = lines.findIndex(line => line.includes('Function A'));
            const functionBIndex = lines.findIndex(line => line.includes('Function B'));
            const functionCIndex = lines.findIndex(line => line.includes('Function C'));
            
            expect(functionAIndex).toBeLessThan(functionBIndex);
            expect(functionBIndex).toBeLessThan(functionCIndex);
        });

        it('should show parent-child relationships in file view', () => {
            const parent = new Node('parent', 'Parent', '/src/test.ts', 10);
            const child = new Node('child', 'Child', '/src/test.ts', 20);
            
            graph.addNode(parent);
            graph.addNode(child);
            graph.setParentChild('parent', 'child');

            const result = renderer.renderByFile(graph);
            
            expect(result).toContain('Parent :10 (1 children) (root)');
            expect(result).toContain('Child :20 (has parent)');
        });

        it('should handle empty graph in file view', () => {
            const result = renderer.renderByFile(graph);
            
            expect(result).toContain('No nodes in this graph yet.');
        });
    });

    describe('file name extraction', () => {
        it('should extract filename from various path formats', () => {
            const testCases = [
                { path: '/src/utils/helper.ts', expected: 'helper.ts' },
                { path: 'C:\\src\\main.ts', expected: 'main.ts' },
                { path: 'simple.js', expected: 'simple.js' },
                { path: '/deep/nested/path/file.py', expected: 'file.py' }
            ];

            for (const testCase of testCases) {
                const node = new Node('test', 'Test', testCase.path, 1);
                graph.addNode(node);
                
                const result = renderer.render(graph);
                expect(result).toContain(testCase.expected);
                
                graph.clear();
            }
        });
    });

    describe('edge cases', () => {
        it('should handle nodes with very long names', () => {
            const longName = 'A'.repeat(150);
            const node = new Node('long', longName, '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);
            
            expect(result).toContain(longName);
        });

        it('should handle nodes with special characters in names', () => {
            const specialName = 'Node with "quotes" & symbols!';
            const node = new Node('special', specialName, '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);
            
            expect(result).toContain(specialName);
        });

        it('should handle very deep hierarchies', () => {
            let currentParent: Node | null = null;
            
            // Create a 10-level deep hierarchy
            for (let i = 0; i < 10; i++) {
                const node = new Node(`node${i}`, `Level ${i}`, `/src/level${i}.ts`, i + 1);
                graph.addNode(node);
                
                if (currentParent) {
                    graph.setParentChild(currentParent.id, node.id);
                }
                currentParent = node;
            }

            const result = renderer.render(graph);
            
            expect(result).toContain('Level 0');
            expect(result).toContain('Level 9');
            // Should handle deep indentation without errors
            expect(result.length).toBeGreaterThan(0);
        });
    });
});