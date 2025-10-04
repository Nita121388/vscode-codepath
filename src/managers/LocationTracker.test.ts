import * as assert from 'assert';
import * as vscode from 'vscode';
import { LocationTracker } from './LocationTracker';
import { Node } from '../types';

suite('LocationTracker Test Suite', () => {
    let tracker: LocationTracker;

    setup(() => {
        tracker = new LocationTracker();
    });

    teardown(() => {
        tracker.dispose();
    });

    suite('generateCodeHash', () => {
        test('should generate consistent hash for same code', () => {
            const code = 'function test() { return 42; }';
            const hash1 = tracker.generateCodeHash(code);
            const hash2 = tracker.generateCodeHash(code);
            
            assert.strictEqual(hash1, hash2);
            assert.strictEqual(hash1.length, 16);
        });

        test('should generate different hashes for different code', () => {
            const code1 = 'function test() { return 42; }';
            const code2 = 'function test() { return 43; }';
            
            const hash1 = tracker.generateCodeHash(code1);
            const hash2 = tracker.generateCodeHash(code2);
            
            assert.notStrictEqual(hash1, hash2);
        });

        test('should normalize whitespace', () => {
            const code1 = '  function test() { return 42; }  ';
            const code2 = 'function test() { return 42; }';
            
            const hash1 = tracker.generateCodeHash(code1);
            const hash2 = tracker.generateCodeHash(code2);
            
            assert.strictEqual(hash1, hash2);
        });

        test('should handle empty code', () => {
            const hash = tracker.generateCodeHash('');
            assert.strictEqual(hash, '');
        });

        test('should handle whitespace-only code', () => {
            const hash = tracker.generateCodeHash('   \n  \t  ');
            assert.strictEqual(hash, '');
        });
    });

    suite('validateLocation', () => {
        test('should return failed for non-existent file', async () => {
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
            
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.confidence, 'failed');
            assert.strictEqual(result.reason, 'File not found');
        });

        test('should return failed for line number exceeding file length', async () => {
            // Create a temporary test file
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(result.isValid, false);
                assert.strictEqual(result.confidence, 'failed');
                assert.ok(result.reason?.includes('exceeds file length'));
            } finally {
                // Clean up
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        test('should return exact match for valid location with matching code', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(result.isValid, true);
                assert.strictEqual(result.confidence, 'exact');
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        test('should suggest nearby location when code moved', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(result.isValid, false);
                assert.ok(result.suggestedLocation);
                assert.strictEqual(result.suggestedLocation?.lineNumber, 4); // Actual location
                assert.ok(['high', 'medium'].includes(result.confidence));
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });
    });

    suite('navigateToNode', () => {
        test('should navigate successfully to exact location', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.confidence, 'exact');
                assert.ok(result.actualLocation);
                assert.strictEqual(result.actualLocation?.lineNumber, 2);
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        test('should navigate to suggested location when code moved', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(result.success, true);
                assert.ok(['high', 'medium'].includes(result.confidence));
                assert.ok(result.actualLocation);
                assert.strictEqual(result.actualLocation?.lineNumber, 4);
                assert.ok(result.message);
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });

        test('should fail navigation for non-existent file', async () => {
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
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.confidence, 'failed');
            assert.ok(result.message);
        });
    });

    suite('updateNodeLocation', () => {
        test('should update node location with new code snippet', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                assert.fail('No workspace folder available');
                return;
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
                
                assert.strictEqual(updatedNode.filePath, testFileUri.fsPath);
                assert.strictEqual(updatedNode.lineNumber, 2);
                assert.strictEqual(updatedNode.codeSnippet, 'return 42;');
            } finally {
                await vscode.workspace.fs.delete(testFileUri);
            }
        });
    });
});
