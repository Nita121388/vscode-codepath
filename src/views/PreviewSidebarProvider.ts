import * as vscode from 'vscode';
import { WebviewManager } from '../managers/WebviewManager';

/**
 * 提供侧边栏 Webview 视图，将 WebviewManager 的渲染能力复用到 Activity Bar 视图中
 */
export class PreviewSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'codepath.previewView';

    constructor(private readonly webviewManager: WebviewManager) {}

    /**
     * 当视图第一次需要解析时，由 VS Code 调用
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.webviewManager.attachView(webviewView);
    }
}
