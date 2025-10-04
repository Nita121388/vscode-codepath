import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from './Graph';
import { Node } from './Node';

describe('Graph Model', () => {
    let graph: Graph;
    let node1: Node;
    let node2: Node;
    let node3: Node;

    beforeEach(() => {
        graph = new Graph('test_graph_1', 'Test Graph');
        
        node1 = new Node('node_1', 'Root Node', '/src/root.ts', 10);
        node2 = new Node('node_2', 'Child Node', '/src/child.ts', 20);
        node3 = new Node('node_3', 'Grandchild Node', '/src/grandchild.ts', 30);
    });

    describe('Constructor', () => {
        it('should create a valid graph with all properties', () => {
            expect(graph.id).toBe('test_graph_1');
            expect(graph.name).toBe('Test Graph');
            expect(graph.createdAt).toBeInstanceOf(Date);
            expect(graph.updatedAt).toBeInstanceOf(Date);
            expect(graph.nodes).toBeInstanceOf(Map);
            expect(graph.nodes.size).toBe(0);
            expect(graph.rootNodes).toEqual([]);
            expect(graph.currentNodeId).toBeNull();
        });
    });

    describe('ID Validation', () => {
        it('should throw error for empty ID', () => {
            expect(() => {
                new Graph('', 'Test Graph');
            }).toThrow('Graph ID must be a non-empty string');
        });

        it('should throw error for whitespace-only ID', () => {
            expect(() => {
                new Graph('   ', 'Test Graph');
            }).toThrow('Graph ID cannot be empty or whitespace only');
        });

        it('should throw error for ID with invalid characters', () => {
            expect(() => {
                new Graph('graph@#$', 'Test Graph');
            }).toThrow('Graph ID must contain only alphanumeric characters, underscores, and hyphens');
        });

        it('should accept valid ID formats', () => {
            const validIds = ['graph_1', 'graph-2', 'GRAPH123', 'test_graph_abc-123'];
            
            validIds.forEach(id => {
                expect(() => {
                    new Graph(id, 'Test Graph');
                }).not.toThrow();
            });
        });
    });

    describe('Name Validation', () => {
        it('should throw error for empty name', () => {
            expect(() => {
                new Graph('test_graph', '');
            }).toThrow('Graph name must be a non-empty string');
        });

        it('should throw error for whitespace-only name', () => {
            expect(() => {
                new Graph('test_graph', '   ');
            }).toThrow('Graph name cannot be empty or whitespace only');
        });

        it('should throw error for name exceeding 100 characters', () => {
            const longName = 'a'.repeat(101);
            expect(() => {
                new Graph('test_graph', longName);
            }).toThrow('Graph name cannot exceed 100 characters');
        });

        it('should accept valid names', () => {
            const validNames = ['Test Graph', '测试图表', 'Graph with symbols!@#', 'a'.repeat(100)];
            
            validNames.forEach(name => {
                expect(() => {
                    new Graph('test_graph', name);
                }).not.toThrow();
            });
        });
    });

    describe('Name Update', () => {
        it('should update name with validation', () => {
            const newName = 'Updated Graph Name';
            const oldUpdatedAt = graph.updatedAt;
            
            // Wait a bit to ensure timestamp difference
            setTimeout(() => {
                graph.updateName(newName);
                expect(graph.name).toBe(newName);
                expect(graph.updatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime());
            }, 1);
        });

        it('should throw error when updating with invalid name', () => {
            expect(() => {
                graph.updateName('');
            }).toThrow('Graph name must be a non-empty string');
        });
    });

    describe('Node Management', () => {
        it('should add a node to the graph', () => {
            graph.addNode(node1);
            
            expect(graph.nodes.size).toBe(1);
            expect(graph.nodes.has(node1.id)).toBe(true);
            expect(graph.rootNodes).toContain(node1.id);
        });

        it('should throw error when adding duplicate node', () => {
            graph.addNode(node1);
            
            expect(() => {
                graph.addNode(node1);
            }).toThrow(`Node with ID ${node1.id} already exists in the graph`);
        });

        it('should remove a node from the graph', () => {
            graph.addNode(node1);
            graph.removeNode(node1.id);
            
            expect(graph.nodes.size).toBe(0);
            expect(graph.nodes.has(node1.id)).toBe(false);
            expect(graph.rootNodes).not.toContain(node1.id);
        });

        it('should throw error when removing non-existent node', () => {
            expect(() => {
                graph.removeNode('non_existent');
            }).toThrow('Node with ID non_existent not found');
        });

        it('should get a node by ID', () => {
            graph.addNode(node1);
            const retrievedNode = graph.getNode(node1.id);
            
            expect(retrievedNode).toBe(node1);
        });

        it('should return undefined for non-existent node', () => {
            const retrievedNode = graph.getNode('non_existent');
            expect(retrievedNode).toBeUndefined();
        });

        it('should check if node exists', () => {
            expect(graph.hasNode(node1.id)).toBe(false);
            
            graph.addNode(node1);
            expect(graph.hasNode(node1.id)).toBe(true);
        });

        it('should get all nodes as array', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            
            const allNodes = graph.getAllNodes();
            expect(allNodes).toHaveLength(2);
            expect(allNodes).toContain(node1);
            expect(allNodes).toContain(node2);
        });

        it('should get node count', () => {
            expect(graph.getNodeCount()).toBe(0);
            
            graph.addNode(node1);
            expect(graph.getNodeCount()).toBe(1);
            
            graph.addNode(node2);
            expect(graph.getNodeCount()).toBe(2);
        });
    });

    describe('Parent-Child Relationships', () => {
        beforeEach(() => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
        });

        it('should establish parent-child relationship', () => {
            graph.setParentChild(node1.id, node2.id);
            
            expect(node1.childIds).toContain(node2.id);
            expect(node2.parentId).toBe(node1.id);
            expect(graph.rootNodes).not.toContain(node2.id);
        });

        it('should throw error when setting node as its own parent', () => {
            expect(() => {
                graph.setParentChild(node1.id, node1.id);
            }).toThrow('Node cannot be its own parent');
        });

        it('should throw error when parent node not found', () => {
            expect(() => {
                graph.setParentChild('non_existent', node2.id);
            }).toThrow('Parent node with ID non_existent not found');
        });

        it('should throw error when child node not found', () => {
            expect(() => {
                graph.setParentChild(node1.id, 'non_existent');
            }).toThrow('Child node non_existent not found');
        });

        it('should prevent cycles in relationships', () => {
            graph.setParentChild(node1.id, node2.id);
            graph.setParentChild(node2.id, node3.id);
            
            expect(() => {
                graph.setParentChild(node3.id, node1.id);
            }).toThrow('Cannot create parent-child relationship: would create a cycle');
        });

        it('should remove parent-child relationship', () => {
            graph.setParentChild(node1.id, node2.id);
            graph.removeParentChild(node1.id, node2.id);
            
            expect(node1.childIds).not.toContain(node2.id);
            expect(node2.parentId).toBeNull();
            expect(graph.rootNodes).toContain(node2.id);
        });

        it('should throw error when removing non-existent relationship', () => {
            expect(() => {
                graph.removeParentChild(node1.id, node2.id);
            }).toThrow(`Node ${node2.id} is not a child of node ${node1.id}`);
        });

        it('should get children of a node', () => {
            graph.setParentChild(node1.id, node2.id);
            graph.setParentChild(node1.id, node3.id);
            
            const children = graph.getChildren(node1.id);
            expect(children).toHaveLength(2);
            expect(children).toContain(node2);
            expect(children).toContain(node3);
        });

        it('should get parent of a node', () => {
            graph.setParentChild(node1.id, node2.id);
            
            const parent = graph.getParent(node2.id);
            expect(parent).toBe(node1);
        });

        it('should return null for node without parent', () => {
            const parent = graph.getParent(node1.id);
            expect(parent).toBeNull();
        });

        it('should get root nodes', () => {
            graph.setParentChild(node1.id, node2.id);
            
            const rootNodes = graph.getRootNodes();
            expect(rootNodes).toHaveLength(2); // node1 and node3 are roots
            expect(rootNodes).toContain(node1);
            expect(rootNodes).toContain(node3);
            expect(rootNodes).not.toContain(node2);
        });
    });

    describe('Node Hierarchy Navigation', () => {
        beforeEach(() => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
            
            // Create hierarchy: node1 -> node2 -> node3
            graph.setParentChild(node1.id, node2.id);
            graph.setParentChild(node2.id, node3.id);
        });

        it('should get all descendants of a node', () => {
            const descendants = graph.getDescendants(node1.id);
            expect(descendants).toHaveLength(2);
            expect(descendants).toContain(node2);
            expect(descendants).toContain(node3);
        });

        it('should get all ancestors of a node', () => {
            const ancestors = graph.getAncestors(node3.id);
            expect(ancestors).toHaveLength(2);
            expect(ancestors).toContain(node1);
            expect(ancestors).toContain(node2);
        });

        it('should return empty array for root node ancestors', () => {
            const ancestors = graph.getAncestors(node1.id);
            expect(ancestors).toHaveLength(0);
        });

        it('should return empty array for leaf node descendants', () => {
            const descendants = graph.getDescendants(node3.id);
            expect(descendants).toHaveLength(0);
        });
    });

    describe('Node Removal with Relationship Handling', () => {
        beforeEach(() => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
            
            // Create hierarchy: node1 -> node2 -> node3
            graph.setParentChild(node1.id, node2.id);
            graph.setParentChild(node2.id, node3.id);
        });

        it('should promote children to root when removing root node', () => {
            graph.removeNode(node1.id);
            
            expect(graph.nodes.has(node1.id)).toBe(false);
            expect(node2.parentId).toBeNull();
            expect(graph.rootNodes).toContain(node2.id);
        });

        it('should reassign children to grandparent when removing middle node', () => {
            graph.removeNode(node2.id);
            
            expect(graph.nodes.has(node2.id)).toBe(false);
            expect(node3.parentId).toBe(node1.id);
            expect(node1.childIds).toContain(node3.id);
        });

        it('should clear current node when removing it', () => {
            graph.setCurrentNode(node2.id);
            graph.removeNode(node2.id);
            
            expect(graph.currentNodeId).toBeNull();
        });
    });

    describe('Current Node Management', () => {
        beforeEach(() => {
            graph.addNode(node1);
        });

        it('should set current node', () => {
            graph.setCurrentNode(node1.id);
            expect(graph.currentNodeId).toBe(node1.id);
        });

        it('should clear current node', () => {
            graph.setCurrentNode(node1.id);
            graph.setCurrentNode(null);
            expect(graph.currentNodeId).toBeNull();
        });

        it('should throw error when setting non-existent node as current', () => {
            expect(() => {
                graph.setCurrentNode('non_existent');
            }).toThrow('Node with ID non_existent not found');
        });

        it('should get current node', () => {
            graph.setCurrentNode(node1.id);
            const currentNode = graph.getCurrentNode();
            expect(currentNode).toBe(node1);
        });

        it('should return null when no current node set', () => {
            const currentNode = graph.getCurrentNode();
            expect(currentNode).toBeNull();
        });
    });

    describe('Node Search', () => {
        beforeEach(() => {
            node1.updateName('Authentication Handler');
            node2.updateName('Login Validator');
            node3.updateName('Password Checker');
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
        });

        it('should find nodes by name (case-insensitive partial match)', () => {
            const results = graph.findNodesByName('auth');
            expect(results).toHaveLength(1);
            expect(results[0]).toBe(node1);
        });

        it('should find multiple nodes by partial name match', () => {
            const results = graph.findNodesByName('valid');
            expect(results).toHaveLength(1);
            expect(results[0]).toBe(node2);
        });

        it('should return empty array when no matches found', () => {
            const results = graph.findNodesByName('nonexistent');
            expect(results).toHaveLength(0);
        });

        it('should find nodes by file path', () => {
            const results = graph.findNodesByFilePath('/src/root.ts');
            expect(results).toHaveLength(1);
            expect(results[0]).toBe(node1);
        });

        it('should find nodes by location (file path and line number)', () => {
            const results = graph.findNodesByLocation('/src/child.ts', 20);
            expect(results).toHaveLength(1);
            expect(results[0]).toBe(node2);
        });
    });

    describe('Graph Validation', () => {
        it('should validate a correct graph without errors', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setParentChild(node1.id, node2.id);
            
            expect(() => {
                graph.validate();
            }).not.toThrow();
        });

        it('should detect missing root node in collection', () => {
            graph.addNode(node1);
            graph.rootNodes.push('non_existent');
            
            expect(() => {
                graph.validate();
            }).toThrow('Root node non_existent not found in nodes collection');
        });

        it('should detect root node with parent', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setParentChild(node1.id, node2.id);
            
            // Manually corrupt the data
            graph.rootNodes.push(node2.id);
            
            expect(() => {
                graph.validate();
            }).toThrow(`Root node ${node2.id} has a parent, but should not`);
        });

        it('should detect orphaned node (no parent but not in root nodes)', () => {
            graph.addNode(node1);
            
            // Remove from root nodes but keep node
            graph.rootNodes = [];
            
            expect(() => {
                graph.validate();
            }).toThrow(`Node ${node1.id} has no parent but is not in root nodes list`);
        });

        it('should detect broken parent reference', () => {
            graph.addNode(node1);
            
            // Manually set invalid parent and remove from root nodes
            node1.setParent('non_existent');
            graph.rootNodes = graph.rootNodes.filter(id => id !== node1.id);
            
            expect(() => {
                graph.validate();
            }).toThrow(`Node ${node1.id} references non-existent parent non_existent`);
        });

        it('should detect broken child reference', () => {
            graph.addNode(node1);
            
            // Manually add invalid child
            node1.addChild('non_existent');
            
            expect(() => {
                graph.validate();
            }).toThrow(`Node ${node1.id} references non-existent child non_existent`);
        });

        it('should detect inconsistent parent-child relationship', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            
            // Create inconsistent relationship
            node1.addChild(node2.id);
            // Don't set node2's parent
            
            expect(() => {
                graph.validate();
            }).toThrow(`Child node ${node2.id} does not reference ${node1.id} as parent`);
        });

        it('should detect cycles in graph structure', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            
            // Manually create a cycle (bypassing the prevention logic)
            node1.addChild(node2.id);
            node2.setParent(node1.id);
            node2.addChild(node1.id);
            node1.setParent(node2.id);
            
            // Remove both from root nodes since they now have parents
            graph.rootNodes = [];
            
            expect(() => {
                graph.validate();
            }).toThrow('Cycle detected in graph structure');
        });
    });

    describe('Graph Operations', () => {
        it('should clear all nodes from graph', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setCurrentNode(node1.id);
            
            graph.clear();
            
            expect(graph.nodes.size).toBe(0);
            expect(graph.rootNodes).toHaveLength(0);
            expect(graph.currentNodeId).toBeNull();
        });
    });

    describe('Serialization', () => {
        beforeEach(() => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setParentChild(node1.id, node2.id);
            graph.setCurrentNode(node2.id);
        });

        it('should serialize to JSON correctly', () => {
            const json = graph.toJSON();
            
            expect(json.id).toBe(graph.id);
            expect(json.name).toBe(graph.name);
            expect(json.createdAt).toBe(graph.createdAt);
            expect(json.updatedAt).toBe(graph.updatedAt);
            expect(json.nodes).toBeInstanceOf(Map);
            expect(json.rootNodes).toEqual(graph.rootNodes);
            expect(json.currentNodeId).toBe(graph.currentNodeId);
        });

        it('should create graph from JSON correctly', () => {
            const json = graph.toJSON();
            const reconstructedGraph = Graph.fromJSON(json);
            
            expect(reconstructedGraph.id).toBe(graph.id);
            expect(reconstructedGraph.name).toBe(graph.name);
            expect(reconstructedGraph.createdAt.getTime()).toBe(graph.createdAt.getTime());
            expect(reconstructedGraph.updatedAt.getTime()).toBe(graph.updatedAt.getTime());
            expect(reconstructedGraph.nodes.size).toBe(graph.nodes.size);
            expect(reconstructedGraph.rootNodes).toEqual(graph.rootNodes);
            expect(reconstructedGraph.currentNodeId).toBe(graph.currentNodeId);
        });

        it('should validate reconstructed graph from JSON', () => {
            const json = graph.toJSON();
            
            expect(() => {
                Graph.fromJSON(json);
            }).not.toThrow();
        });
    });

    describe('ID Generation', () => {
        it('should generate unique IDs', () => {
            const id1 = Graph.generateId();
            const id2 = Graph.generateId();
            
            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^graph_[a-z0-9]+_[a-z0-9]+$/);
            expect(id2).toMatch(/^graph_[a-z0-9]+_[a-z0-9]+$/);
        });

        it('should generate valid ID format', () => {
            const id = Graph.generateId();
            
            expect(() => {
                new Graph(id, 'Test Graph');
            }).not.toThrow();
        });
    });

    describe('Graph Repair', () => {
        it('should repair graph with invalid child references', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            
            // Manually corrupt the graph by adding invalid child reference
            node1.addChild('non_existent_child');
            
            // Repair should fix this
            graph.repair();
            
            expect(node1.childIds).not.toContain('non_existent_child');
            expect(() => graph.validate()).not.toThrow();
        });

        it('should repair graph with invalid parent references', () => {
            graph.addNode(node1);
            
            // Manually corrupt by setting invalid parent
            node1.setParent('non_existent_parent');
            graph.rootNodes = []; // Remove from root nodes
            
            // Repair should fix this
            graph.repair();
            
            expect(node1.parentId).toBeNull();
            expect(graph.rootNodes).toContain(node1.id);
            expect(() => graph.validate()).not.toThrow();
        });

        it('should repair graph with invalid root node references', () => {
            graph.addNode(node1);
            
            // Manually add invalid root node reference
            graph.rootNodes.push('non_existent_root');
            
            // Repair should fix this
            graph.repair();
            
            expect(graph.rootNodes).not.toContain('non_existent_root');
            expect(() => graph.validate()).not.toThrow();
        });

        it('should add orphaned nodes to root nodes', () => {
            graph.addNode(node1);
            
            // Remove from root nodes but keep node
            graph.rootNodes = [];
            
            // Repair should fix this
            graph.repair();
            
            expect(graph.rootNodes).toContain(node1.id);
            expect(() => graph.validate()).not.toThrow();
        });

        it('should auto-repair when loading corrupted graph from JSON', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            graph.setParentChild(node1.id, node2.id);
            
            const json = graph.toJSON();
            
            // Manually corrupt the JSON data
            const node1Data = json.nodes.get(node1.id);
            if (node1Data) {
                node1Data.childIds.push('non_existent_child');
            }
            
            // fromJSON should auto-repair
            const reconstructedGraph = Graph.fromJSON(json);
            
            const reconstructedNode1 = reconstructedGraph.getNode(node1.id);
            expect(reconstructedNode1?.childIds).not.toContain('non_existent_child');
            expect(() => reconstructedGraph.validate()).not.toThrow();
        });

        it('should handle multiple corruption issues in one repair', () => {
            graph.addNode(node1);
            graph.addNode(node2);
            
            // Create multiple corruption issues
            node1.addChild('non_existent_child_1');
            node1.addChild('non_existent_child_2');
            node2.setParent('non_existent_parent');
            graph.rootNodes = ['non_existent_root'];
            
            // Repair should fix all issues
            graph.repair();
            
            expect(node1.childIds).not.toContain('non_existent_child_1');
            expect(node1.childIds).not.toContain('non_existent_child_2');
            expect(node2.parentId).toBeNull();
            expect(graph.rootNodes).not.toContain('non_existent_root');
            expect(graph.rootNodes).toContain(node1.id);
            expect(graph.rootNodes).toContain(node2.id);
            expect(() => graph.validate()).not.toThrow();
        });

        it('should clear invalid current node reference', () => {
            graph.addNode(node1);
            graph.setCurrentNode(node1.id);
            
            // Manually set invalid current node
            (graph as any).currentNodeId = 'non_existent_node';
            
            // Repair should fix this
            graph.repair();
            
            expect(graph.currentNodeId).toBeNull();
            expect(() => graph.validate()).not.toThrow();
        });

        it('should preserve valid current node reference', () => {
            graph.addNode(node1);
            graph.setCurrentNode(node1.id);
            
            // Repair should not change valid current node
            graph.repair();
            
            expect(graph.currentNodeId).toBe(node1.id);
            expect(() => graph.validate()).not.toThrow();
        });
    });
});