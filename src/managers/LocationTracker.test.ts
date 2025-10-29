import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { LocationTracker } from './LocationTracker';
import { Node } from '../types';

// Mock VS Code API
vi.mock('vscode', async () => {
    const actual = await vi.importActual('../__mocks__/vscode');
    return actual;
});

describe('LocationTracker Test Suite', () => {
    let tracker: LocationTracker;

    beforeEach(() => {
        tracker = new LocationTracker();
    });

    afterEach(() => {
        tracker.dispose();
    });

    describe('generateCodeHash', () => {
        it('should generate consistent hash for same code', () => {
            const code = 'function test() { return 42; }';
            const hash1 = tracker.generateCodeHash(code);
            const hash2 = tracker.generateCodeHash(code);
            
            expect(hash1).toBe(hash2);
            expect(hash1.length).toBe(16);
        });

        it('should generate different hashes for different code', () => {
            const code1 = 'function test() { return 42; }';
            const code2 = 'function test() { return 43; }';
            
            const hash1 = tracker.generateCodeHash(code1);
            const hash2 = tracker.generateCodeHash(code2);
            
            expect(hash1).not.toBe(hash2);
        });

        it('should normalize whitespace', () => {
            const code1 = '  function test() { return 42; }  ';
            const code2 = 'function test() { return 42; }';
            
            const hash1 = tracker.generateCodeHash(code1);
            const hash2 = tracker.generateCodeHash(code2);
            
            expect(hash1).toBe(hash2);
        });

        it('should handle empty code', () => {
            const hash = tracker.generateCodeHash('');
            expect(hash).toBe('');
        });

        it('should handle whitespace-only code', () => {
            const hash = tracker.generateCodeHash('   \n  \t  ');
            expect(hash).toBe('');
        });
    });

    describe('validateLocation', () => {
        it('should return failed for non-existent file', async () => {
            const node: Node = {
                id: 'test-1',
                name: 'Test Node',
                filePath: '/non/existent/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const result = await tracker.validateLocation(node);
            
            expect(result.isValid).toBe(false);
            expect(result.confidence).toBe('failed');
            expect(result.reason).toBe('File not found');
        });

        it('should return failed for line number exceeding file length', async () => {
            // Create a temporary test file
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-location-tracker.ts');
            const testContent = 'line 1\nline 2\nline 3';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-2',
                    name: 'Test Node',
                    filePath: testFileUri.fsPath,
                    lineNumber: 100,
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const result = await tracker.validateLocation(node);
                
                expect(result.isValid).toBe(false);
                expect(result.confidence).toBe('failed');
                expect(result.reason).toContain('exceeds file length');
            } finally {
                // Clean up
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        it('should return exact match for valid location with matching code', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-location-exact.ts');
            const testContent = 'function test() {\n  return 42;\n}';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-3',
                    name: 'Test Node',
                    filePath: testFileUri.fsPath,
                    lineNumber: 2,
                    codeSnippet: '  return 42;',
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const result = await tracker.validateLocation(node);
                
                expect(result.isValid).toBe(true);
                expect(result.confidence).toBe('exact');
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        it('should suggest nearby location when code moved', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-location-moved.ts');
            const testContent = 'line 1\nline 2\nfunction test() {\n  return 42;\n}\nline 6';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-4',
                    name: 'Test Node',
                    filePath: testFileUri.fsPath,
                    lineNumber: 2, // Original location
                    codeSnippet: '  return 42;',
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const result = await tracker.validateLocation(node);
                
                expect(result.isValid).toBe(false);
                expect(result.suggestedLocation).toBeDefined();
                expect(result.suggestedLocation?.lineNumber).toBe(4); // Actual location
                expect(['high', 'medium']).toContain(result.confidence);
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });
    });

    describe('navigateToNode', () => {
        it('should navigate successfully to exact location', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-navigate.ts');
            const testContent = 'function test() {\n  return 42;\n}';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-5',
                    name: 'Test Node',
                    filePath: testFileUri.fsPath,
                    lineNumber: 2,
                    codeSnippet: '  return 42;',
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const result = await tracker.navigateToNode(node);
                
                expect(result.success).toBe(true);
                expect(result.confidence).toBe('exact');
                expect(result.actualLocation).toBeDefined();
                expect(result.actualLocation?.lineNumber).toBe(2);
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        it('should navigate to suggested location when code moved', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-navigate-moved.ts');
            const testContent = 'line 1\nline 2\nfunction test() {\n  return 42;\n}\nline 6';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-6',
                    name: 'Test Node',
                    filePath: testFileUri.fsPath,
                    lineNumber: 2,
                    codeSnippet: '  return 42;',
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const result = await tracker.navigateToNode(node);
                
                expect(result.success).toBe(true);
                expect(['high', 'medium']).toContain(result.confidence);
                expect(result.actualLocation).toBeDefined();
                expect(result.actualLocation?.lineNumber).toBe(4);
                expect(result.message).toBeDefined();
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        it('should fail navigation for non-existent file', async () => {
            const node: Node = {
                id: 'test-7',
                name: 'Test Node',
                filePath: '/non/existent/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            const result = await tracker.navigateToNode(node);
            
            expect(result.success).toBe(false);
            expect(result.confidence).toBe('failed');
            expect(result.message).toBeDefined();
        });
    });

    describe('updateNodeLocation', () => {
        it('should update node location with new code snippet', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            const testFileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'test-update-location.ts');
            const testContent = 'function test() {\n  return 42;\n}';
            
            await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

            try {
                const node: Node = {
                    id: 'test-8',
                    name: 'Test Node',
                    filePath: '/old/path.ts',
                    lineNumber: 1,
                    codeSnippet: 'old code',
                    createdAt: new Date(),
                    parentId: null,
                    childIds: []
                };

                const updatedNode = await tracker.updateNodeLocation(
                    node,
                    testFileUri.fsPath,
                    2
                );
                
                expect(updatedNode.filePath).toBe(testFileUri.fsPath);
                expect(updatedNode.lineNumber).toBe(2);
                expect(updatedNode.codeSnippet).toBe('return 42;');
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });
    });
});
