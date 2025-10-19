import * as vscode from 'vscode';
import { IStatusBarManager, StatusBarInfo } from '../interfaces/IStatusBarManager';

type StatusMenuItem = vscode.QuickPickItem & { command: string };

/**
 * StatusBarManager 负责在 VS Code 状态栏展示 CodePath 的关键信息，并提供快捷菜单入口
 */
export class StatusBarManager implements IStatusBarManager {
    private graphInfoItem: vscode.StatusBarItem;
    private statusInfo: StatusBarInfo;
    private menuCommand: vscode.Disposable | null = null;
    private readonly menuItems: StatusMenuItem[];

    constructor() {
        this.graphInfoItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        this.statusInfo = {
            currentGraph: null,
            currentNode: null,
            nodeCount: 0,
            previewStatus: 'ready'
        };

        this.menuItems = [
            {
                label: '🆕 创建 CodePath',
                description: '创建一个新的 CodePath',
                detail: 'Create New CodePath',
                command: 'codepath.createGraph'
            },
            {
                label: '🔁 切换 CodePath',
                description: '在不同 CodePath 之间快速切换',
                detail: 'Switch CodePath',
                command: 'codepath.switchGraph'
            },
            {
                label: '📤 导出 CodePath',
                description: '导出当前 CodePath 为 Markdown 文件',
                detail: 'Export Current CodePath',
                command: 'codepath.exportGraph'
            },
            {
                label: '📥 导入 CodePath',
                description: '从 Markdown 文件导入 CodePath',
                detail: 'Import CodePath',
                command: 'codepath.importGraph'
            },
            {
                label: '🗑️ 删除 CodePath',
                description: '删除现有的 CodePath',
                detail: 'Delete CodePath',
                command: 'codepath.deleteGraph'
            },
            {
                label: '👁️ 刷新和预览',
                description: '刷新当前预览，必要时自动打开预览面板',
                detail: 'Refresh preview and reveal panel when hidden',
                command: 'codepath.refreshPreview'
            }
        ];

        this.setupClickHandlers();
        this.registerMenuCommand();
        this.updateDisplay();
    }

    public updateGraphInfo(graphName: string | null, nodeCount: number): void {
        this.statusInfo.currentGraph = graphName;
        this.statusInfo.nodeCount = nodeCount;
        this.updateDisplay();
    }

    public updateCurrentNode(nodeName: string | null): void {
        this.statusInfo.currentNode = nodeName;
        this.updateDisplay();
    }

    public updatePreviewStatus(status: 'updating' | 'ready' | 'error'): void {
        this.statusInfo.previewStatus = status;
        this.updateDisplay();
    }

    public show(): void {
        this.graphInfoItem.show();
    }

    public hide(): void {
        this.graphInfoItem.hide();
    }

    public dispose(): void {
        this.graphInfoItem.dispose();
        if (this.menuCommand) {
            this.menuCommand.dispose();
            this.menuCommand = null;
        }
    }

    private setupClickHandlers(): void {
        this.graphInfoItem.command = 'codepath.showStatusBarMenu';
    }

    private registerMenuCommand(): void {
        this.menuCommand = vscode.commands.registerCommand(
            'codepath.showStatusBarMenu',
            this.showQuickMenu.bind(this)
        );
    }

    private async showQuickMenu(): Promise<void> {
        const selected = await vscode.window.showQuickPick(this.menuItems, {
            placeHolder: 'CodePath 快捷操作',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const item = selected as StatusMenuItem;
            await vscode.commands.executeCommand(item.command);
        }
    }

    private updateDisplay(): void {
        this.updateGraphInfoDisplay();
    }

    private updateGraphInfoDisplay(): void {
        const { currentGraph, nodeCount } = this.statusInfo;

        if (currentGraph) {
            this.graphInfoItem.text = `🧭 ${currentGraph} (${nodeCount} nodes)`;
            this.graphInfoItem.tooltip = new vscode.MarkdownString(
                `**当前 CodePath：** ${currentGraph}\n\n` +
                `**节点数：** ${nodeCount}\n\n` +
                `---\n\n` +
                `点击打开快捷菜单：\n` +
                `- 创建 / 切换 CodePath\n` +
                `- 导出 / 导入\n` +
                `- 删除 CodePath\n` +
                `- 刷新预览等更多操作`
            );
        } else {
            this.graphInfoItem.text = '🧭 未选择 CodePath';
            this.graphInfoItem.tooltip = new vscode.MarkdownString(
                `**暂无活动的 CodePath**\n\n` +
                `点击打开快捷菜单：\n` +
                `- 创建 CodePath\n` +
                `- 导入 CodePath\n` +
                `- 切换 CodePath`
            );
        }
    }
}
