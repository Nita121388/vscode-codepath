import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebviewManager } from '../managers/WebviewManager';
import { NodeManager } from '../managers/NodeManager';
import { GraphManager } from '../managers/GraphManager';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(),
        showQuickPick: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        visibleTextEditors: [],
    },
    commands: {
        executeCommand: vi.fn(),
    },
    ViewColumn: {
        Beside: 2,
        Two: 2,
    },
    Uri: {
        joinPath: vi.fn(),
    },
}));

describe('WebviewManager Custom Menu Integration', () => {
    let webviewManager: WebviewManager;
    let nodeManager: NodeManager;
    let graphManager: GraphManager;
    let mockContext: any;
    let mockPanel: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock context
        mockContext = {
            extensionUri: { fsPath: '/test/path' },
            subscriptions: [],
        };

        // Create mock webview panel
        mockPanel = {
            webview: {
                postMessage: vi.fn(),
                onDidReceiveMessage: vi.fn(),
            },
            onDidDispose: vi.fn(),
            reveal: vi.fn(),
            dispose: vi.fn(),
            visible: true,
        };

        // Mock createWebviewPanel to return our mock panel
        (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);

        // Create managers
        webviewManager = new WebviewManager(mockContext);
        
        // Mock the managers (in real integration, these would be actual instances)
        nodeManager = {} as NodeManager;
        graphManager = {} as GraphManager;
    });

    describe('Context Menu Integration', () => {
        it('should integrate with clipboard operations', async () => {
            // Setup
            const mockNode = { 
                id: 'test-node', 
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 42
            };
            const mockGraph = {
                nodes: new Map([['test-node', mockNode]]),
                currentNodeId: 'test-node'
            };

            // Setup callbacks
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            webviewManager.setGetNodeByLocationCallback(() => mockNode);
            webviewManager.setNodeSwitchCallback(vi.fn());

            // Mock showQuickPick to select copy action
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📋 复制' });
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute context menu
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu('test-node', 100, 200);

            // Verify
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.copyNode');
        });

        it('should allow opening settings from preview context menu', async () => {
            // Setup
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '⚙️ 打开设置' });
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute context menu without selecting a node
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu(null, 50, 80);

            // Verify settings command executed
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', 'codepath');
        });

        it('should integrate with node order operations', async () => {
            // Setup
            const mockNode = { 
                id: 'test-node', 
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 42
            };
            const mockGraph = {
                nodes: new Map([['test-node', mockNode]]),
                currentNodeId: 'test-node'
            };

            // Setup callbacks
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            webviewManager.setGetNodeByLocationCallback(() => mockNode);
            webviewManager.setNodeSwitchCallback(vi.fn());

            // Mock showQuickPick to select move up action
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '⬆️ 上移' });
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute context menu
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu('test-node', 100, 200);

            // Verify
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.moveNodeUp');
        });

        it('should handle refresh and export operations', async () => {
            // Setup
            const refreshCallback = vi.fn();
            const exportCallback = vi.fn();
            
            webviewManager.setRefreshCallback(refreshCallback);
            webviewManager.setExportGraphCallback(exportCallback);

            // Mock showQuickPick to select refresh action
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '🔄 刷新' });

            // Execute context menu
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu(null, 100, 200);

            // Verify refresh was called
            expect(refreshCallback).toHaveBeenCalled();

            // Test export
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📤 导出' });
            await showPreviewContextMenu(null, 100, 200);

            // Verify export was called
            expect(exportCallback).toHaveBeenCalled();
        });

        it('should handle node identification from filepath:lineNumber format', async () => {
            // Setup
            const mockNode = { 
                id: 'actual-node-id', 
                name: 'Test Node',
                filePath: '/test/file.ts',
                lineNumber: 42
            };
            const mockGraph = {
                nodes: new Map([['actual-node-id', mockNode]]),
                currentNodeId: 'actual-node-id'
            };

            // Setup callbacks
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            webviewManager.setGetNodeByLocationCallback((filePath: string, lineNumber: number) => {
                if (filePath === '/test/file.ts' && lineNumber === 42) {
                    return mockNode;
                }
                return null;
            });
            webviewManager.setNodeSwitchCallback(vi.fn());

            // Mock showQuickPick to select copy action
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📋 复制' });
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute context menu with filepath:lineNumber format
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu('/test/file.ts:42', 100, 200);

            // Verify the node was found and operation executed
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            const [items, options] = (vscode.window.showQuickPick as any).mock.calls[0];
            expect(items).toEqual(expect.arrayContaining([
                expect.objectContaining({ label: expect.stringContaining('复制') })
            ]));
            expect(options).toEqual(expect.objectContaining({
                placeHolder: '请选择操作 (Node: Test Node)'
            }));
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.copyNode');
        });

        it('should show paste option when clipboard has data but no node selected', async () => {
            // Setup
            webviewManager.setGetCurrentGraphCallback(() => ({ nodes: new Map() }));
            
            // Mock clipboard state
            (vscode.commands.executeCommand as any).mockImplementation((command: string, ...args: any[]) => {
                if (command === 'getContext' && args[0] === 'codepath.hasClipboardNode') {
                    return Promise.resolve(true);
                }
                return Promise.resolve(undefined);
            });

            // Mock showQuickPick to select paste action
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📄 粘贴' });

            // Execute context menu without node
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            await showPreviewContextMenu(null, 100, 200);

            // Verify paste option is available
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            const [items] = (vscode.window.showQuickPick as any).mock.calls[0];
            expect(items).toEqual(expect.arrayContaining([
                expect.objectContaining({ label: expect.stringContaining('粘贴') })
            ]));
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.pasteNode');
        });
    });

    describe('HTML Context Menu Integration', () => {
        it('should inject context menu script into webview HTML', async () => {
            // Setup webview
            await webviewManager.showPreview();

            // Verify that the webview was created
            expect(vscode.window.createWebviewPanel).toHaveBeenCalled();

            // The HTML content should contain context menu handling
            // This is tested indirectly through the message handling setup
            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
        });

        it('should handle webview messages for context menu', async () => {
            // Setup
            await webviewManager.showPreview();
            
            // Get the message handler
            const messageHandler = (mockPanel.webview.onDidReceiveMessage as any).mock.calls[0][0];
            
            // Mock the showPreviewContextMenu method
            const showPreviewContextMenuSpy = vi.spyOn(webviewManager as any, 'showPreviewContextMenu').mockResolvedValue(undefined);

            // Simulate context menu message from webview
            await messageHandler({
                command: 'showContextMenu',
                nodeId: 'test-node',
                x: 100,
                y: 200
            });

            // Verify the context menu was shown
            expect(showPreviewContextMenuSpy).toHaveBeenCalledWith('test-node', 100, 200);
        });
    });
});






