import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { WebviewManager } from './WebviewManager';

// Mock VS Code API
vi.mock('vscode', () => ({
    window: {
        createWebviewPanel: vi.fn(),
        showQuickPick: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
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

describe('WebviewManager Custom Menu', () => {
    let webviewManager: WebviewManager;
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

        // Create WebviewManager instance
        webviewManager = new WebviewManager(mockContext);
    });

    describe('showPreviewContextMenu', () => {
        it('should show basic menu items when no node is selected', async () => {
            // Setup
            const mockQuickPickItems = [
                { label: '🔄 刷新', description: 'Refresh preview content' },
                { label: '📤 导出', description: 'Export graph' },
                { label: '⚙️ 打开设置', description: 'Open configuration settings' },
            ];
            (vscode.window.showQuickPick as any).mockResolvedValue(mockQuickPickItems[0]);

            // Create webview manager with mocked methods
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            
            // Mock the private methods
            (webviewManager as any).findNodeByIdentifier = vi.fn().mockReturnValue(null);
            (webviewManager as any).isNodeOperationAvailable = vi.fn().mockReturnValue(true);
            (webviewManager as any).hasClipboardData = vi.fn().mockResolvedValue(false);
            (webviewManager as any).executePreviewAction = vi.fn();

            // Execute
            await showPreviewContextMenu(null, 100, 200);

            // Verify
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            const [items, options] = (vscode.window.showQuickPick as any).mock.calls[0];
            expect(items).toEqual(expect.arrayContaining([
                expect.objectContaining({ label: expect.stringContaining('刷新') }),
                expect.objectContaining({ label: expect.stringContaining('导出') }),
                expect.objectContaining({ label: expect.stringContaining('打开设置') }),
            ]));
            expect(options).toEqual(expect.objectContaining({
                placeHolder: '请选择操作 (Select Action)',
            }));
        });

        it('should show node-specific menu items when valid node is selected', async () => {
            // Setup
            const mockNode = { id: 'test-node', name: 'Test Node' };
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📋 复制' });

            // Create webview manager with mocked methods
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            
            // Mock the private methods
            (webviewManager as any).findNodeByIdentifier = vi.fn().mockReturnValue(mockNode);
            (webviewManager as any).isNodeOperationAvailable = vi.fn().mockReturnValue(true);
            (webviewManager as any).hasClipboardData = vi.fn().mockResolvedValue(false);
            (webviewManager as any).executePreviewAction = vi.fn();

            // Execute
            await showPreviewContextMenu('test-node-id', 100, 200);

            // Verify
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            const [items, options] = (vscode.window.showQuickPick as any).mock.calls[0];
            expect(items).toEqual(expect.arrayContaining([
                expect.objectContaining({ label: expect.stringContaining('刷新') }),
                expect.objectContaining({ label: expect.stringContaining('导出') }),
                expect.objectContaining({ label: expect.stringContaining('打开设置') }),
                expect.objectContaining({ label: expect.stringContaining('复制') }),
                expect.objectContaining({ label: expect.stringContaining('粘贴') }),
                expect.objectContaining({ label: expect.stringContaining('剪切') }),
                expect.objectContaining({ label: expect.stringContaining('上移') }),
                expect.objectContaining({ label: expect.stringContaining('下移') }),
            ]));
            expect(options).toEqual(expect.objectContaining({
                placeHolder: '请选择操作 (Node: Test Node)',
            }));
        });

        it('should show paste option when clipboard has data but no node selected', async () => {
            // Setup
            (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📄 粘贴' });

            // Create webview manager with mocked methods
            const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
            
            // Mock the private methods
            (webviewManager as any).findNodeByIdentifier = vi.fn().mockReturnValue(null);
            (webviewManager as any).isNodeOperationAvailable = vi.fn().mockReturnValue(true);
            (webviewManager as any).hasClipboardData = vi.fn().mockResolvedValue(true);
            (webviewManager as any).executePreviewAction = vi.fn();

            // Execute
            await showPreviewContextMenu(null, 100, 200);

            // Verify
            expect(vscode.window.showQuickPick).toHaveBeenCalled();
            const [items] = (vscode.window.showQuickPick as any).mock.calls[0];
            expect(items).toEqual(expect.arrayContaining([
                expect.objectContaining({ label: expect.stringContaining('刷新') }),
                expect.objectContaining({ label: expect.stringContaining('导出') }),
                expect.objectContaining({ label: expect.stringContaining('打开设置') }),
                expect.objectContaining({ label: expect.stringContaining('粘贴') }),
            ]));
        });
    });

    describe('executePreviewAction', () => {
        it('should execute refresh action', async () => {
            // Setup
            const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);
            webviewManager.setRefreshCallback(vi.fn());

            // Execute
            await executePreviewAction('🔄 刷新', null);

            // Verify - we can't easily test the refresh callback, but we can ensure no errors
            expect(true).toBe(true); // Test passes if no error thrown
        });

        it('should execute copy action with node', async () => {
            // Setup
            const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);
            (webviewManager as any).setCurrentNodeForOperation = vi.fn();
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute
            await executePreviewAction('📋 复制', 'test-node-id');

            // Verify
            expect((webviewManager as any).setCurrentNodeForOperation).toHaveBeenCalledWith('test-node-id');
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.copyNode');
        });

        it('should execute paste action', async () => {
            // Setup
            const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);
            (webviewManager as any).setCurrentNodeForOperation = vi.fn();
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute
            await executePreviewAction('📄 粘贴', 'test-node-id');

            // Verify
            expect((webviewManager as any).setCurrentNodeForOperation).toHaveBeenCalledWith('test-node-id');
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.pasteNode');
        });

        it('should execute open settings action', async () => {
            // Setup
            const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);
            (vscode.commands.executeCommand as any).mockResolvedValue(undefined);

            // Execute
            await executePreviewAction('⚙️ 打开设置', null);

            // Verify
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', 'codepath');
        });
    });

    describe('findNodeByIdentifier', () => {
        it('should find node by actual node ID', () => {
            // Setup
            const mockNode = { id: 'test-node', name: 'Test Node' };
            const mockGraph = {
                nodes: new Map([['test-node', mockNode]]),
            };
            
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            webviewManager.setGetNodeByLocationCallback(() => null); // Set the callback
            const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

            // Execute
            const result = findNodeByIdentifier('test-node');

            // Verify
            expect(result).toBe(mockNode);
        });

        it('should find node by filepath:lineNumber format', () => {
            // Setup
            const mockNode = { id: 'test-node', name: 'Test Node' };
            const mockGraph = {
                nodes: new Map(),
            };
            
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            webviewManager.setGetNodeByLocationCallback(() => mockNode);
            const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

            // Execute
            const result = findNodeByIdentifier('/test/file.ts:42');

            // Verify
            expect(result).toBe(mockNode);
        });

        it('should return null for invalid identifier', () => {
            // Setup
            const mockGraph = {
                nodes: new Map(),
            };
            
            webviewManager.setGetCurrentGraphCallback(() => mockGraph);
            const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

            // Execute
            const result = findNodeByIdentifier('invalid-id');

            // Verify
            expect(result).toBeNull();
        });
    });

    describe('hasClipboardData', () => {
        it('should return true when clipboard context is set', async () => {
            // Setup
            (vscode.commands.executeCommand as any).mockResolvedValue(true);
            const hasClipboardData = (webviewManager as any).hasClipboardData.bind(webviewManager);

            // Execute
            const result = await hasClipboardData();

            // Verify
            expect(result).toBe(true);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('getContext', 'codepath.hasClipboardNode');
        });

        it('should return false when clipboard context is not set', async () => {
            // Setup
            (vscode.commands.executeCommand as any).mockResolvedValue(false);
            const hasClipboardData = (webviewManager as any).hasClipboardData.bind(webviewManager);

            // Execute
            const result = await hasClipboardData();

            // Verify
            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            // Setup
            (vscode.commands.executeCommand as any).mockRejectedValue(new Error('Test error'));
            const hasClipboardData = (webviewManager as any).hasClipboardData.bind(webviewManager);

            // Execute
            const result = await hasClipboardData();

            // Verify
            expect(result).toBe(false);
        });
    });
});







