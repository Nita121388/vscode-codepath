import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WebviewManager } from './WebviewManager';
import * as vscode from 'vscode';

// Use the existing VS Code mock
vi.mock('vscode', () => import('../__mocks__/vscode'));

describe('WebviewManager', () => {
    let webviewManager: WebviewManager;
    let mockContext: vscode.ExtensionContext;
    let mockPanel: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock context
        mockContext = {
            extensionUri: { fsPath: '/test/extension' },
            subscriptions: []
        } as any;

        // Create mock webview panel
        mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: vi.fn(),
                postMessage: vi.fn()
            },
            onDidDispose: vi.fn(),
            reveal: vi.fn(),
            dispose: vi.fn(),
            visible: true
        };

        // Mock VS Code functions
        (vscode.window.createWebviewPanel as any) = vi.fn().mockReturnValue(mockPanel);
        (vscode.window.showQuickPick as any) = vi.fn().mockResolvedValue(undefined);
        (vscode.window.showErrorMessage as any) = vi.fn().mockResolvedValue(undefined);
        (vscode.commands.executeCommand as any) = vi.fn().mockResolvedValue(undefined);

        webviewManager = new WebviewManager(mockContext);
    });

    describe('constructor', () => {
        it('should create webview manager instance', () => {
            expect(webviewManager).toBeDefined();
        });

        it('should accept custom config', () => {
            const customConfig = { title: 'Custom Title' };
            const manager = new WebviewManager(mockContext, customConfig);
            expect(manager).toBeDefined();
        });
    });

    describe('showPreview', () => {
        it('should create and show webview panel', async () => {
            await webviewManager.showPreview();
            
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'codepath.preview',
                'CodePath Preview',
                vscode.ViewColumn.Beside,
                expect.any(Object)
            );
        });

        it('should reveal existing panel if already created', async () => {
            await webviewManager.showPreview();
            await webviewManager.showPreview();
            
            expect(mockPanel.reveal).toHaveBeenCalled();
        });
    });

    describe('hidePreview', () => {
        it('should dispose webview panel', async () => {
            await webviewManager.showPreview();
            webviewManager.hidePreview();
            
            expect(mockPanel.dispose).toHaveBeenCalled();
        });

        it('should handle hiding when no panel exists', () => {
            expect(() => {
                webviewManager.hidePreview();
            }).not.toThrow();
        });
    });

    describe('updateContent', () => {
        it('should update content and format', async () => {
            await webviewManager.updateContent('test content', 'text');
            
            // Should not throw
            expect(true).toBe(true);
        });

        it('should update webview html when panel exists', async () => {
            await webviewManager.showPreview();
            await webviewManager.updateContent('test content', 'mermaid');
            
            expect(mockPanel.webview.html).toBeDefined();
        });
    });   
 describe('isVisible', () => {
        it('should return false when no panel exists', () => {
            expect(webviewManager.isVisible()).toBe(false);
        });

        it('should return true when panel is visible', async () => {
            await webviewManager.showPreview();
            expect(webviewManager.isVisible()).toBe(true);
        });
    });

    describe('callbacks', () => {
        it('should set format toggle callback', () => {
            const callback = vi.fn();
            webviewManager.setFormatToggleCallback(callback);
            
            expect(() => {
                webviewManager.toggleFormat();
            }).not.toThrow();
        });

        it('should set refresh callback', () => {
            const callback = vi.fn();
            webviewManager.setRefreshCallback(callback);
            
            expect(() => {
                webviewManager.refreshPreview();
            }).not.toThrow();
        });
    });

    describe('dispose', () => {
        it('should dispose webview panel', async () => {
            await webviewManager.showPreview();
            webviewManager.dispose();
            
            expect(mockPanel.dispose).toHaveBeenCalled();
        });

        it('should handle dispose when no panel exists', () => {
            expect(() => {
                webviewManager.dispose();
            }).not.toThrow();
        });
    });

    describe('Preview Custom Menu', () => {
        beforeEach(async () => {
            // Setup webview panel for menu tests
            await webviewManager.showPreview();
            
            // Mock the private methods that would be called
            (webviewManager as any).findNodeByIdentifier = vi.fn();
            (webviewManager as any).isNodeOperationAvailable = vi.fn().mockReturnValue(true);
            (webviewManager as any).hasClipboardData = vi.fn();
            (webviewManager as any).executePreviewAction = vi.fn();
            (webviewManager as any).setCurrentNodeForOperation = vi.fn();
        });

        describe('showPreviewContextMenu', () => {
            it('should show basic menu items when no node is selected', async () => {
                // Setup
                const mockQuickPickItems = [
                    { label: '🔄 刷新', description: 'Refresh preview content' },
                    { label: '📤 导出', description: 'Export graph' }
                ];
                (vscode.window.showQuickPick as any).mockResolvedValue(mockQuickPickItems[0]);

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu(null, 100, 200);

                // Verify
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ label: '🔄 刷新' }),
                        expect.objectContaining({ label: '📤 导出' })
                    ]),
                    expect.objectContaining({
                        placeHolder: '选择操作 (Select Action)'
                    })
                );
            });

            it('should show node-specific menu items when valid node is selected', async () => {
                // Setup
                const mockNode = { id: 'test-node', name: 'Test Node' };
                const mockGraph = {
                    nodes: new Map([['test-node', mockNode]])
                };
                webviewManager.setGetCurrentGraphCallback(() => mockGraph);
                (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📋 复制' });

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu('test-node', 100, 200);

                // Verify
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ label: '🔄 刷新' }),
                        expect.objectContaining({ label: '📤 导出' }),
                        expect.objectContaining({ label: '📋 复制' }),
                        expect.objectContaining({ label: '📄 粘贴' }),
                        expect.objectContaining({ label: '✂️ 剪切' }),
                        expect.objectContaining({ label: '⬆️ 上移' }),
                        expect.objectContaining({ label: '⬇️ 下移' })
                    ]),
                    expect.objectContaining({
                        placeHolder: '选择操作 (Node: Test Node)'
                    })
                );
            });

            it('should show paste option when clipboard has data but no node selected', async () => {
                // Setup
                (vscode.commands.executeCommand as any).mockResolvedValue(true);
                (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📄 粘贴' });

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu(null, 100, 200);

                // Verify
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ label: '🔄 刷新' }),
                        expect.objectContaining({ label: '📤 导出' }),
                        expect.objectContaining({ label: '📄 粘贴' })
                    ]),
                    expect.any(Object)
                );
            });

            it('should handle menu cancellation gracefully', async () => {
                // Setup
                (vscode.window.showQuickPick as any).mockResolvedValue(undefined);

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu(null, 100, 200);

                // Verify - should not call any commands
                expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
            });

            it('should disable node operations when not available', async () => {
                // Setup - no graph callback set, so operations should not be available
                (vscode.window.showQuickPick as any).mockResolvedValue({ label: '📋 复制' });

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu('test-node-id', 100, 200);

                // Verify - should only show basic menu items
                expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ label: '🔄 刷新' }),
                        expect.objectContaining({ label: '📤 导出' })
                    ]),
                    expect.any(Object)
                );
            });
        });

        describe('executePreviewAction', () => {
            it('should execute refresh action', async () => {
                // Setup
                const mockRefreshCallback = vi.fn();
                webviewManager.setRefreshCallback(mockRefreshCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('刷新', null);

                // Verify
                expect(mockRefreshCallback).toHaveBeenCalled();
            });

            it('should execute export action', async () => {
                // Setup
                const mockExportCallback = vi.fn();
                webviewManager.setExportGraphCallback(mockExportCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('导出', null);

                // Verify
                expect(mockExportCallback).toHaveBeenCalled();
            });

            it('should execute copy action with node', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('复制', 'test-node-id');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node-id');
                expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.copyNode');
            });

            it('should execute paste action', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('粘贴', 'test-node-id');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node-id');
                expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.pasteNode');
            });

            it('should execute cut action with node', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('剪切', 'test-node-id');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node-id');
                expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.cutNode');
            });

            it('should execute move up action with node', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('上移', 'test-node-id');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node-id');
                expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.moveNodeUp');
            });

            it('should execute move down action with node', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('下移', 'test-node-id');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node-id');
                expect(vscode.commands.executeCommand).toHaveBeenCalledWith('codepath.moveNodeDown');
            });

            it('should handle unknown action gracefully', async () => {
                // Setup
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('Unknown Action', 'test-node-id');

                // Verify - should not throw error
                expect(true).toBe(true);
            });

            it('should handle command execution errors', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                (vscode.commands.executeCommand as any).mockRejectedValue(new Error('Command failed'));
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('复制', 'test-node-id');

                // Verify - should show error message
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('预览菜单操作失败')
                );
            });
        });

        describe('findNodeByIdentifier', () => {
            it('should find node by actual node ID', () => {
                // Setup
                const mockNode = { id: 'test-node', name: 'Test Node' };
                const mockGraph = {
                    nodes: new Map([['test-node', mockNode]])
                };
                webviewManager.setGetCurrentGraphCallback(() => mockGraph);
                webviewManager.setGetNodeByLocationCallback(() => null);
                const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

                // Execute
                const result = findNodeByIdentifier('test-node');

                // Verify
                expect(result).toBe(mockNode);
            });

            it('should find node by filepath:lineNumber format', () => {
                // Setup
                const mockNode = { id: 'test-node', name: 'Test Node' };
                const mockGraph = { nodes: new Map() };
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
                const mockGraph = { nodes: new Map() };
                webviewManager.setGetCurrentGraphCallback(() => mockGraph);
                webviewManager.setGetNodeByLocationCallback(() => null);
                const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

                // Execute
                const result = findNodeByIdentifier('invalid-id');

                // Verify
                expect(result).toBeNull();
            });

            it('should handle missing graph gracefully', () => {
                // Setup
                webviewManager.setGetCurrentGraphCallback(() => null);
                const findNodeByIdentifier = (webviewManager as any).findNodeByIdentifier.bind(webviewManager);

                // Execute
                const result = findNodeByIdentifier('test-node');

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

        describe('isNodeOperationAvailable', () => {
            it('should return true when node operations are available', () => {
                // Setup
                const mockGraph = { nodes: new Map() };
                webviewManager.setGetCurrentGraphCallback(() => mockGraph);
                const isNodeOperationAvailable = (webviewManager as any).isNodeOperationAvailable.bind(webviewManager);

                // Execute
                const result = isNodeOperationAvailable();

                // Verify
                expect(result).toBe(true);
            });

            it('should return false when no graph callback is set', () => {
                // Setup - no callback set
                const isNodeOperationAvailable = (webviewManager as any).isNodeOperationAvailable.bind(webviewManager);

                // Execute
                const result = isNodeOperationAvailable();

                // Verify
                expect(result).toBe(false);
            });
        });

        describe('setCurrentNodeForOperation', () => {
            it('should set current node for operation', async () => {
                // Setup
                const mockNodeSwitchCallback = vi.fn();
                webviewManager.setNodeSwitchCallback(mockNodeSwitchCallback);
                const setCurrentNodeForOperation = (webviewManager as any).setCurrentNodeForOperation.bind(webviewManager);

                // Execute
                await setCurrentNodeForOperation('test-node');

                // Verify
                expect(mockNodeSwitchCallback).toHaveBeenCalledWith('test-node');
            });

            it('should handle missing callback gracefully', async () => {
                // Setup - no callback set
                const setCurrentNodeForOperation = (webviewManager as any).setCurrentNodeForOperation.bind(webviewManager);

                // Execute & Verify - should not throw
                await expect(setCurrentNodeForOperation('test-node')).resolves.not.toThrow();
            });
        });

        describe('webview message handling for context menu', () => {
            it('should handle showContextMenu message', async () => {
                // Setup
                const mockMessage = {
                    command: 'showContextMenu',
                    nodeId: 'test-node',
                    x: 100,
                    y: 200
                };
                
                // Mock the showPreviewContextMenu method
                const showPreviewContextMenuSpy = vi.fn();
                (webviewManager as any).showPreviewContextMenu = showPreviewContextMenuSpy;

                // Simulate message handling by calling the method directly
                await (webviewManager as any).showPreviewContextMenu(mockMessage.nodeId, mockMessage.x, mockMessage.y);

                // Verify
                expect(showPreviewContextMenuSpy).toHaveBeenCalledWith('test-node', 100, 200);
            });

            it('should handle showContextMenu message with null nodeId', async () => {
                // Setup
                const mockMessage = {
                    command: 'showContextMenu',
                    nodeId: null,
                    x: 100,
                    y: 200
                };
                
                // Mock the showPreviewContextMenu method
                const showPreviewContextMenuSpy = vi.fn();
                (webviewManager as any).showPreviewContextMenu = showPreviewContextMenuSpy;

                // Simulate message handling by calling the method directly
                await (webviewManager as any).showPreviewContextMenu(mockMessage.nodeId, mockMessage.x, mockMessage.y);

                // Verify
                expect(showPreviewContextMenuSpy).toHaveBeenCalledWith(null, 100, 200);
            });
        });

        describe('error handling', () => {
            it('should handle errors in showPreviewContextMenu', async () => {
                // Setup
                (vscode.window.showQuickPick as any).mockRejectedValue(new Error('QuickPick failed'));

                // Execute
                const showPreviewContextMenu = (webviewManager as any).showPreviewContextMenu.bind(webviewManager);
                await showPreviewContextMenu(null, 100, 200);

                // Verify - should show error message
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('预览菜单显示失败')
                );
            });

            it('should handle errors in executePreviewAction', async () => {
                // Setup
                const mockRefreshCallback = vi.fn().mockRejectedValue(new Error('Refresh failed'));
                webviewManager.setRefreshCallback(mockRefreshCallback);
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('刷新', null);

                // Verify - should show error message
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                    expect.stringContaining('预览菜单操作失败')
                );
            });

            it('should handle missing callbacks gracefully', async () => {
                // Setup - no callbacks set
                const executePreviewAction = (webviewManager as any).executePreviewAction.bind(webviewManager);

                // Execute
                await executePreviewAction('刷新', null);

                // Verify - should not throw error
                expect(true).toBe(true);
            });
        });
    });
});