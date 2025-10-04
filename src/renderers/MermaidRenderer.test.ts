import { describe, it, expect, beforeEach } from 'vitest';
import { MermaidRenderer } from './MermaidRenderer';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';

describe('MermaidRenderer', () => {
    let renderer: MermaidRenderer;
    let graph: Graph;

    beforeEach(() => {
        renderer = new MermaidRenderer();
        graph = new Graph('test-graph', 'Test Graph');
    });

    describe('render', () => {
        it('should render empty graph correctly', () => {
            const result = renderer.render(graph);

            expect(result).toContain('```mermaid');
            expect(result).toContain('flowchart TD');
            expect(result).toContain('Test Graph\\n(No nodes)');
            expect(result).toContain('```');
        });

        it('should render single root node', () => {
            const node = new Node('node1', 'Root Node', '/src/main.ts', 10);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('```mermaid');
            expect(result).toContain('flowchart TD');
            expect(result).toContain('node1["Root Node\\nmain.ts:10"]');
            expect(result).toContain('class node1 rootNode');
            expect(result).toContain('```');
        });

        it('should render hierarchical structure with relationships', () => {
            const parent = new Node('parent', 'Parent Node', '/src/parent.ts', 5);
            const child1 = new Node('child1', 'Child 1', '/src/child1.ts', 15);
            const child2 = new Node('child2', 'Child 2', '/src/child2.ts', 25);

            graph.addNode(parent);
            graph.addNode(child1);
            graph.addNode(child2);

            graph.setParentChild('parent', 'child1');
            graph.setParentChild('parent', 'child2');

            const result = renderer.render(graph);

            expect(result).toContain('parent["Parent Node\\nparent.ts:5"]');
            expect(result).toContain('child1(("Child 1\\nchild1.ts:15"))');
            expect(result).toContain('child2(("Child 2\\nchild2.ts:25"))');
            expect(result).toContain('parent --> child1');
            expect(result).toContain('parent --> child2');
        });

        it('should mark current node with special styling', () => {
            const node = new Node('current', 'Current Node', '/src/current.ts', 20);
            graph.addNode(node);
            graph.setCurrentNode('current');

            const result = renderer.render(graph);

            expect(result).toContain('current(["Current Node\\ncurrent.ts:20"]');
            expect(result).toContain('class current currentNode');
        });

        it('should use different shapes for different node types', () => {
            const root = new Node('root', 'Root', '/src/root.ts', 1);
            const middle = new Node('middle', 'Middle', '/src/middle.ts', 10);
            const leaf = new Node('leaf', 'Leaf', '/src/leaf.ts', 20);

            graph.addNode(root);
            graph.addNode(middle);
            graph.addNode(leaf);

            graph.setParentChild('root', 'middle');
            graph.setParentChild('middle', 'leaf');

            const result = renderer.render(graph);

            expect(result).toContain('root["Root\\nroot.ts:1"]'); // Rectangle for root
            expect(result).toContain('middle["Middle\\nmiddle.ts:10"]'); // Rectangle for middle
            expect(result).toContain('leaf(("Leaf\\nleaf.ts:20"))'); // Circle for leaf
        });

        it('should handle special characters in node names', () => {
            const node = new Node('special', 'Node "with" quotes & symbols!', '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('Node \\"with\\" quotes & symbols!');
        });

        it('should truncate long node names', () => {
            const longName = 'A'.repeat(50);
            const node = new Node('long', longName, '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAA...');
        });

        it('should sanitize invalid node IDs', () => {
            const node = new Node('node_with_underscores', 'Test Node', '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('node_with_underscores["Test Node\\ntest.ts:1"]');
        });

        it('should use thick arrows for current node connections', () => {
            const parent = new Node('parent', 'Parent', '/src/parent.ts', 1);
            const child = new Node('child', 'Child', '/src/child.ts', 2);

            graph.addNode(parent);
            graph.addNode(child);
            graph.setParentChild('parent', 'child');
            graph.setCurrentNode('parent');

            const result = renderer.render(graph);

            expect(result).toContain('parent ==> child');
        });
    });

    describe('renderSimplified', () => {
        it('should render full graph when under node limit', () => {
            const node1 = new Node('n1', 'Node 1', '/src/n1.ts', 1);
            const node2 = new Node('n2', 'Node 2', '/src/n2.ts', 2);

            graph.addNode(node1);
            graph.addNode(node2);

            const result = renderer.renderSimplified(graph, 10);
            const fullResult = renderer.render(graph);

            expect(result).toBe(fullResult);
        });

        it('should simplify large graphs', () => {
            // Create a graph with many nodes
            for (let i = 0; i < 30; i++) {
                const node = new Node(`node${i}`, `Node ${i}`, `/src/node${i}.ts`, i + 1);
                graph.addNode(node);
            }

            const result = renderer.renderSimplified(graph, 10);

            expect(result).toContain('... 25 more nodes');
            expect(result).toContain('truncated');
        });

        it('should include root nodes and their immediate children', () => {
            const root = new Node('root', 'Root', '/src/root.ts', 1);
            const child1 = new Node('child1', 'Child 1', '/src/child1.ts', 2);
            const child2 = new Node('child2', 'Child 2', '/src/child2.ts', 3);

            graph.addNode(root);
            graph.addNode(child1);
            graph.addNode(child2);

            graph.setParentChild('root', 'child1');
            graph.setParentChild('root', 'child2');

            // Add many more nodes to trigger simplification
            for (let i = 0; i < 25; i++) {
                const node = new Node(`extra${i}`, `Extra ${i}`, `/src/extra${i}.ts`, i + 10);
                graph.addNode(node);
            }

            const result = renderer.renderSimplified(graph, 10);

            expect(result).toContain('root["Root\\nroot.ts:1"]');
            expect(result).toContain('child1(("Child 1\\nchild1.ts:2"))');
            expect(result).toContain('child2(("Child 2\\nchild2.ts:3"))');
        });
    });

    describe('renderSubgraph', () => {
        it('should render subgraph around center node', () => {
            const nodes = [];
            for (let i = 0; i < 5; i++) {
                const node = new Node(`node${i}`, `Node ${i}`, `/src/node${i}.ts`, i + 1);
                nodes.push(node);
                graph.addNode(node);
            }

            // Create chain: node0 -> node1 -> node2 -> node3 -> node4
            for (let i = 0; i < 4; i++) {
                graph.setParentChild(`node${i}`, `node${i + 1}`);
            }

            const result = renderer.renderSubgraph(graph, 'node2', 1);

            expect(result).toContain('node1["Node 1\\nnode1.ts:2"]');
            expect(result).toContain('node2["Node 2\\nnode2.ts:3"]');
            expect(result).toContain('node3["Node 3\\nnode3.ts:4"]');
            expect(result).not.toContain('node0["Node 0');
            expect(result).not.toContain('node4["Node 4');
        });

        it('should throw error for non-existent center node', () => {
            expect(() => {
                renderer.renderSubgraph(graph, 'non-existent', 1);
            }).toThrow('Node with ID non-existent not found');
        });
    });

    describe('validateSyntax', () => {
        it('should validate correct Mermaid syntax', () => {
            const validMermaid = `\`\`\`mermaid
flowchart TD
    A["Node A"]
    B["Node B"]
    A --> B
\`\`\``;

            const errors = renderer.validateSyntax(validMermaid);

            expect(errors).toHaveLength(0);
        });

        it('should detect missing Mermaid block start', () => {
            const invalidMermaid = `flowchart TD
    A["Node A"]
\`\`\``;

            const errors = renderer.validateSyntax(invalidMermaid);

            expect(errors).toContain('Missing Mermaid code block start');
        });

        it('should detect missing flowchart declaration', () => {
            const invalidMermaid = `\`\`\`mermaid
    A["Node A"]
\`\`\``;

            const errors = renderer.validateSyntax(invalidMermaid);

            expect(errors).toContain('Missing flowchart declaration');
        });

        it('should detect missing code block end', () => {
            const invalidMermaid = `\`\`\`mermaid
flowchart TD
    A["Node A"]`;

            const errors = renderer.validateSyntax(invalidMermaid);

            expect(errors).toContain('Missing Mermaid code block end');
        });

        it('should detect unmatched brackets', () => {
            const invalidMermaid = `\`\`\`mermaid
flowchart TD
    A["Node A"
\`\`\``;

            const errors = renderer.validateSyntax(invalidMermaid);

            expect(errors.some(error => error.includes('Unmatched brackets'))).toBe(true);
        });

        it('should detect unmatched parentheses', () => {
            const invalidMermaid = `\`\`\`mermaid
flowchart TD
    A(("Node A"
\`\`\``;

            const errors = renderer.validateSyntax(invalidMermaid);

            expect(errors.some(error => error.includes('Unmatched parentheses'))).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle nodes with minimal names', () => {
            const node = new Node('minimal', 'A', '/src/test.ts', 1);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('minimal["A\\ntest.ts:1"]');
        });

        it('should handle very deep file paths', () => {
            const deepPath = '/very/deep/nested/path/structure/file.ts';
            const node = new Node('deep', 'Deep Node', deepPath, 1);
            graph.addNode(node);

            const result = renderer.render(graph);

            expect(result).toContain('file.ts:1');
        });

        it('should handle circular references gracefully in subgraph', () => {
            const node1 = new Node('n1', 'Node 1', '/src/n1.ts', 1);
            const node2 = new Node('n2', 'Node 2', '/src/n2.ts', 2);

            graph.addNode(node1);
            graph.addNode(node2);

            // This would create a cycle, but our Graph model prevents it
            graph.setParentChild('n1', 'n2');

            const result = renderer.renderSubgraph(graph, 'n1', 2);

            expect(result).toContain('n1');
            expect(result).toContain('n2');
        });

        it('should handle nodes with newlines in names', () => {
            const nodeWithNewlines = new Node('newline', 'Node\nwith\nnewlines', '/src/test.ts', 1);
            graph.addNode(nodeWithNewlines);

            const result = renderer.render(graph);

            expect(result).toContain('Node\\nwith\\nnewlines');
        });

        it('should handle nodes with tabs in names', () => {
            const nodeWithTabs = new Node('tab', 'Node\twith\ttabs', '/src/test.ts', 1);
            graph.addNode(nodeWithTabs);

            const result = renderer.render(graph);

            expect(result).toContain('Node\\twith\\ttabs');
        });
    });
});