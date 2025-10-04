import { describe, it, expect, beforeEach } from 'vitest';
import { Node } from './Node';

describe('Node Model', () => {
    let validNodeData: {
        id: string;
        name: string;
        filePath: string;
        lineNumber: number;
        codeSnippet?: string;
    };

    beforeEach(() => {
        validNodeData = {
            id: 'test_node_1',
            name: 'Test Node',
            filePath: '/src/test.ts',
            lineNumber: 10,
            codeSnippet: 'function test() { return true; }'
        };
    });

    describe('Constructor', () => {
        it('should create a valid node with all properties', () => {
            const node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber,
                validNodeData.codeSnippet
            );

            expect(node.id).toBe(validNodeData.id);
            expect(node.name).toBe(validNodeData.name);
            expect(node.filePath).toBe(validNodeData.filePath);
            expect(node.lineNumber).toBe(validNodeData.lineNumber);
            expect(node.codeSnippet).toBe(validNodeData.codeSnippet);
            expect(node.createdAt).toBeInstanceOf(Date);
            expect(node.parentId).toBeNull();
            expect(node.childIds).toEqual([]);
        });

        it('should create a valid node without code snippet', () => {
            const node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber
            );

            expect(node.codeSnippet).toBeUndefined();
        });

        it('should create a node with parent ID', () => {
            const parentId = 'parent_node_1';
            const node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber,
                validNodeData.codeSnippet,
                parentId
            );

            expect(node.parentId).toBe(parentId);
        });
    });

    describe('ID Validation', () => {
        it('should throw error for empty ID', () => {
            expect(() => {
                new Node('', validNodeData.name, validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node ID must be a non-empty string');
        });

        it('should throw error for whitespace-only ID', () => {
            expect(() => {
                new Node('   ', validNodeData.name, validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node ID cannot be empty or whitespace only');
        });

        it('should throw error for ID with invalid characters', () => {
            expect(() => {
                new Node('node@#$', validNodeData.name, validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node ID must contain only alphanumeric characters, underscores, and hyphens');
        });

        it('should accept valid ID formats', () => {
            const validIds = ['node_1', 'node-2', 'NODE123', 'test_node_abc-123'];
            
            validIds.forEach(id => {
                expect(() => {
                    new Node(id, validNodeData.name, validNodeData.filePath, validNodeData.lineNumber);
                }).not.toThrow();
            });
        });
    });

    describe('Name Validation', () => {
        it('should throw error for empty name', () => {
            expect(() => {
                new Node(validNodeData.id, '', validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node name must be a non-empty string');
        });

        it('should throw error for whitespace-only name', () => {
            expect(() => {
                new Node(validNodeData.id, '   ', validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node name cannot be empty or whitespace only');
        });

        it('should throw error for name exceeding 200 characters', () => {
            const longName = 'a'.repeat(201);
            expect(() => {
                new Node(validNodeData.id, longName, validNodeData.filePath, validNodeData.lineNumber);
            }).toThrow('Node name cannot exceed 200 characters');
        });

        it('should accept valid names', () => {
            const validNames = ['Test Node', 'function_name', '测试节点', 'Node with spaces and symbols!@#'];
            
            validNames.forEach(name => {
                expect(() => {
                    new Node(validNodeData.id, name, validNodeData.filePath, validNodeData.lineNumber);
                }).not.toThrow();
            });
        });
    });

    describe('File Path Validation', () => {
        it('should throw error for empty file path', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, '', validNodeData.lineNumber);
            }).toThrow('File path must be a non-empty string');
        });

        it('should throw error for whitespace-only file path', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, '   ', validNodeData.lineNumber);
            }).toThrow('File path cannot be empty or whitespace only');
        });

        it('should throw error for file path with invalid characters', () => {
            const invalidPaths = ['/src/test<.ts', '/src/test>.ts', '/src/test|.ts', '/src/test?.ts'];
            
            invalidPaths.forEach(path => {
                expect(() => {
                    new Node(validNodeData.id, validNodeData.name, path, validNodeData.lineNumber);
                }).toThrow('File path contains invalid characters');
            });
        });

        it('should accept valid file paths', () => {
            const validPaths = ['/src/test.ts', 'C:\\src\\test.js', './relative/path.py', '../parent/file.txt'];
            
            validPaths.forEach(path => {
                expect(() => {
                    new Node(validNodeData.id, validNodeData.name, path, validNodeData.lineNumber);
                }).not.toThrow();
            });
        });
    });

    describe('Line Number Validation', () => {
        it('should throw error for non-number line number', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, '10' as any);
            }).toThrow('Line number must be a number');
        });

        it('should throw error for non-integer line number', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, 10.5);
            }).toThrow('Line number must be an integer');
        });

        it('should throw error for line number less than 1', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, 0);
            }).toThrow('Line number must be greater than 0');
        });

        it('should throw error for line number exceeding 1,000,000', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, 1000001);
            }).toThrow('Line number cannot exceed 1,000,000');
        });

        it('should accept valid line numbers', () => {
            const validLineNumbers = [1, 10, 100, 1000, 999999, 1000000];
            
            validLineNumbers.forEach(lineNumber => {
                expect(() => {
                    new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, lineNumber);
                }).not.toThrow();
            });
        });
    });

    describe('Code Snippet Validation', () => {
        it('should throw error for non-string code snippet', () => {
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, validNodeData.lineNumber, 123 as any);
            }).toThrow('Code snippet must be a string');
        });

        it('should throw error for code snippet exceeding 5000 characters', () => {
            const longSnippet = 'a'.repeat(5001);
            expect(() => {
                new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, validNodeData.lineNumber, longSnippet);
            }).toThrow('Code snippet cannot exceed 5000 characters');
        });

        it('should accept valid code snippets', () => {
            const validSnippets = ['function test() {}', '', 'a'.repeat(5000)];
            
            validSnippets.forEach(snippet => {
                expect(() => {
                    new Node(validNodeData.id, validNodeData.name, validNodeData.filePath, validNodeData.lineNumber, snippet);
                }).not.toThrow();
            });
        });
    });

    describe('Update Methods', () => {
        let node: Node;

        beforeEach(() => {
            node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber,
                validNodeData.codeSnippet
            );
        });

        it('should update name with validation', () => {
            const newName = 'Updated Node Name';
            node.updateName(newName);
            expect(node.name).toBe(newName);
        });

        it('should throw error when updating with invalid name', () => {
            expect(() => {
                node.updateName('');
            }).toThrow('Node name must be a non-empty string');
        });

        it('should update file path with validation', () => {
            const newPath = '/src/updated.ts';
            node.updateFilePath(newPath);
            expect(node.filePath).toBe(newPath);
        });

        it('should update line number with validation', () => {
            const newLineNumber = 25;
            node.updateLineNumber(newLineNumber);
            expect(node.lineNumber).toBe(newLineNumber);
        });

        it('should update code snippet with validation', () => {
            const newSnippet = 'const updated = true;';
            node.updateCodeSnippet(newSnippet);
            expect(node.codeSnippet).toBe(newSnippet);
        });

        it('should clear code snippet when updating with undefined', () => {
            node.updateCodeSnippet(undefined);
            expect(node.codeSnippet).toBeUndefined();
        });
    });

    describe('Parent-Child Relationship Management', () => {
        let node: Node;

        beforeEach(() => {
            node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber
            );
        });

        it('should add child node ID', () => {
            const childId = 'child_node_1';
            node.addChild(childId);
            expect(node.childIds).toContain(childId);
        });

        it('should throw error when adding invalid child ID', () => {
            expect(() => {
                node.addChild('');
            }).toThrow('Node ID must be a non-empty string');
        });

        it('should throw error when adding self as child', () => {
            expect(() => {
                node.addChild(node.id);
            }).toThrow('Node cannot be its own child');
        });

        it('should throw error when adding duplicate child', () => {
            const childId = 'child_node_1';
            node.addChild(childId);
            expect(() => {
                node.addChild(childId);
            }).toThrow(`Child node ${childId} already exists`);
        });

        it('should remove child node ID', () => {
            const childId = 'child_node_1';
            node.addChild(childId);
            node.removeChild(childId);
            expect(node.childIds).not.toContain(childId);
        });

        it('should throw error when removing non-existent child', () => {
            const childId = 'non_existent_child';
            expect(() => {
                node.removeChild(childId);
            }).toThrow(`Child node ${childId} not found`);
        });

        it('should set parent ID', () => {
            const parentId = 'parent_node_1';
            node.setParent(parentId);
            expect(node.parentId).toBe(parentId);
        });

        it('should clear parent ID when setting to null', () => {
            node.setParent('parent_node_1');
            node.setParent(null);
            expect(node.parentId).toBeNull();
        });

        it('should throw error when setting self as parent', () => {
            expect(() => {
                node.setParent(node.id);
            }).toThrow('Node cannot be its own parent');
        });
    });

    describe('Node State Queries', () => {
        let node: Node;

        beforeEach(() => {
            node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber
            );
        });

        it('should correctly identify if node has children', () => {
            expect(node.hasChildren()).toBe(false);
            node.addChild('child_1');
            expect(node.hasChildren()).toBe(true);
        });

        it('should correctly identify if node has parent', () => {
            expect(node.hasParent()).toBe(false);
            node.setParent('parent_1');
            expect(node.hasParent()).toBe(true);
        });

        it('should correctly identify root node', () => {
            expect(node.isRoot()).toBe(true);
            node.setParent('parent_1');
            expect(node.isRoot()).toBe(false);
        });

        it('should correctly identify leaf node', () => {
            expect(node.isLeaf()).toBe(true);
            node.addChild('child_1');
            expect(node.isLeaf()).toBe(false);
        });
    });

    describe('Validation Method', () => {
        it('should validate a correct node without errors', () => {
            const node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber,
                validNodeData.codeSnippet
            );
            
            expect(() => {
                node.validate();
            }).not.toThrow();
        });

        it('should detect duplicate child IDs', () => {
            const node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber
            );
            
            // Manually add duplicate child IDs to test validation
            node.childIds.push('child_1', 'child_1');
            
            expect(() => {
                node.validate();
            }).toThrow('Duplicate child IDs found');
        });
    });

    describe('Serialization', () => {
        let node: Node;

        beforeEach(() => {
            node = new Node(
                validNodeData.id,
                validNodeData.name,
                validNodeData.filePath,
                validNodeData.lineNumber,
                validNodeData.codeSnippet
            );
            node.addChild('child_1');
            node.setParent('parent_1');
        });

        it('should serialize to JSON correctly', () => {
            const json = node.toJSON();
            
            expect(json.id).toBe(node.id);
            expect(json.name).toBe(node.name);
            expect(json.filePath).toBe(node.filePath);
            expect(json.lineNumber).toBe(node.lineNumber);
            expect(json.codeSnippet).toBe(node.codeSnippet);
            expect(json.createdAt).toBe(node.createdAt);
            expect(json.parentId).toBe(node.parentId);
            expect(json.childIds).toEqual(node.childIds);
        });

        it('should create node from JSON correctly', () => {
            const json = node.toJSON();
            const reconstructedNode = Node.fromJSON(json);
            
            expect(reconstructedNode.id).toBe(node.id);
            expect(reconstructedNode.name).toBe(node.name);
            expect(reconstructedNode.filePath).toBe(node.filePath);
            expect(reconstructedNode.lineNumber).toBe(node.lineNumber);
            expect(reconstructedNode.codeSnippet).toBe(node.codeSnippet);
            expect(reconstructedNode.createdAt.getTime()).toBe(node.createdAt.getTime());
            expect(reconstructedNode.parentId).toBe(node.parentId);
            expect(reconstructedNode.childIds).toEqual(node.childIds);
        });

        it('should validate reconstructed node from JSON', () => {
            const json = node.toJSON();
            
            expect(() => {
                Node.fromJSON(json);
            }).not.toThrow();
        });
    });

    describe('ID Generation', () => {
        it('should generate unique IDs', () => {
            const id1 = Node.generateId();
            const id2 = Node.generateId();
            
            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^node_[a-z0-9]+_[a-z0-9]+$/);
            expect(id2).toMatch(/^node_[a-z0-9]+_[a-z0-9]+$/);
        });

        it('should generate valid ID format', () => {
            const id = Node.generateId();
            
            expect(() => {
                new Node(id, validNodeData.name, validNodeData.filePath, validNodeData.lineNumber);
            }).not.toThrow();
        });
    });
});