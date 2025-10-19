import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { CommandManager } from './CommandManager';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { IntegrationManager } from './IntegrationManager';
import { Graph } from '../models/Graph';
import { Node } from '../models/Node';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        activeTextEditor: null,
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showQuickPick: vi.fn(),
        showTextDocument: vi.fn(),
        showInputBox: vi.fn(),
        showSaveDialog: vi.fn(),
        showOpenDialog: vi.fn(),
        createOutputChannel: vi.fn().mockReturnValue({
            appendLine: vi.fn(),
            dispose: vi.fn()
        })
    },
    workspace: {
        openTextDocument: vi.fn(),
        fs: {
            writeFile: vi.fn(),
            readFile: vi.fn(),
            stat: vi.fn()
        }
    },
    commands: {
        registerCommand: vi.fn(),
        executeCommand: vi.fn()
    },
    Position: vi.fn(),
    Selection: vi.fn(),
    Range: vi.fn(),
    Uri: {
        file: vi.fn()
    },
    FileType: {
        File: 1,
        Directory: 2
    }
}));

describe('CommandManager', () => {
    let commandManager: CommandManager;
    let mockGraphManager: GraphManager;
    let mockNodeManager: NodeManager;
    let mockIntegrationManager: IntegrationManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock managers
        mockGraphManager = {
            getCurrentGraph: vi.fn(),
            createGraph: vi.fn(),
            listGraphs: vi.fn(),
            loadGraph: vi.fn(),
            exportGraph: vi.fn(),
            importGraph: vi.fn(),
            deleteGraph: vi.fn()
        } as any;

        mockNodeManager = {
            getCurrentNode: vi.fn().mockReturnValue(null), // Default to no current node
            setCurrentNode: vi.fn(),
            createNode: vi.fn(),
            createChildNode: vi.fn(),
            createParentNode: vi.fn()
        } as any;

        mockIntegrationManager = {
            createNodeWorkflow: vi.fn(),
            createChildNodeWorkflow: vi.fn(),
            createParentNodeWorkflow: vi.fn(),
            createBroNodeWorkflow: vi.fn(),
            switchNodeWorkflow: vi.fn(),
            switchGraphWorkflow: vi.fn(),
            showPreview: vi.fn(),
            updatePreview: vi.fn(),
            refreshPreviewAndReveal: vi.fn(),
            togglePreviewFormat: vi.fn(),
            getState: vi.fn().mockReturnValue({
                hasGraph: true,
                hasCurrentNode: true,
                nodeCount: 1,
                previewFormat: 'text',
                isPreviewUpdating: false
            })
        } as any;

        // Create mock context
        mockContext = {
            subscriptions: []
        } as any;

        commandManager = new CommandManager(mockGraphManager, mockNodeManager, mockIntegrationManager);
    });

    describe('registerCommands', () => {
        it('should register all commands', () => {
            commandManager.registerCommands(mockContext);

            expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(20);
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createChildNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createParentNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createBroNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.switchCurrentNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.openPanel', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.refreshPreview', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createGraph', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.switchGraph', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.exportGraph', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.importGraph', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.deleteGraph', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.togglePreviewFormat', expect.any(Function));
        });

        it('should update context state', () => {
            commandManager.registerCommands(mockContext);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'codepath.hasCurrentNode', false);
        });
    });

    describe('handleCreateNode', () => {
        it('should show error when no active editor', async () => {
            (vscode.window.activeTextEditor as any) = null;
            commandManager.registerCommands(mockContext);

            // Get the registered command handler
            const createNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createNode')?.[1];

            await createNodeHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active editor found');
        });

        it('should show error when no text selected', async () => {
            const mockEditor = {
                selection: { isEmpty: true },
                document: { uri: { fsPath: '/test/file.ts' } }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;
            commandManager.registerCommands(mockContext);

            const createNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createNode')?.[1];

            await createNodeHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Please select code text first');
        });

        it('should create node successfully with selected text', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 10 }
                },
                document: { 
                    uri: { fsPath: '/test/file.ts' },
                    getText: vi.fn().mockReturnValue('  selected code  ')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            const mockGraph = new Graph('test-graph', 'Test Graph');
            const mockNode = new Node('node-1', 'test-node', '/test/file.ts', 11, 'selected code');
            
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);
            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            commandManager.registerCommands(mockContext);

            const createNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createNode')?.[1];

            await createNodeHandler();

            expect(mockNodeManager.createNode).toHaveBeenCalledWith(
                'selected code',
                '/test/file.ts',
                11,
                '  selected code  '
            );
            expect(mockNodeManager.setCurrentNode).toHaveBeenCalledWith(mockNode.id);
            expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Created node: test-node');
        });

        it('should create new graph if none exists', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 5 }
                },
                document: { 
                    uri: { fsPath: '/test/file.ts' },
                    getText: vi.fn().mockReturnValue('test code')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            const mockGraph = new Graph('new-graph', 'New Graph');
            const mockNode = new Node('node-1', 'test-node', '/test/file.ts', 6, 'test code');
            
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);
            (mockGraphManager.createGraph as Mock).mockResolvedValue(mockGraph);
            (mockNodeManager.createNode as Mock).mockResolvedValue(mockNode);

            commandManager.registerCommands(mockContext);

            const createNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createNode')?.[1];

            await createNodeHandler();

            expect(mockGraphManager.createGraph).toHaveBeenCalled();
            expect(mockNodeManager.createNode).toHaveBeenCalled();
        });
    });

    describe('handleCreateChildNode', () => {
        it('should show error when no current node', async () => {
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);
            commandManager.registerCommands(mockContext);

            const createChildHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createChildNode')?.[1];

            await createChildHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No current node selected');
        });

        it('should create child node successfully', async () => {
            const mockCurrentNode = new Node('parent-id', 'parent-node', '/test/parent.ts', 5);
            const mockChildNode = new Node('child-id', 'child-node', '/test/child.ts', 10);
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 9 }
                },
                document: { 
                    uri: { fsPath: '/test/child.ts' },
                    getText: vi.fn().mockReturnValue('child code')
                }
            };

            (vscode.window.activeTextEditor as any) = mockEditor;
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);
            (mockNodeManager.createChildNode as Mock).mockResolvedValue(mockChildNode);

            commandManager.registerCommands(mockContext);

            const createChildHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createChildNode')?.[1];

            await createChildHandler();

            expect(mockNodeManager.createChildNode).toHaveBeenCalledWith(
                mockCurrentNode.id,
                'child code',
                '/test/child.ts',
                10,
                'child code'
            );
            expect(mockNodeManager.setCurrentNode).toHaveBeenCalledWith(mockChildNode.id);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Created child node: child-node');
        });
    });

    describe('handleCreateBroNode', () => {
        it('should show error when no active editor', async () => {
            (vscode.window.activeTextEditor as any) = null;
            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('未找到活动编辑器');
        });

        it('should show error when no text selected', async () => {
            const mockEditor = {
                selection: { isEmpty: true },
                document: { uri: { fsPath: '/test/file.ts' } }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;
            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('请先选择代码文本');
        });

        it('should call createBroNodeWorkflow with correct parameters', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 15 }
                },
                document: { 
                    uri: { fsPath: '/test/bro.ts' },
                    getText: vi.fn().mockReturnValue('  bro node code  ')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                '  bro node code  ',
                '/test/bro.ts',
                16
            );
        });

        it('should handle integration manager workflow correctly', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 20 }
                },
                document: { 
                    uri: { fsPath: '/test/sibling.ts' },
                    getText: vi.fn().mockReturnValue('sibling code')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            // Mock successful workflow
            (mockIntegrationManager.createBroNodeWorkflow as Mock).mockResolvedValue(undefined);

            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                'sibling code',
                '/test/sibling.ts',
                21
            );
        });

        it('should handle errors from integration manager gracefully', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 10 }
                },
                document: { 
                    uri: { fsPath: '/test/error.ts' },
                    getText: vi.fn().mockReturnValue('error code')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            // Mock error from integration manager
            const testError = new Error('Integration manager error');
            (mockIntegrationManager.createBroNodeWorkflow as Mock).mockRejectedValue(testError);

            // Spy on console.error
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                'error code',
                '/test/error.ts',
                11
            );
            expect(consoleSpy).toHaveBeenCalledWith('Create bro node command failed:', testError);

            consoleSpy.mockRestore();
        });

        it('should extract correct line number from editor selection', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 0 } // VS Code uses 0-based line numbers
                },
                document: { 
                    uri: { fsPath: '/test/line.ts' },
                    getText: vi.fn().mockReturnValue('first line')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            // Should convert 0-based to 1-based line number
            expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                'first line',
                '/test/line.ts',
                1
            );
        });

        it('should handle whitespace in selected text correctly', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 5 }
                },
                document: { 
                    uri: { fsPath: '/test/whitespace.ts' },
                    getText: vi.fn().mockReturnValue('   \n  code with whitespace  \n   ')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            commandManager.registerCommands(mockContext);

            const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createBroNode')?.[1];

            await createBroNodeHandler();

            // Should pass the text as-is to integration manager (trimming is handled there)
            expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                '   \n  code with whitespace  \n   ',
                '/test/whitespace.ts',
                6
            );
        });

        it('should handle different file paths correctly', async () => {
            const testCases = [
                '/absolute/path/file.ts',
                'relative/path/file.js',
                'C:\\Windows\\path\\file.py',
                '/home/user/project/src/component.tsx'
            ];

            for (const filePath of testCases) {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 1 }
                    },
                    document: { 
                        uri: { fsPath: filePath },
                        getText: vi.fn().mockReturnValue('test code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                commandManager.registerCommands(mockContext);

                const createBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.createBroNode')?.[1];

                await createBroNodeHandler();

                expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                    'test code',
                    filePath,
                    2
                );

                // Reset mocks for next iteration
                vi.clearAllMocks();
                mockIntegrationManager.createBroNodeWorkflow = vi.fn();
            }
        });
    });

    describe('handleSwitchCurrentNode', () => {
        it('should show message when no nodes available', async () => {
            const mockGraph = new Graph('empty-graph', 'Empty Graph');
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);

            commandManager.registerCommands(mockContext);

            const switchNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.switchCurrentNode')?.[1];

            await switchNodeHandler();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No nodes available to switch to');
        });

        it('should show quick pick with available nodes', async () => {
            const mockGraph = new Graph('test-graph', 'Test Graph');
            const node1 = new Node('node1-id', 'node1', '/test/file1.ts', 5, 'code snippet 1');
            const node2 = new Node('node2-id', 'node2', '/test/file2.ts', 10, 'code snippet 2');
            
            mockGraph.addNode(node1);
            mockGraph.addNode(node2);

            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);
            (vscode.window.showQuickPick as Mock).mockResolvedValue({
                label: 'node1',
                description: '/test/file1.ts:5'
            });

            commandManager.registerCommands(mockContext);

            const switchNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.switchCurrentNode')?.[1];

            await switchNodeHandler();

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'node1',
                        description: '/test/file1.ts:5',
                        detail: 'code snippet 1'
                    }),
                    expect.objectContaining({
                        label: 'node2',
                        description: '/test/file2.ts:10',
                        detail: 'code snippet 2'
                    })
                ]),
                expect.objectContaining({
                    placeHolder: 'Select a node to switch to'
                })
            );
        });
    });

    describe('handleOpenPanel', () => {
        it('should call showPreview on preview manager', async () => {
            commandManager.registerCommands(mockContext);

            const openPanelHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.openPanel')?.[1];

            await openPanelHandler();

            expect(mockIntegrationManager.showPreview).toHaveBeenCalled();
        });
    });

    describe('handleRefreshPreview', () => {
        it('should refresh preview and ensure panel visibility', async () => {
            commandManager.registerCommands(mockContext);

            const refreshHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.refreshPreview')?.[1];

            await refreshHandler();

            expect(mockIntegrationManager.refreshPreviewAndReveal).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('预览已刷新');
        });
    });

    describe('handleCreateGraph', () => {
        it('should create graph with provided name', async () => {
            const mockGraph = new Graph('new-graph', 'My New Graph');
            (vscode.window.showInputBox as Mock).mockResolvedValue('My New Graph');
            (mockGraphManager.createGraph as Mock).mockResolvedValue(mockGraph);

            commandManager.registerCommands(mockContext);

            const createGraphHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createGraph')?.[1];

            await createGraphHandler();

            expect(mockGraphManager.createGraph).toHaveBeenCalledWith('My New Graph');
            // Now uses switchGraphWorkflow to ensure all UI components are updated
            // switchGraphWorkflow will show its own "Switched to graph" message
            expect(mockIntegrationManager.switchGraphWorkflow).toHaveBeenCalledWith('new-graph');
        });

        it('should create graph with default name when empty input', async () => {
            const mockGraph = new Graph('new-graph', 'Graph 1');
            (vscode.window.showInputBox as Mock).mockResolvedValue('');
            (mockGraphManager.createGraph as Mock).mockResolvedValue(mockGraph);

            commandManager.registerCommands(mockContext);

            const createGraphHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createGraph')?.[1];

            await createGraphHandler();

            expect(mockGraphManager.createGraph).toHaveBeenCalledWith(undefined);
        });

        it('should not create graph when input is cancelled', async () => {
            (vscode.window.showInputBox as Mock).mockResolvedValue(undefined);

            commandManager.registerCommands(mockContext);

            const createGraphHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.createGraph')?.[1];

            await createGraphHandler();

            expect(mockGraphManager.createGraph).not.toHaveBeenCalled();
        });
    });

    describe('handleSwitchGraph', () => {
        it('should show message when no graphs available', async () => {
            (mockGraphManager.listGraphs as Mock).mockResolvedValue([]);

            commandManager.registerCommands(mockContext);

            const switchGraphHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.switchGraph')?.[1];

            await switchGraphHandler();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No graphs available. Create a new graph first.');
        });

        it('should switch to selected graph', async () => {
            const mockGraphs = [
                { id: 'graph1', name: 'Graph 1', nodeCount: 5, createdAt: new Date(), updatedAt: new Date() },
                { id: 'graph2', name: 'Graph 2', nodeCount: 3, createdAt: new Date(), updatedAt: new Date() }
            ];
            (mockGraphManager.listGraphs as Mock).mockResolvedValue(mockGraphs);
            (vscode.window.showQuickPick as Mock).mockResolvedValue({
                label: 'Graph 1',
                description: '5 nodes'
            });

            commandManager.registerCommands(mockContext);

            const switchGraphHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.switchGraph')?.[1];

            await switchGraphHandler();

            expect(mockGraphManager.loadGraph).toHaveBeenCalledWith('graph1');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Switched to graph: Graph 1');
        });
    });

    describe('handleExportGraph', () => {
        it('should show error when no active graph', async () => {
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(null);

            commandManager.registerCommands(mockContext);

            const exportHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.exportGraph')?.[1];

            await exportHandler();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No active graph to export');
        });

        it('should export graph to selected file', async () => {
            const mockGraph = new Graph('test-graph', 'Test Graph');
            const mockUri = { fsPath: '/path/to/export.md' };
            (mockGraphManager.getCurrentGraph as Mock).mockReturnValue(mockGraph);
            (vscode.window.showSaveDialog as Mock).mockResolvedValue(mockUri);
            (mockGraphManager.exportGraph as Mock).mockResolvedValue('# Exported Graph Content');

            commandManager.registerCommands(mockContext);

            const exportHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.exportGraph')?.[1];

            await exportHandler();

            expect(mockGraphManager.exportGraph).toHaveBeenCalledWith(mockGraph, 'md');
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(mockUri, expect.any(Buffer));
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Graph exported to: /path/to/export.md');
        });
    });

    describe('handleTogglePreviewFormat', () => {
        it('should toggle preview format', async () => {
            commandManager.registerCommands(mockContext);

            const toggleHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.togglePreviewFormat')?.[1];

            await toggleHandler();

            expect(mockIntegrationManager.togglePreviewFormat).toHaveBeenCalled();
        });
    });

    // New tests for updated menu functionality
    describe('New "Mark as" Commands', () => {
        describe('handleMarkAsNewNode', () => {
            it('should create node and show updated success message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 10 }
                    },
                    document: { 
                        uri: { fsPath: '/test/file.ts' },
                        getText: vi.fn().mockReturnValue('  selected code  ')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const mockNode = { id: 'node-1', name: 'selected code' };
                (mockIntegrationManager.createNodeWorkflow as Mock).mockResolvedValue(mockNode);

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    '  selected code  ',
                    '/test/file.ts',
                    11
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已标记为新节点: selected code');
            });

            it('should handle errors with updated error message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 5 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Creation failed');
                (mockIntegrationManager.createNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为新节点失败: Creation failed');
            });
        });

        describe('handleMarkAsChildNode', () => {
            it('should create child node and show updated success message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 15 }
                    },
                    document: { 
                        uri: { fsPath: '/test/child.ts' },
                        getText: vi.fn().mockReturnValue('child code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const mockNode = { id: 'child-1', name: 'child code' };
                (mockIntegrationManager.createChildNodeWorkflow as Mock).mockResolvedValue(mockNode);

                commandManager.registerCommands(mockContext);

                const markAsChildNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsChildNode')?.[1];

                await markAsChildNodeHandler();

                expect(mockIntegrationManager.createChildNodeWorkflow).toHaveBeenCalledWith(
                    'child code',
                    '/test/child.ts',
                    16
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已标记为子节点: child code');
            });

            it('should handle errors with updated error message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 8 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Child creation failed');
                (mockIntegrationManager.createChildNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsChildNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsChildNode')?.[1];

                await markAsChildNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为子节点失败: Child creation failed');
            });
        });

        describe('handleMarkAsParentNode', () => {
            it('should create parent node and show updated success message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 20 }
                    },
                    document: { 
                        uri: { fsPath: '/test/parent.ts' },
                        getText: vi.fn().mockReturnValue('parent code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const mockNode = { id: 'parent-1', name: 'parent code' };
                (mockIntegrationManager.createParentNodeWorkflow as Mock).mockResolvedValue(mockNode);

                commandManager.registerCommands(mockContext);

                const markAsParentNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsParentNode')?.[1];

                await markAsParentNodeHandler();

                expect(mockIntegrationManager.createParentNodeWorkflow).toHaveBeenCalledWith(
                    'parent code',
                    '/test/parent.ts',
                    21
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已标记为父节点: parent code');
            });

            it('should handle errors with updated error message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 12 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Parent creation failed');
                (mockIntegrationManager.createParentNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsParentNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsParentNode')?.[1];

                await markAsParentNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为父节点失败: Parent creation failed');
            });
        });

        describe('handleMarkAsBroNode', () => {
            it('should create bro node and show updated success message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 25 }
                    },
                    document: { 
                        uri: { fsPath: '/test/bro.ts' },
                        getText: vi.fn().mockReturnValue('bro code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const mockNode = { id: 'bro-1', name: 'bro code' };
                (mockIntegrationManager.createBroNodeWorkflow as Mock).mockResolvedValue(mockNode);

                commandManager.registerCommands(mockContext);

                const markAsBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsBroNode')?.[1];

                await markAsBroNodeHandler();

                expect(mockIntegrationManager.createBroNodeWorkflow).toHaveBeenCalledWith(
                    'bro code',
                    '/test/bro.ts',
                    26
                );
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已标记为兄弟节点: bro code');
            });

            it('should handle errors with updated error message', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 18 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Bro creation failed');
                (mockIntegrationManager.createBroNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsBroNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsBroNode')?.[1];

                await markAsBroNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为兄弟节点失败: Bro creation failed');
            });
        });
    });

    describe('Clipboard Operations', () => {
        beforeEach(() => {
            // Mock ClipboardManager methods directly on the commandManager instance
            // Since the manager is created in the constructor, we need to mock the behavior
            vi.spyOn(commandManager as any, 'clipboardManager', 'get').mockReturnValue({
                copyNode: vi.fn().mockResolvedValue(undefined),
                pasteNode: vi.fn().mockResolvedValue([{ id: 'pasted-1', name: 'pasted node' }]),
                cutNode: vi.fn().mockResolvedValue(undefined)
            });
        });

        describe('handleCopyNode', () => {
            it('should copy current node and show success message', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                commandManager.registerCommands(mockContext);

                const copyNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.copyNode')?.[1];

                await copyNodeHandler();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已复制该节点及其子节点');
            });

            it('should show error when no current node', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const copyNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.copyNode')?.[1];

                await copyNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('复制节点失败: 没有选择当前节点');
            });

            it('should handle clipboard manager errors', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock clipboard manager to throw error
                vi.spyOn(commandManager as any, 'clipboardManager', 'get').mockReturnValue({
                    copyNode: vi.fn().mockRejectedValue(new Error('Clipboard error'))
                });

                commandManager.registerCommands(mockContext);

                const copyNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.copyNode')?.[1];

                await copyNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('复制节点失败: Clipboard error');
            });
        });

        describe('handlePasteNode', () => {
            it('should paste nodes and show success message', async () => {
                const mockCurrentNode = { id: 'parent-1', name: 'parent node' };
                const mockPastedNodes = [
                    { id: 'pasted-1', name: 'pasted node 1' },
                    { id: 'pasted-2', name: 'pasted node 2' }
                ];

                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                commandManager.registerCommands(mockContext);

                const pasteNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.pasteNode')?.[1];

                await pasteNodeHandler();

                expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已粘贴 2 个节点及其子节点');
            });

            it('should paste to root when no current node', async () => {
                const mockPastedNodes = [{ id: 'pasted-1', name: 'pasted node' }];

                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const pasteNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.pasteNode')?.[1];

                await pasteNodeHandler();

                expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已粘贴 1 个节点及其子节点');
            });

            it('should handle clipboard manager errors', async () => {
                const mockCurrentNode = { id: 'parent-1', name: 'parent node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock clipboard manager to throw error
                vi.spyOn(commandManager as any, 'clipboardManager', 'get').mockReturnValue({
                    pasteNode: vi.fn().mockRejectedValue(new Error('No data in clipboard'))
                });

                commandManager.registerCommands(mockContext);

                const pasteNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.pasteNode')?.[1];

                await pasteNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('粘贴节点失败: No data in clipboard');
            });
        });

        describe('handleCutNode', () => {
            it('should cut current node and show success message', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                commandManager.registerCommands(mockContext);

                const cutNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.cutNode')?.[1];

                await cutNodeHandler();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已剪切该节点及其子节点');
            });

            it('should show error when no current node', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const cutNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.cutNode')?.[1];

                await cutNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('剪切节点失败: 没有选择当前节点');
            });

            it('should handle clipboard manager errors', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock clipboard manager to throw error
                vi.spyOn(commandManager as any, 'clipboardManager', 'get').mockReturnValue({
                    cutNode: vi.fn().mockRejectedValue(new Error('Cut operation failed'))
                });

                commandManager.registerCommands(mockContext);

                const cutNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.cutNode')?.[1];

                await cutNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('剪切节点失败: Cut operation failed');
            });
        });
    });

    describe('Node Order Operations', () => {
        beforeEach(() => {
            // Mock NodeOrderManager methods directly on the commandManager instance
            vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                moveNodeUp: vi.fn().mockResolvedValue(true),
                moveNodeDown: vi.fn().mockResolvedValue(true)
            });
        });

        describe('handleMoveNodeUp', () => {
            it('should move node up and show success message', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                commandManager.registerCommands(mockContext);

                const moveNodeUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeUp')?.[1];

                await moveNodeUpHandler();

                expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已上移');
            });

            it('should show boundary message when node cannot move up', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock node order manager to return false (cannot move)
                vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                    moveNodeUp: vi.fn().mockResolvedValue(false)
                });

                commandManager.registerCommands(mockContext);

                const moveNodeUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeUp')?.[1];

                await moveNodeUpHandler();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最上方');
            });

            it('should show error when no current node', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const moveNodeUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeUp')?.[1];

                await moveNodeUpHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('移动节点失败: 没有选择当前节点');
            });

            it('should handle node order manager errors', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock node order manager to throw error
                vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                    moveNodeUp: vi.fn().mockRejectedValue(new Error('Node not found'))
                });

                commandManager.registerCommands(mockContext);

                const moveNodeUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeUp')?.[1];

                await moveNodeUpHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('移动节点失败: Node not found');
            });
        });

        describe('handleMoveNodeDown', () => {
            it('should move node down and show success message', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                commandManager.registerCommands(mockContext);

                const moveNodeDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeDown')?.[1];

                await moveNodeDownHandler();

                expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已下移');
            });

            it('should show boundary message when node cannot move down', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock node order manager to return false (cannot move)
                vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                    moveNodeDown: vi.fn().mockResolvedValue(false)
                });

                commandManager.registerCommands(mockContext);

                const moveNodeDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeDown')?.[1];

                await moveNodeDownHandler();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最下方');
            });

            it('should show error when no current node', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const moveNodeDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeDown')?.[1];

                await moveNodeDownHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('移动节点失败: 没有选择当前节点');
            });

            it('should handle node order manager errors', async () => {
                const mockCurrentNode = { id: 'node-1', name: 'test node' };
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

                // Mock node order manager to throw error
                vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                    moveNodeDown: vi.fn().mockRejectedValue(new Error('Node not found'))
                });

                commandManager.registerCommands(mockContext);

                const moveNodeDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeDown')?.[1];

                await moveNodeDownHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('移动节点失败: Node not found');
            });
        });
    });

    describe('File/Folder Context Support', () => {
        describe('getCreationContext with URI', () => {
            it('should handle file context from explorer', async () => {
                const mockUri = {
                    fsPath: '/test/project/src/component.ts',
                    scheme: 'file',
                    toString: () => 'file:///test/project/src/component.ts'
                };

                // Mock file system stats
                (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                    type: vscode.FileType.File
                });

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    'component.ts',
                    '/test/project/src/component.ts',
                    1
                );
            });

            it('should prioritize editor selection when URI matches active document', async () => {
                const uriString = 'file:///test/project/src/component.ts';
                const mockUri = {
                    fsPath: '/test/project/src/component.ts',
                    scheme: 'file',
                    toString: () => uriString
                };

                const selectedLine = 19;
                const selectedText = '  const result = useDesignTokens();  ';

                const mockEditor = {
                    selection: {
                        isEmpty: false,
                        start: { line: selectedLine }
                    },
                    document: {
                        uri: {
                            fsPath: '/test/project/src/component.ts',
                            scheme: 'file',
                            toString: () => uriString
                        },
                        getText: vi.fn().mockReturnValue(selectedText)
                    }
                };

                (vscode.window.activeTextEditor as any) = mockEditor;

                (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                    type: vscode.FileType.File
                });

                mockIntegrationManager.createNodeWorkflow = vi.fn().mockResolvedValue({
                    id: 'node-1',
                    name: selectedText.trim(),
                    filePath: mockUri.fsPath,
                    lineNumber: selectedLine + 1
                });

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    'const result = useDesignTokens();',
                    '/test/project/src/component.ts',
                    selectedLine + 1
                );

                expect(mockEditor.document.getText).toHaveBeenCalled();
            });

            it('should handle folder context from explorer', async () => {
                const mockUri = {
                    fsPath: '/test/project/src/components',
                    scheme: 'file'
                };

                // Mock directory stats
                (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                    type: vscode.FileType.Directory
                });

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    'components',
                    '/test/project/src/components',
                    1
                );
            });

            it('should handle different file extensions correctly', async () => {
                const testCases = [
                    { path: '/test/file.js', expected: 'file.js' },
                    { path: '/test/file.ts', expected: 'file.ts' },
                    { path: '/test/file.py', expected: 'file.py' },
                    { path: '/test/README.md', expected: 'README.md' },
                    { path: '/test/package.json', expected: 'package.json' }
                ];

                for (const testCase of testCases) {
                    const mockUri = {
                        fsPath: testCase.path,
                        scheme: 'file'
                    };

                    (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                        type: vscode.FileType.File
                    });

                    commandManager.registerCommands(mockContext);

                    const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                        .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                    await markAsNewNodeHandler(mockUri);

                    expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                        testCase.expected,
                        testCase.path,
                        1
                    );

                    // Reset mocks for next iteration
                    vi.clearAllMocks();
                    mockIntegrationManager.createNodeWorkflow = vi.fn();
                }
            });

            it('should handle Windows file paths correctly', async () => {
                const mockUri = {
                    fsPath: 'C:\\Users\\test\\project\\src\\component.ts',
                    scheme: 'file'
                };

                (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                    type: vscode.FileType.File
                });

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    'component.ts',
                    'C:\\Users\\test\\project\\src\\component.ts',
                    1
                );
            });

            it('should handle file system errors gracefully', async () => {
                const mockUri = {
                    fsPath: '/test/nonexistent.ts',
                    scheme: 'file'
                };

                (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('File not found'));

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('标记为新节点失败')
                );
            });
        });

        describe('fallback to editor context', () => {
            it('should use editor context when no URI provided and no text selected', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: true,
                        start: { line: 5 }
                    },
                    document: { 
                        uri: { 
                            fsPath: '/test/current.ts',
                            scheme: 'file'
                        },
                        getText: vi.fn().mockReturnValue('')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                (vscode.workspace.fs.stat as Mock).mockResolvedValue({
                    type: vscode.FileType.File
                });

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(mockIntegrationManager.createNodeWorkflow).toHaveBeenCalledWith(
                    'current.ts',
                    '/test/current.ts',
                    6 // Current cursor line
                );
            });

            it('should show error when no context available', async () => {
                (vscode.window.activeTextEditor as any) = null;

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('未找到活动编辑器或选中的文件/文件夹')
                );
            });
        });
    });

    describe('Error Handling', () => {
        describe('handleError method', () => {
            it('should show error message with operation context', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 10 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Test error message');
                (mockIntegrationManager.createNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为新节点失败: Test error message');
            });

            it('should handle non-Error objects', async () => {
                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 10 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = 'String error';
                (mockIntegrationManager.createNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('标记为新节点失败: Unknown error');
            });

            it('should log errors to console', async () => {
                const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

                const mockEditor = {
                    selection: { 
                        isEmpty: false,
                        start: { line: 10 }
                    },
                    document: { 
                        uri: { fsPath: '/test/error.ts' },
                        getText: vi.fn().mockReturnValue('error code')
                    }
                };
                (vscode.window.activeTextEditor as any) = mockEditor;

                const testError = new Error('Test error');
                (mockIntegrationManager.createNodeWorkflow as Mock).mockRejectedValue(testError);

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler();

                expect(consoleSpy).toHaveBeenCalledWith('[CommandManager] 标记为新节点失败:', testError);

                consoleSpy.mockRestore();
            });
        });

        describe('specific error scenarios', () => {
            it('should handle clipboard operation errors', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const copyNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.copyNode')?.[1];

                await copyNodeHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('复制节点失败: 没有选择当前节点');
            });

            it('should handle node order operation errors', async () => {
                (mockNodeManager.getCurrentNode as Mock).mockReturnValue(null);

                commandManager.registerCommands(mockContext);

                const moveNodeUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.moveNodeUp')?.[1];

                await moveNodeUpHandler();

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('移动节点失败: 没有选择当前节点');
            });

            it('should handle file system access errors', async () => {
                const mockUri = {
                    fsPath: '/test/protected.ts',
                    scheme: 'file'
                };

                (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('Permission denied'));

                commandManager.registerCommands(mockContext);

                const markAsNewNodeHandler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === 'codepath.markAsNewNode')?.[1];

                await markAsNewNodeHandler(mockUri);

                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('标记为新节点失败')
                );
            });
        });
    });

    describe('User Feedback Messages', () => {
        it('should show correct success messages for all mark as commands', async () => {
            const mockEditor = {
                selection: { 
                    isEmpty: false,
                    start: { line: 10 }
                },
                document: { 
                    uri: { fsPath: '/test/file.ts' },
                    getText: vi.fn().mockReturnValue('test code')
                }
            };
            (vscode.window.activeTextEditor as any) = mockEditor;

            const testCases = [
                { 
                    command: 'codepath.markAsNewNode', 
                    workflow: 'createNodeWorkflow',
                    expectedMessage: '已标记为新节点: test code'
                },
                { 
                    command: 'codepath.markAsChildNode', 
                    workflow: 'createChildNodeWorkflow',
                    expectedMessage: '已标记为子节点: test code'
                },
                { 
                    command: 'codepath.markAsParentNode', 
                    workflow: 'createParentNodeWorkflow',
                    expectedMessage: '已标记为父节点: test code'
                },
                { 
                    command: 'codepath.markAsBroNode', 
                    workflow: 'createBroNodeWorkflow',
                    expectedMessage: '已标记为兄弟节点: test code'
                }
            ];

            for (const testCase of testCases) {
                const mockNode = { id: 'node-1', name: 'test code' };
                (mockIntegrationManager[testCase.workflow as keyof typeof mockIntegrationManager] as Mock)
                    .mockResolvedValue(mockNode);

                commandManager.registerCommands(mockContext);

                const handler = (vscode.commands.registerCommand as Mock).mock.calls
                    .find(call => call[0] === testCase.command)?.[1];

                await handler();

                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(testCase.expectedMessage);

                // Reset mocks for next iteration
                vi.clearAllMocks();
                mockIntegrationManager[testCase.workflow as keyof typeof mockIntegrationManager] = vi.fn();
            }
        });

        it('should show correct success messages for clipboard operations', async () => {
            const mockCurrentNode = { id: 'node-1', name: 'test node' };
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

            commandManager.registerCommands(mockContext);

            // Test copy
            const copyHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.copyNode')?.[1];
            await copyHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已复制该节点及其子节点');

            // Test cut
            const cutHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.cutNode')?.[1];
            await cutHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已剪切该节点及其子节点');

            // Test paste
            const pasteHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.pasteNode')?.[1];
            await pasteHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已粘贴 1 个节点及其子节点');
        });

        it('should show correct success messages for node order operations', async () => {
            const mockCurrentNode = { id: 'node-1', name: 'test node' };
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

            // Mock successful moves
            vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                moveNodeUp: vi.fn().mockResolvedValue(true),
                moveNodeDown: vi.fn().mockResolvedValue(true)
            });

            commandManager.registerCommands(mockContext);

            // Test move up success
            const moveUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.moveNodeUp')?.[1];
            await moveUpHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已上移');

            // Reset mocks
            vi.clearAllMocks();
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

            // Test move down success
            const moveDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.moveNodeDown')?.[1];
            await moveDownHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已下移');
        });

        it('should show correct boundary messages for node order operations', async () => {
            const mockCurrentNode = { id: 'node-1', name: 'test node' };
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

            // Mock boundary conditions (cannot move)
            vi.spyOn(commandManager as any, 'nodeOrderManager', 'get').mockReturnValue({
                moveNodeUp: vi.fn().mockResolvedValue(false),
                moveNodeDown: vi.fn().mockResolvedValue(false)
            });

            commandManager.registerCommands(mockContext);

            // Test move up boundary
            const moveUpHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.moveNodeUp')?.[1];
            await moveUpHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最上方');

            // Reset mocks
            vi.clearAllMocks();
            (mockNodeManager.getCurrentNode as Mock).mockReturnValue(mockCurrentNode);

            // Test move down boundary
            const moveDownHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.moveNodeDown')?.[1];
            await moveDownHandler();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('节点已在最下方');
        });
    });

    describe('Command Registration', () => {
        it('should register all new commands', () => {
            commandManager.registerCommands(mockContext);

            const expectedCommands = [
                'codepath.markAsNewNode',
                'codepath.markAsChildNode', 
                'codepath.markAsParentNode',
                'codepath.markAsBroNode',
                'codepath.copyNode',
                'codepath.pasteNode',
                'codepath.cutNode',
                'codepath.moveNodeUp',
                'codepath.moveNodeDown'
            ];

            expectedCommands.forEach(command => {
                expect(vscode.commands.registerCommand).toHaveBeenCalledWith(command, expect.any(Function));
            });
        });

        it('should maintain backward compatibility with old command IDs', () => {
            commandManager.registerCommands(mockContext);

            const backwardCompatibleCommands = [
                'codepath.createNode',
                'codepath.createChildNode',
                'codepath.createParentNode',
                'codepath.createBroNode'
            ];

            backwardCompatibleCommands.forEach(command => {
                expect(vscode.commands.registerCommand).toHaveBeenCalledWith(command, expect.any(Function));
            });
        });
    });

    describe('dispose', () => {
        it('should dispose all registered commands', () => {
            const mockDisposable = { dispose: vi.fn() };
            (vscode.commands.registerCommand as Mock).mockReturnValue(mockDisposable);

            commandManager.registerCommands(mockContext);
            commandManager.dispose();

            expect(mockDisposable.dispose).toHaveBeenCalled();
        });
    });
});
