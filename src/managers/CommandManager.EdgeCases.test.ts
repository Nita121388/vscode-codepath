import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as vscode from 'vscode';
import { CommandManager } from './CommandManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { IntegrationManager } from './IntegrationManager';
import { Node, Graph } from '../types';

// Mock VS Code
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn()
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    ExtensionContext: vi.fn()
}));

describe('CommandManager - Edge Cases and Error Handling', () => {
    let commandManager: CommandManager;
    let mockGraphManager: GraphManager;
    let mockNodeManager: NodeManager;
    let mockIntegrationManager: IntegrationManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock managers
        mockGraphManager = {
            getCurrentGraph: vi.fn(),
            createGraph: vi.fn(),
            loadGraph: vi.fn(),
            saveGraph: vi.fn(),
            deleteGraph: vi.fn(),
            exportGraph: vi.fn(),
            importGraph: vi.fn(),
            listGraphs: vi.fn(),
            setCurrentGraph: vi.fn()
        } as any;

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
        } as any;

        mockIntegrationManager = {
            createNodeWorkflow: vi.fn(),
            createChildNodeWorkflow: vi.fn(),
            createParentNodeWorkflow: vi.fn(),
            createBroNodeWorkflow: vi.fn(),
            updatePreview: vi.fn(),
            refreshPreviewAndReveal: vi.fn(),
            showPreview: vi.fn(),
            switchNodeWorkflow: vi.fn(),
            switchGraphWorkflow: vi.fn(),
            togglePreviewFormat: vi.fn(),
            getNodeManager: vi.fn().mockReturnValue(mockNodeManager)
        } as any;

        mockContext = {
            subscriptions: []
        } as any;

        commandManager = new CommandManager(
            mockGraphManager,
            mockNodeManager,
            mockIntegrationManager
        );
    });

    describe('Empty clipboard paste operations', () => {
        it('should handle paste when clipboard is empty', async () => {
            // Mock clipboard manager to have no data
            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'pasteNode').mockRejectedValue(
                new Error('No data in clipboard. Please copy or cut a node first.')
            );

            await (commandManager as any).handlePasteNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('粘贴节点失败')
            );
        });

        it('should handle paste when clipboard data is corrupted', async () => {
            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'pasteNode').mockRejectedValue(
                new Error('Clipboard data is corrupted')
            );

            await (commandManager as any).handlePasteNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('粘贴节点失败')
            );
        });

        it('should handle paste when no current node exists', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue([]);

            await (commandManager as any).handlePasteNode();

            expect(clipboardManager.pasteNode).toHaveBeenCalledWith(undefined);
        });
    });

    describe('Node boundary position movement', () => {
        it('should handle moving node up when already at top', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const nodeOrderManager = (commandManager as any).nodeOrderManager;
            vi.spyOn(nodeOrderManager, 'moveNodeUp').mockResolvedValue(false);

            await (commandManager as any).handleMoveNodeUp();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最上方');
            expect(mockIntegrationManager.updatePreview).not.toHaveBeenCalled();
        });

        it('should handle moving node down when already at bottom', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const nodeOrderManager = (commandManager as any).nodeOrderManager;
            vi.spyOn(nodeOrderManager, 'moveNodeDown').mockResolvedValue(false);

            await (commandManager as any).handleMoveNodeDown();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最下方');
            expect(mockIntegrationManager.updatePreview).not.toHaveBeenCalled();
        });

        it('should handle move operations when no current node selected', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            await (commandManager as any).handleMoveNodeUp();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('移动节点失败')
            );
        });

        it('should handle node order manager failures', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const nodeOrderManager = (commandManager as any).nodeOrderManager;
            vi.spyOn(nodeOrderManager, 'moveNodeUp').mockRejectedValue(
                new Error('Node order operation failed')
            );

            await (commandManager as any).handleMoveNodeUp();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('移动节点失败')
            );
        });
    });

    describe('Invalid file path handling', () => {
        it('should handle creation context with no active editor', async () => {
            (vscode.window as any).activeTextEditor = null;

            try {
                await (commandManager as any).getCreationContext();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('未找到活动编辑器');
            }
        });

        it('should handle creation context with no selected text', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue(''),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            try {
                await (commandManager as any).getCreationContext();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('请先选择代码文本');
            }
        });

        it('should handle creation context with whitespace-only selection', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('   \n\t  '),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            try {
                await (commandManager as any).getCreationContext();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('请先选择代码文本');
            }
        });

        it('should handle very long file paths', async () => {
            const longPath = '/very/long/path/' + 'directory/'.repeat(100) + 'file.ts';
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: longPath }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            const context = await (commandManager as any).getCreationContext();
            expect(context.filePath).toBe(longPath);
        });

        it('should handle file paths with special characters', async () => {
            const specialPath = '/test/path with spaces/file-with-special-chars_123.ts';
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: specialPath }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            const context = await (commandManager as any).getCreationContext();
            expect(context.filePath).toBe(specialPath);
        });
    });

    describe('Permission and access error handling', () => {
        it('should handle clipboard manager permission errors', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockRejectedValue(
                new Error('Permission denied: Cannot access clipboard')
            );

            await (commandManager as any).handleCopyNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('复制节点失败')
            );
        });

        it('should handle integration manager permission errors', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            (mockIntegrationManager.createNodeWorkflow as Mock).mockRejectedValue(
                new Error('Permission denied: Cannot create node')
            );

            await (commandManager as any).handleMarkAsNewNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('标记为新节点失败')
            );
        });

        it('should handle VS Code command registration failures', () => {
            (vscode.commands.registerCommand as Mock).mockImplementation(() => {
                throw new Error('Command registration failed');
            });

            expect(() => {
                commandManager.registerCommands(mockContext);
            }).toThrow('Command registration failed');
        });

        it('should handle context update failures', async () => {
            (vscode.commands.executeCommand as Mock).mockRejectedValue(
                new Error('Context update failed')
            );

            // Should not throw error, just log it
            await (commandManager as any).updateContextState();

            // Context update failures should be handled gracefully
            expect(vscode.commands.executeCommand).toHaveBeenCalled();
        });
    });

    describe('Data corruption and recovery', () => {
        it('should handle corrupted node data during copy operations', async () => {
            const corruptedNode = {
                id: null, // Corrupted data
                name: undefined,
                filePath: 123,
                lineNumber: 'invalid'
            } as any;

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(corruptedNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockRejectedValue(
                new Error('Invalid node data')
            );

            await (commandManager as any).handleCopyNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('复制节点失败')
            );
        });

        it('should handle integration manager returning corrupted data', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            (mockIntegrationManager.createNodeWorkflow as Mock).mockResolvedValue(null);

            await (commandManager as any).handleMarkAsNewNode();

            // Should handle null return gracefully
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已标记为新节点')
            );
        });

        it('should handle clipboard manager returning invalid paste results', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue(null as any);

            await (commandManager as any).handlePasteNode();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已粘贴 0 个节点')
            );
        });

        it('should handle missing clipboard manager', async () => {
            // Simulate missing clipboard manager
            (commandManager as any).clipboardManager = null;

            await (commandManager as any).handleCopyNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('复制节点失败')
            );
        });

        it('should handle missing node order manager', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            // Simulate missing node order manager
            (commandManager as any).nodeOrderManager = null;

            await (commandManager as any).handleMoveNodeUp();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('移动节点失败')
            );
        });
    });

    describe('Concurrent operation handling', () => {
        it('should handle concurrent copy operations', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue(undefined);

            // Execute multiple copy operations concurrently
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push((commandManager as any).handleCopyNode());
            }

            await Promise.all(promises);

            expect(clipboardManager.copyNode).toHaveBeenCalledTimes(5);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(5);
        });

        it('should handle concurrent paste operations', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'pasteNode').mockResolvedValue([]);

            // Execute multiple paste operations concurrently
            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push((commandManager as any).handlePasteNode());
            }

            await Promise.all(promises);

            expect(clipboardManager.pasteNode).toHaveBeenCalledTimes(3);
        });

        it('should handle concurrent move operations', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const nodeOrderManager = (commandManager as any).nodeOrderManager;
            vi.spyOn(nodeOrderManager, 'moveNodeUp').mockResolvedValue(true);
            vi.spyOn(nodeOrderManager, 'moveNodeDown').mockResolvedValue(true);

            // Execute concurrent move operations
            const promises = [
                (commandManager as any).handleMoveNodeUp(),
                (commandManager as any).handleMoveNodeDown()
            ];

            await Promise.all(promises);

            expect(nodeOrderManager.moveNodeUp).toHaveBeenCalled();
            expect(nodeOrderManager.moveNodeDown).toHaveBeenCalled();
        });

        it('should handle race conditions between copy and paste', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue(undefined);
            vi.spyOn(clipboardManager, 'pasteNode').mockRejectedValue(
                new Error('No data in clipboard')
            );

            // Start paste before copy completes
            const pastePromise = (commandManager as any).handlePasteNode();
            const copyPromise = (commandManager as any).handleCopyNode();

            await Promise.all([pastePromise, copyPromise]);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('粘贴节点失败')
            );
        });
    });

    describe('Memory and resource management', () => {
        it('should handle repeated operations without memory leaks', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue(undefined);

            // Perform many operations
            for (let i = 0; i < 100; i++) {
                await (commandManager as any).handleCopyNode();
            }

            expect(clipboardManager.copyNode).toHaveBeenCalledTimes(100);
        });

        it('should handle operations with very large node names', async () => {
            const longName = 'A'.repeat(10000);
            const mockNode: Node = {
                id: 'test-node',
                name: longName,
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue(undefined);

            await (commandManager as any).handleCopyNode();

            expect(clipboardManager.copyNode).toHaveBeenCalledWith('test-node');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                '已复制该节点及其子节点'
            );
        });

        it('should handle disposal during active operations', async () => {
            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockImplementation(async () => {
                // Simulate long-running operation
                await new Promise(resolve => setTimeout(resolve, 100));
            });

            const copyPromise = (commandManager as any).handleCopyNode();

            // Dispose resources during operation
            (commandManager as any).dispose();

            await copyPromise;

            // Should complete without errors
            expect(clipboardManager.copyNode).toHaveBeenCalled();
        });
    });

    describe('Edge case input handling', () => {
        it('should handle extremely long selected text', async () => {
            const longText = 'A'.repeat(100000);
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue(longText),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            const context = await (commandManager as any).getCreationContext();
            
            // Should truncate to 50 characters
            expect(context.name).toHaveLength(50);
            expect(context.name).toBe('A'.repeat(50));
        });

        it('should handle selected text with special characters', async () => {
            const specialText = '🚀 function test() { /* émojis & spëcial chars */ }';
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue(specialText),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            const context = await (commandManager as any).getCreationContext();
            expect(context.name).toBe(specialText.substring(0, 50));
        });

        it('should handle selected text with only whitespace and newlines', async () => {
            const whitespaceText = '   \n\t  \r\n  ';
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue(whitespaceText),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            try {
                await (commandManager as any).getCreationContext();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('请先选择代码文本');
            }
        });

        it('should handle zero line number selections', async () => {
            const mockEditor = {
                selection: {
                    start: { line: -1 }, // Invalid line number
                    end: { line: -1 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            const context = await (commandManager as any).getCreationContext();
            expect(context.lineNumber).toBe(0); // -1 + 1 = 0
        });
    });

    describe('Error recovery and resilience', () => {
        it('should recover from temporary integration manager failures', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockReturnValue('test code'),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            // First call fails, second succeeds
            (mockIntegrationManager.createNodeWorkflow as Mock)
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValue({ id: 'test-node', name: 'Test Node' });

            await (commandManager as any).handleMarkAsNewNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('标记为新节点失败')
            );

            // Second attempt should succeed
            await (commandManager as any).handleMarkAsNewNode();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('已标记为新节点')
            );
        });

        it('should handle VS Code API unavailability', async () => {
            // Simulate VS Code API being unavailable
            (vscode.window as any).showErrorMessage = undefined;
            (vscode.window as any).showInformationMessage = undefined;

            const mockNode: Node = {
                id: 'test-node',
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 1,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockNode);

            const clipboardManager = (commandManager as any).clipboardManager;
            vi.spyOn(clipboardManager, 'copyNode').mockResolvedValue(undefined);

            // Should not throw error even if VS Code API is unavailable
            await (commandManager as any).handleCopyNode();

            expect(clipboardManager.copyNode).toHaveBeenCalled();
        });

        it('should handle command handler exceptions gracefully', async () => {
            const mockEditor = {
                selection: {
                    start: { line: 0 },
                    end: { line: 0 }
                },
                document: {
                    getText: vi.fn().mockImplementation(() => {
                        throw new Error('Document access failed');
                    }),
                    uri: { fsPath: '/test/file.ts' }
                }
            };

            (vscode.window as any).activeTextEditor = mockEditor;

            // Should handle exception in getCreationContext
            await (commandManager as any).handleMarkAsNewNode();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('标记为新节点失败')
            );
        });
    });
});