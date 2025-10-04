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
        showOpenDialog: vi.fn()
    },
    workspace: {
        openTextDocument: vi.fn(),
        fs: {
            writeFile: vi.fn(),
            readFile: vi.fn()
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
            switchNodeWorkflow: vi.fn(),
            switchGraphWorkflow: vi.fn(),
            showPreview: vi.fn(),
            updatePreview: vi.fn(),
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

            expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(12);
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createChildNode', expect.any(Function));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('codepath.createParentNode', expect.any(Function));
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
        it('should call updatePreview and show success message', async () => {
            commandManager.registerCommands(mockContext);

            const refreshHandler = (vscode.commands.registerCommand as Mock).mock.calls
                .find(call => call[0] === 'codepath.refreshPreview')?.[1];

            await refreshHandler();

            expect(mockIntegrationManager.updatePreview).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Preview refreshed');
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

    describe('dispose', () => {
        it('should dispose all registered commands', () => {
            const mockDisposable = { dispose: vi.fn() };
            (vscode.commands.registerCommand as Mock).mockReturnValue(mockDisposable);

            commandManager.registerCommands(mockContext);
            commandManager.dispose();

            expect(mockDisposable.dispose).toHaveBeenCalledTimes(12);
        });
    });
});