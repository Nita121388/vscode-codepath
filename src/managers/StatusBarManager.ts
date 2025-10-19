import * as vscode from 'vscode';
import { IStatusBarManager, StatusBarInfo } from '../interfaces/IStatusBarManager';

/**
 * StatusBarManager handles VS Code status bar integration for CodePath extension
 * Displays current graph name and node count with quick access menu
 */
export class StatusBarManager implements IStatusBarManager {
    private graphInfoItem: vscode.StatusBarItem;
    private statusInfo: StatusBarInfo;
    private menuCommand: vscode.Disposable | null = null;

    constructor() {
        // Create status bar item for graph info
        this.graphInfoItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        // Initialize status info
        this.statusInfo = {
            currentGraph: null,
            currentNode: null,
            nodeCount: 0,
            previewStatus: 'ready'
        };

        // Set up click handlers and menu
        this.setupClickHandlers();
        this.registerMenuCommand();

        // Initial update
        this.updateDisplay();
    }

    /**
     * Updates the status bar with current graph information
     */
    public updateGraphInfo(graphName: string | null, nodeCount: number): void {
        this.statusInfo.currentGraph = graphName;
        this.statusInfo.nodeCount = nodeCount;
        this.updateDisplay();
    }

    /**
     * Updates the status bar with current node information
     */
    public updateCurrentNode(nodeName: string | null): void {
        this.statusInfo.currentNode = nodeName;
        this.updateDisplay();
    }

    /**
     * Updates the preview status indicator
     */
    public updatePreviewStatus(status: 'updating' | 'ready' | 'error'): void {
        this.statusInfo.previewStatus = status;
        this.updateDisplay();
    }

    /**
     * Shows the status bar items
     */
    public show(): void {
        this.graphInfoItem.show();
    }

    /**
     * Hides the status bar items
     */
    public hide(): void {
        this.graphInfoItem.hide();
    }

    /**
     * Disposes of status bar resources
     */
    public dispose(): void {
        this.graphInfoItem.dispose();
        if (this.menuCommand) {
            this.menuCommand.dispose();
        }
    }

    /**
     * Sets up click handlers for status bar items
     */
    private setupClickHandlers(): void {
        // Graph info click handler - show quick menu
        this.graphInfoItem.command = 'codepath.showStatusBarMenu';
    }

    /**
     * Registers the status bar menu command
     */
    private registerMenuCommand(): void {
        this.menuCommand = vscode.commands.registerCommand(
            'codepath.showStatusBarMenu',
            this.showQuickMenu.bind(this)
        );
    }

    /**
     * Shows a quick pick menu with graph management options
     */
    private async showQuickMenu(): Promise<void> {
        const items: vscode.QuickPickItem[] = [
            {
                label: '➕ 新建 CodePath',
                description: '创建一个新的 CodePath',
                detail: 'Create New CodePath'
            },
            {
                label: '🔁 切换 CodePath',
                description: '在不同 CodePath 之间切换',
                detail: 'Switch CodePath'
            },
            {
                label: '📤 导出 CodePath',
                description: '将当前 CodePath 导出为 Markdown 文件',
                detail: 'Export Current CodePath'
            },
            {
                label: '📥 导入 CodePath',
                description: '从 Markdown 文件导入 CodePath',
                detail: 'Import CodePath'
            },
            {
                label: '🗑️ 删除 CodePath',
                description: '删除一个 CodePath',
                detail: 'Delete CodePath'
            },
            {
                label: '🔄 刷新预览',
                description: '刷新当前预览面板',
                detail: 'Refresh Preview'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'CodePath 管理',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            // Execute corresponding command based on selection
            if (selected.label.includes('新建')) {
                await vscode.commands.executeCommand('codepath.createGraph');
            } else if (selected.label.includes('切换')) {
                await vscode.commands.executeCommand('codepath.switchGraph');
            } else if (selected.label.includes('导出')) {
                await vscode.commands.executeCommand('codepath.exportGraph');
            } else if (selected.label.includes('导入')) {
                await vscode.commands.executeCommand('codepath.importGraph');
            } else if (selected.label.includes('删除')) {
                await vscode.commands.executeCommand('codepath.deleteGraph');
            } else if (selected.label.includes('刷新预览')) {
                await vscode.commands.executeCommand('codepath.refreshPreview');
            }
        }
    }

    /**
     * Updates the display of all status bar items
     */
    private updateDisplay(): void {
        this.updateGraphInfoDisplay();
    }

    /**
     * Updates the graph information display
     */
    private updateGraphInfoDisplay(): void {
        const { currentGraph, nodeCount } = this.statusInfo;

        if (currentGraph) {
            this.graphInfoItem.text = `📊 ${currentGraph} (${nodeCount} nodes)`;
            this.graphInfoItem.tooltip = new vscode.MarkdownString(
                `**当前 CodePath:** ${currentGraph}\n\n` +
                `**节点数:** ${nodeCount}\n\n` +
                `---\n\n` +
                `点击打开快捷菜单:\n` +
                `- 新建 CodePath\n` +
                `- 切换 CodePath\n` +
                `- 导出/导入\n` +
                `- 删除 CodePath\n` +
                `- 更多操作...`
            );
        } else {
            this.graphInfoItem.text = '📊 无 CodePath';
            this.graphInfoItem.tooltip = new vscode.MarkdownString(
                `**无活动 CodePath**\n\n` +
                `点击打开快捷菜单:\n` +
                `- 新建 CodePath\n` +
                `- 导入 CodePath\n` +
                `- 切换 CodePath`
            );
        }
    }
}
