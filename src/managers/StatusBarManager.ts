import * as vscode from 'vscode';
import { IStatusBarManager, StatusBarInfo } from '../interfaces/IStatusBarManager';

type StatusMenuItem = vscode.QuickPickItem & { command: string };

/**
 * StatusBarManager 负责在 VS Code 状态栏展示 CodePath 的关键信息，
 * 并提供一组常用操作的快捷菜单（包括备份管理入口）。
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
                label: '🏗️ 创建 CodePath',
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
            // AI 功能入口保留占位，暂不开放
            // {
            //     label: '🤖 AI 生成 CodePath',
            //     description: '使用 AI 蓝图快速创建 CodePath',
            //     detail: 'Generate from AI blueprint',
            //     command: 'codepath.generateGraphFromBlueprint'
            // },
            {
                label: '🗑️ 删除 CodePath',
                description: '删除现有的 CodePath',
                detail: 'Delete CodePath',
                command: 'codepath.deleteGraph'
            },
            {
                label: '👁️ 刷新和预览',
                description: '刷新当前预览，需要时自动打开预览面板',
                detail: 'Refresh preview and reveal panel when hidden',
                command: 'codepath.refreshPreview'
            },
            // 备份相关快捷入口
            {
                label: '💾 快速备份当前文件/文件夹',
                description: '对当前活动文件或资源管理器选中的文件/文件夹做一次备份',
                detail: 'Quick backup for current file/folder',
                command: 'codepath.backupResource'
            },
            {
                label: '♻️ 从最新备份还原当前文件/文件夹',
                description: '使用该文件/文件夹的最新备份版本进行还原（还原前自动备份当前状态）',
                detail: 'Restore current file/folder from latest backup',
                command: 'codepath.restoreResourceFromLatestBackup'
            },
            {
                label: '🧹 备份管理：仅保留每个资源最新备份',
                description: '为每个文件/文件夹只保留一份最新备份，自动清理旧版本',
                detail: 'Keep only latest backup per resource',
                command: 'codepath.keepLatestBackups'
            },
            {
                label: '🗑️ 备份管理：清空所有备份',
                description: '删除 .codepath/file-backups 中的所有备份文件和索引（操作不可撤销）',
                detail: 'Clear all CodePath file backups',
                command: 'codepath.clearAllBackups'
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
            this.graphInfoItem.text = `🪧 ${currentGraph} (${nodeCount} nodes)`;
            this.graphInfoItem.tooltip = this.createMarkdownTooltip(
                `**当前 CodePath：** ${currentGraph}\n\n` +
                `**节点数：** ${nodeCount}\n\n` +
                `---\n\n` +
                `点击打开快捷菜单：\n` +
                `- 创建 / 切换 / 导入 / 导出 CodePath\n` +
                `- 删除 CodePath，刷新预览\n` +
                `- 💾 快速备份当前文件/文件夹\n` +
                `- ♻️ 从最新备份还原当前文件/文件夹\n` +
                `- 🧹 / 🗑️ 备份管理等操作`
            );
        } else {
            this.graphInfoItem.text = '🪧 未选择 CodePath';
            this.graphInfoItem.tooltip = this.createMarkdownTooltip(
                `**暂无活动的 CodePath**\n\n` +
                `点击打开快捷菜单：\n` +
                `- 创建 / 导入 / 切换 CodePath\n` +
                `- 也可以直接进行备份管理操作`
            );
        }
    }

    /**
     * 在测试环境下 VS Code 可能未暴露 MarkdownString，这里提供向后兼容实现
     */
    private createMarkdownTooltip(initial: string): vscode.MarkdownString {
        const MarkdownCtor = (vscode as any).MarkdownString;
        if (typeof MarkdownCtor === 'function') {
            return new MarkdownCtor(initial);
        }

        const fallback = {
            value: initial ?? '',
            appendText(text: string) {
                this.value += text;
                return this;
            },
            appendMarkdown(markdown: string) {
                this.value += markdown;
                return this;
            },
            appendCodeblock(code: string, language?: string) {
                this.value += `\`\`\`${language ?? ''}\n${code}\n\`\`\``;
                return this;
            }
        };

        return fallback as unknown as vscode.MarkdownString;
    }
}
