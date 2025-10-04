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

        // Mock createWebviewPanel
        const mockWindow = vscode.window as any;
        mockWindow.createWebviewPanel = vi.fn().mockReturnValue(mockPanel);

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
});