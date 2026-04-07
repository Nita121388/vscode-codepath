import * as vscode from 'vscode';
import * as path from 'path';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { IntegrationManager } from './IntegrationManager';
import { ClipboardManager } from './ClipboardManager';
import { NodeOrderManager } from './NodeOrderManager';
import { FeedbackManager } from './FeedbackManager';
import { FileBackupManager } from './FileBackupManager';
import { AIGraphBlueprint } from '../types';
import { BasketHistorySummary } from '../types/codeContext';
import { CodePathError } from '../types/errors';
import { executeCommandSafely } from '../utils/vscodeHelpers';
import { FileReferenceResolver, ParsedTextReference, ResolvedTextReference } from '../services/FileReferenceResolver';

/**
 * Context information for creating nodes
 */
interface CreationContext {
    name: string;
    filePath: string;
    lineNumber: number;
}

interface HistoryQuickPickItem extends vscode.QuickPickItem {
    entry: BasketHistorySummary;
}

interface TextReferenceQuickPickItem extends vscode.QuickPickItem {
    uri: vscode.Uri;
}

/**
 * Manages VS Code command integration and context menu functionality
 */
export class CommandManager {
    private graphManager: GraphManager;
    private nodeManager: NodeManager;
    private integrationManager: IntegrationManager;
    private clipboardManager: ClipboardManager;
    private nodeOrderManager: NodeOrderManager;
    private feedbackManager: FeedbackManager;
    private fileBackupManager: FileBackupManager;
    private readonly fileReferenceResolver: FileReferenceResolver;
    private disposables: vscode.Disposable[] = [];

    constructor(
        graphManager: GraphManager,
        nodeManager: NodeManager,
        integrationManager: IntegrationManager,
        fileBackupManager?: FileBackupManager
    ) {
        this.graphManager = graphManager;
        this.nodeManager = nodeManager;
        this.integrationManager = integrationManager;
        this.clipboardManager = new ClipboardManager(nodeManager, graphManager);
        this.nodeOrderManager = new NodeOrderManager(nodeManager, graphManager);
        this.feedbackManager = new FeedbackManager();
        this.fileBackupManager = fileBackupManager || new FileBackupManager();
        this.fileReferenceResolver = new FileReferenceResolver();
    }

    /**
     * Register all VS Code commands and context menu handlers
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Register existing command handlers (keeping old command IDs for compatibility)
        this.registerCommand(context, 'codepath.createNode', this.handleCreateNode.bind(this));
        this.registerCommand(context, 'codepath.createChildNode', this.handleCreateChildNode.bind(this));
        this.registerCommand(context, 'codepath.createParentNode', this.handleCreateParentNode.bind(this));
        this.registerCommand(context, 'codepath.createBroNode', this.handleCreateBroNode.bind(this));
        
        // Register new "Mark as" command handlers
        this.registerCommand(context, 'codepath.markAsNewNode', this.handleMarkAsNewNode.bind(this));
        this.registerCommand(context, 'codepath.markAsChildNode', this.handleMarkAsChildNode.bind(this));
        this.registerCommand(context, 'codepath.markAsParentNode', this.handleMarkAsParentNode.bind(this));
        this.registerCommand(context, 'codepath.markAsBroNode', this.handleMarkAsBroNode.bind(this));
        
        // Register clipboard operation commands
        this.registerCommand(context, 'codepath.copyNode', this.handleCopyNode.bind(this));
        this.registerCommand(context, 'codepath.pasteNode', this.handlePasteNode.bind(this));
        this.registerCommand(context, 'codepath.cutNode', this.handleCutNode.bind(this));
        this.registerCommand(context, 'codepath.copyNodeFilePath', this.handleCopyNodeFilePath.bind(this));
        this.registerCommand(context, 'codepath.openTextReference', this.handleOpenTextReference.bind(this));
        this.registerCommand(context, 'codepath.openTextReferenceAndSetBreakpoint', this.handleOpenTextReferenceAndSetBreakpoint.bind(this));
        this.registerCommand(context, 'codepath.openTextReferenceFromContext', this.handleOpenTextReferenceFromContext.bind(this));
        
        // Register node order commands
        this.registerCommand(context, 'codepath.moveNodeUp', this.handleMoveNodeUp.bind(this));
        this.registerCommand(context, 'codepath.moveNodeDown', this.handleMoveNodeDown.bind(this));
        
        // Register other existing commands
        this.registerCommand(context, 'codepath.switchCurrentNode', this.handleSwitchCurrentNode.bind(this));
        this.registerCommand(context, 'codepath.deleteCurrentNode', this.handleDeleteCurrentNode.bind(this));
        this.registerCommand(context, 'codepath.deleteCurrentNodeWithChildren', this.handleDeleteCurrentNodeWithChildren.bind(this));
        this.registerCommand(context, 'codepath.openPanel', this.handleOpenPanel.bind(this));
        this.registerCommand(context, 'codepath.refreshPreview', this.handleRefreshPreview.bind(this));
        this.registerCommand(context, 'codepath.createGraph', this.handleCreateGraph.bind(this));
        this.registerCommand(context, 'codepath.switchGraph', this.handleSwitchGraph.bind(this));
        this.registerCommand(context, 'codepath.exportGraph', this.handleExportGraph.bind(this));
        this.registerCommand(context, 'codepath.importGraph', this.handleImportGraph.bind(this));
        // AI Features - Temporarily disabled for future consideration
        // this.registerCommand(context, 'codepath.generateGraphFromBlueprint', this.handleGenerateGraphFromBlueprint.bind(this));
        this.registerCommand(context, 'codepath.deleteGraph', this.handleDeleteGraph.bind(this));
        this.registerCommand(context, 'codepath.togglePreviewFormat', this.handleTogglePreviewFormat.bind(this));
        this.registerCommand(context, 'codepath.validateNodeLocations', this.handleValidateNodeLocations.bind(this));
        this.registerCommand(context, 'codepath.relocateNode', this.handleRelocateNode.bind(this));
        this.registerCommand(context, 'codepath.debugGraphState', this.handleDebugGraphState.bind(this));
        this.registerCommand(context, 'codepath.previewGraphFile', this.handlePreviewGraphFile.bind(this));
        this.registerCommand(context, 'codepath.shareGraphFile', this.handleShareGraphFile.bind(this));

        // 文件/文件夹备份相关命令
        this.registerCommand(context, 'codepath.backupResource', this.handleBackupResource.bind(this));
        this.registerCommand(context, 'codepath.restoreResourceFromLatestBackup', this.handleRestoreResourceFromLatestBackup.bind(this));
        this.registerCommand(context, 'codepath.restoreResourceFromBackupFile', this.handleRestoreResourceFromBackupFile.bind(this));
        this.registerCommand(context, 'codepath.keepLatestBackups', this.handleKeepLatestBackups.bind(this));
        this.registerCommand(context, 'codepath.clearAllBackups', this.handleClearAllBackups.bind(this));

        this.registerCommand(context, 'codepath.copyCodeContext', this.handleCopyCodeContext.bind(this));

        // 代码上下文篮子相关命令
        this.registerCommand(context, 'codepath.addToBasket', this.handleAddToBasket.bind(this));
        this.registerCommand(context, 'codepath.clearAndAddToBasket', this.handleClearAndAddToBasket.bind(this));
        this.registerCommand(context, 'codepath.openBasketPanel', this.handleOpenBasketPanel.bind(this));
        this.registerCommand(context, 'codepath.showBasketHistory', this.handleShowBasketHistory.bind(this));
        this.registerCommand(context, 'codepath.restoreBasketFromHistory', this.handleRestoreBasketFromHistory.bind(this));
        this.registerCommand(context, 'codepath.deleteBasketHistoryEntry', this.handleDeleteBasketHistoryEntry.bind(this));
        this.registerCommand(context, 'codepath.renameBasketHistoryEntry', this.handleRenameBasketHistoryEntry.bind(this));

        // Initialize context state
        this.updateContextState();
    }

    /**
     * Helper method to register a command and track disposables
     */
    private registerCommand(
        context: vscode.ExtensionContext,
        command: string,
        handler: (...args: any[]) => any
    ): void {
        const disposable = vscode.commands.registerCommand(command, handler);
        context.subscriptions.push(disposable);
        this.disposables.push(disposable);
    }

    /**
     * Handle creating a new node from selected text
     */
    private async handleCreateNode(uri?: vscode.Uri): Promise<void> {
        return this.handleMarkAsNewNode(uri);
    }

    /**
     * Handle creating a child node
     */
    private async handleCreateChildNode(uri?: vscode.Uri): Promise<void> {
        return this.handleMarkAsChildNode(uri);
    }

    /**
     * Handle creating a parent node
     */
    private async handleCreateParentNode(uri?: vscode.Uri): Promise<void> {
        return this.handleMarkAsParentNode(uri);
    }

    /**
     * Handle creating a bro node (sibling node)
     */
    private async handleCreateBroNode(uri?: vscode.Uri): Promise<void> {
        return this.handleMarkAsBroNode(uri);
    }

    /**
     * Handle marking as new node (updated naming)
     */
    private async handleMarkAsNewNode(uri?: vscode.Uri): Promise<void> {
        try {
            const context = await this.getCreationContext(uri);
            const node = await this.integrationManager.createNodeWorkflow(
                context.name, context.filePath, context.lineNumber
            );
            this.showSuccess(`已标记为新节点: ${node.name}`, `文件: ${node.filePath}, 行号: ${node.lineNumber}`);
        } catch (error) {
            this.handleError('标记为新节点', error);
        }
    }

    /**
     * Handle marking as child node (updated naming)
     */
    private async handleMarkAsChildNode(uri?: vscode.Uri): Promise<void> {
        try {
            const context = await this.getCreationContext(uri);
            const node = await this.integrationManager.createChildNodeWorkflow(
                context.name, context.filePath, context.lineNumber
            );
            this.showSuccess(`已标记为子节点: ${node.name}`, `文件: ${node.filePath}, 行号: ${node.lineNumber}`);
        } catch (error) {
            this.handleError('标记为子节点', error);
        }
    }

    /**
     * Handle marking as parent node (updated naming)
     */
    private async handleMarkAsParentNode(uri?: vscode.Uri): Promise<void> {
        try {
            const context = await this.getCreationContext(uri);
            const node = await this.integrationManager.createParentNodeWorkflow(
                context.name, context.filePath, context.lineNumber
            );
            this.showSuccess(`已标记为父节点: ${node.name}`, `文件: ${node.filePath}, 行号: ${node.lineNumber}`);
        } catch (error) {
            this.handleError('标记为父节点', error);
        }
    }

    /**
     * Handle marking as bro node (updated naming)
     */
    private async handleMarkAsBroNode(uri?: vscode.Uri): Promise<void> {
        try {
            const context = await this.getCreationContext(uri);
            const node = await this.integrationManager.createBroNodeWorkflow(
                context.name, context.filePath, context.lineNumber
            );
            this.showSuccess(`已标记为兄弟节点: ${node.name}`, `文件: ${node.filePath}, 行号: ${node.lineNumber}`);
        } catch (error) {
            this.handleError('标记为兄弟节点', error);
        }
    }

    /**
     * Handle copying current node and its children
     */
    private async handleCopyNode(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw new Error('没有选择当前节点');
            }

            await this.clipboardManager.copyNode(currentNode.id);
            this.showSuccess('已复制该节点及其子节点', `节点: ${currentNode.name}`, '粘贴', () => {
                executeCommandSafely('codepath.pasteNode');
            });
        } catch (error) {
            this.handleError('复制节点', error);
        }
    }

    /**
     * Handle pasting node from clipboard
     */
    private async handlePasteNode(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            const parentId = currentNode?.id;

            const pastedNodes = await this.clipboardManager.pasteNode(parentId);
            await this.integrationManager.updatePreview();

            const rootNodeCount = pastedNodes.length;
            this.showSuccess(`已粘贴 ${rootNodeCount} 个节点及其子节点`, `成功粘贴到当前位置`);
        } catch (error) {
            this.handleError('粘贴节点', error);
        }
    }

    /**
     * Handle cutting current node and its children
     */
    private async handleCutNode(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw new Error('没有选择当前节点');
            }

            await this.clipboardManager.cutNode(currentNode.id);
            this.showSuccess('已剪切该节点及其子节点', `节点: ${currentNode.name}`, '粘贴', () => {
                executeCommandSafely('codepath.pasteNode');
            });
        } catch (error) {
            this.handleError('剪切节点', error);
        }
    }

    /**
     * Handle copying current node file path
     */
    private async handleCopyNodeFilePath(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw new Error('当前没有选中节点');
            }

            if (!currentNode.filePath) {
                throw new Error('该节点没有关联文件路径');
            }

            await vscode.env.clipboard.writeText(currentNode.filePath);
            this.showSuccess('已复制当前节点的文件路径', `节点: ${currentNode.name}`, '再次复制', async () => {
                await vscode.env.clipboard.writeText(currentNode.filePath);
            });
        } catch (error) {
            this.handleError('复制节点文件路径', error);
        }
    }

    /**
     * Handle moving current node up in sibling order
     */
    private async handleMoveNodeUp(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw new Error('没有选择当前节点');
            }

            const moved = await this.nodeOrderManager.moveNodeUp(currentNode.id);
            if (moved) {
                await this.integrationManager.updatePreview();
                this.showSuccess('节点已上移', `节点: ${currentNode.name}`);
            } else {
                this.showInfo('节点已在最上方', `节点: ${currentNode.name}`);
            }
        } catch (error) {
            this.handleError('移动节点', error);
        }
    }

    /**
     * Handle moving current node down in sibling order
     */
    private async handleMoveNodeDown(): Promise<void> {
        try {
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw new Error('没有选择当前节点');
            }

            const moved = await this.nodeOrderManager.moveNodeDown(currentNode.id);
            if (moved) {
                await this.integrationManager.updatePreview();
                this.showSuccess('节点已下移', `节点: ${currentNode.name}`);
            } else {
                this.showInfo('节点已在最下方', `节点: ${currentNode.name}`);
            }
        } catch (error) {
            this.handleError('移动节点', error);
        }
    }

    /**
     * Handle switching current node
     */
    private async handleSwitchCurrentNode(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph || currentGraph.nodes.size === 0) {
                vscode.window.showInformationMessage('No nodes available to switch to');
                return;
            }

            // Get all nodes for quick pick
            const nodeItems: vscode.QuickPickItem[] = Array.from(currentGraph.nodes.values()).map(node => ({
                label: node.name,
                description: `${node.filePath}:${node.lineNumber}`,
                detail: node.codeSnippet || undefined
            }));

            const selected = await vscode.window.showQuickPick(nodeItems, {
                placeHolder: 'Select a node to switch to',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // Find the node by name and location
                const targetNode = Array.from(currentGraph.nodes.values()).find(node => 
                    node.name === selected.label && 
                    `${node.filePath}:${node.lineNumber}` === selected.description
                );

                if (targetNode) {
                    // Use integration manager for complete workflow
                    await this.integrationManager.switchNodeWorkflow(targetNode.id);
                }
            }
        } catch (error) {
            this.handleError('切换节点', error);
        }
    }

    /**
     * Handle deleting the current node
     */
    private async handleDeleteCurrentNode(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                vscode.window.showWarningMessage('No active graph found');
                return;
            }

            if (!currentGraph.currentNodeId) {
                vscode.window.showWarningMessage('No current node selected');
                return;
            }

            const currentNode = currentGraph.nodes.get(currentGraph.currentNodeId);
            if (!currentNode) {
                vscode.window.showWarningMessage('Current node not found');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `确定要删除节点 "${currentNode.name}" 吗？子节点将被保留并重新连接到父节点。`,
                { modal: true },
                '删除'
            );

            if (confirmation === '删除') {
                await this.nodeManager.deleteNode(currentGraph.currentNodeId);
                this.showSuccess(`已删除节点: ${currentNode.name}`);
                await this.integrationManager.updatePreview();
            }
        } catch (error) {
            this.handleError('删除节点', error);
        }
    }

    /**
     * Handle deleting the current node and all its children
     */
    private async handleDeleteCurrentNodeWithChildren(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                vscode.window.showWarningMessage('No active graph found');
                return;
            }

            if (!currentGraph.currentNodeId) {
                vscode.window.showWarningMessage('No current node selected');
                return;
            }

            const currentNode = currentGraph.nodes.get(currentGraph.currentNodeId);
            if (!currentNode) {
                vscode.window.showWarningMessage('Current node not found');
                return;
            }

            // Count descendants
            const { Graph } = require('../models/Graph');
            const graphModel = Graph.fromJSON(currentGraph);
            const descendants = graphModel.getDescendants(currentGraph.currentNodeId);
            const totalToDelete = descendants.length + 1;

            const confirmation = await vscode.window.showWarningMessage(
                `确定要删除节点 "${currentNode.name}" 及其所有 ${descendants.length} 个子节点吗？共 ${totalToDelete} 个节点将被删除。此操作无法撤销。`,
                { modal: true },
                '删除'
            );

            if (confirmation === '删除') {
                await this.nodeManager.deleteNodeWithChildren(currentGraph.currentNodeId);
                this.showSuccess(`已删除 ${totalToDelete} 个节点`);
                await this.integrationManager.updatePreview();
            }
        } catch (error) {
            this.handleError('删除节点', error);
        }
    }

    /**
     * Handle opening the CodePath panel
     */
    private async handleOpenPanel(): Promise<void> {
        try {
            await this.integrationManager.showPreview();
        } catch (error) {
            // Error handling is done in IntegrationManager
            console.error('Open panel command failed:', error);
        }
    }

    /**
     * Handle refreshing the preview
     */
    private async handleRefreshPreview(): Promise<void> {
        try {
            await this.integrationManager.refreshPreviewAndReveal();
            this.showSuccess('预览已刷新', '已自动检查并显示预览面板');
        } catch (error) {
            this.handleError('刷新预览', error);
        }
    }



    /**
     * Handle creating a new graph
     */
    private async handleCreateGraph(): Promise<void> {
        try {
            const graphName = await vscode.window.showInputBox({
                prompt: 'Enter a name for the new graph',
                placeHolder: 'Graph name (optional)',
                validateInput: (value) => {
                    if (value && value.trim().length === 0) {
                        return 'Graph name cannot be empty';
                    }
                    return null;
                }
            });

            if (graphName !== undefined) {
                // Create the graph (this also sets it as current graph in GraphManager)
                const graph = await this.graphManager.createGraph(graphName || undefined);
                
                // Use switchGraphWorkflow to ensure all UI components are properly updated
                // This will reload the graph and update status bar, preview, context, etc.
                // Note: switchGraphWorkflow will show "Switched to graph" message
                await this.integrationManager.switchGraphWorkflow(graph.id);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create CodePath: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle switching between graphs
     */
    private async handleSwitchGraph(): Promise<void> {
        try {
            const graphs = await this.graphManager.listGraphs();
            
            if (graphs.length === 0) {
                vscode.window.showInformationMessage('No CodePaths available. Create a new CodePath first.');
                return;
            }

            const graphItems: vscode.QuickPickItem[] = graphs.map(graph => ({
                label: graph.name,
                description: `${graph.nodeCount} nodes`,
                detail: `Created: ${graph.createdAt.toLocaleDateString()}, Updated: ${graph.updatedAt.toLocaleDateString()}`
            }));

            const selected = await vscode.window.showQuickPick(graphItems, {
                placeHolder: 'Select a graph to switch to',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                const targetGraph = graphs.find(g => g.name === selected.label);
                if (targetGraph) {
                    // Use integration manager for complete workflow
                    await this.integrationManager.switchGraphWorkflow(targetGraph.id);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to switch CodePath: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle exporting current graph
     */
    private async handleExportGraph(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                vscode.window.showErrorMessage('No active graph to export');
                return;
            }

            const exportPath = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${currentGraph.name}.md`),
                filters: {
                    'markdown': ['md']
                }
            });

            if (exportPath) {
                const exportContent = await this.graphManager.exportGraph(currentGraph, 'md');
                await vscode.workspace.fs.writeFile(exportPath, Buffer.from(exportContent, 'utf8'));
                vscode.window.showInformationMessage(`CodePath exported to: ${exportPath.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export CodePath: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle importing a graph
     */
    private async handleImportGraph(): Promise<void> {
        try {
            const importPath = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'markdown': ['md']
                }
            });

            if (importPath && importPath[0]) {
                const content = await vscode.workspace.fs.readFile(importPath[0]);
                const contentString = Buffer.from(content).toString('utf8');
                
                const importedGraph = await this.graphManager.importGraph(contentString);
                
                // Show preview panel if not already visible
                await this.integrationManager.showPreview();
                
                // Automatically switch to the imported graph (this will update preview)
                await this.integrationManager.switchGraphWorkflow(importedGraph.id);
                
                // Force preview update to ensure it shows the new graph
                await this.integrationManager.updatePreview();
                
                // Navigate to current node if exists
                if (importedGraph.currentNodeId) {
                    const currentNode = importedGraph.nodes.get(importedGraph.currentNodeId);
                    if (currentNode) {
                        try {
                            // Open the file and navigate to the line in the main editor (Column One)
                            const fileUri = vscode.Uri.file(currentNode.filePath);
                            const document = await vscode.workspace.openTextDocument(fileUri);
                            const editor = await vscode.window.showTextDocument(document, {
                                viewColumn: vscode.ViewColumn.One,
                                preserveFocus: false
                            });
                            
                            // Navigate to the line
                            const position = new vscode.Position(currentNode.lineNumber - 1, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(
                                new vscode.Range(position, position),
                                vscode.TextEditorRevealType.InCenter
                            );
                            
                            vscode.window.showInformationMessage(
                                `已导入 CodePath "${importedGraph.name}" 并导航到当前节点 "${currentNode.name}"`
                            );
                        } catch (navError) {
                            // If navigation fails, still show success message
                            vscode.window.showInformationMessage(
                                `已导入 CodePath "${importedGraph.name}"（无法导航到节点位置：${navError instanceof Error ? navError.message : '文件不存在'}）`
                            );
                        }
                    } else {
                        vscode.window.showInformationMessage(`已导入 CodePath "${importedGraph.name}"`);
                    }
                } else {
                    vscode.window.showInformationMessage(`已导入 CodePath "${importedGraph.name}"`);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import CodePath: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle creating a graph from AI generated blueprint JSON
     */
    private async handleGenerateGraphFromBlueprint(): Promise<void> {
        try {
            const rawContent = await this.resolveBlueprintContent();

            if (!rawContent) {
                vscode.window.showWarningMessage('未获取到蓝图内容，请先选中或复制蓝图 JSON 后重试。');
                return;
            }

            const jsonContent = this.extractBlueprintJson(rawContent);
            let blueprint: AIGraphBlueprint;

            try {
                blueprint = JSON.parse(jsonContent) as AIGraphBlueprint;
            } catch (parseError) {
                const message = parseError instanceof Error ? parseError.message : String(parseError);
                throw new Error(`无法解析蓝图 JSON：${message}`);
            }

            const graph = await this.graphManager.createGraphFromBlueprint(blueprint);

            await this.integrationManager.showPreview();
            await this.integrationManager.switchGraphWorkflow(graph.id);
        } catch (error) {
            this.feedbackManager.handleError('AI 蓝图生成 CodePath', error, 'CommandManager');
        }
    }

    /**
     * Handle deleting a graph
     */
    private async handleDeleteGraph(): Promise<void> {
        try {
            const graphs = await this.graphManager.listGraphs();
            
            if (graphs.length === 0) {
                vscode.window.showInformationMessage('No graphs available to delete.');
                return;
            }

            const graphItems: vscode.QuickPickItem[] = graphs.map(graph => ({
                label: graph.name,
                description: `${graph.nodeCount} nodes`,
                detail: `Created: ${graph.createdAt.toLocaleDateString()}`
            }));

            const selected = await vscode.window.showQuickPick(graphItems, {
                placeHolder: 'Select a graph to delete',
                matchOnDescription: true
            });

            if (selected) {
                const targetGraph = graphs.find(g => g.name === selected.label);
                if (targetGraph) {
                    const confirmation = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete CodePath "${targetGraph.name}"? This action cannot be undone.`,
                        { modal: true },
                        'Delete'
                    );

                    if (confirmation === 'Delete') {
                        await this.graphManager.deleteGraph(targetGraph.id);
                        vscode.window.showInformationMessage(`Deleted CodePath: ${targetGraph.name}`);
                        
                        // Update preview through integration manager
                        await this.integrationManager.updatePreview();
                    }
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete CodePath: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle toggling preview format between text and mermaid
     */
    private async handleTogglePreviewFormat(): Promise<void> {
        try {
            await this.integrationManager.togglePreviewFormat();
        } catch (error) {
            // Error handling is done in IntegrationManager
            console.error('Toggle preview format command failed:', error);
        }
    }

    /**
     * Handle validating all node locations in the current graph
     */
    private async handleValidateNodeLocations(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                vscode.window.showWarningMessage('No active CodePath. Please create or load a CodePath first.');
                return;
            }

            vscode.window.showInformationMessage('Validating node locations...');

            const results = await this.integrationManager.getNodeManager().validateAllNodes();
            
            let validCount = 0;
            let invalidCount = 0;
            const invalidNodes: Array<{ id: string; name: string; message?: string }> = [];

            for (const [nodeId, result] of results) {
                if (result.isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                    const node = currentGraph.nodes.get(nodeId);
                    if (node) {
                        invalidNodes.push({
                            id: nodeId,
                            name: node.name,
                            message: result.message
                        });
                    }
                }
            }

            if (invalidCount === 0) {
                vscode.window.showInformationMessage(`All ${validCount} nodes are valid!`);
            } else {
                const action = await vscode.window.showWarningMessage(
                    `Found ${invalidCount} invalid node(s) out of ${validCount + invalidCount} total.`,
                    'Show Details',
                    'Dismiss'
                );

                if (action === 'Show Details') {
                    const details = invalidNodes.map(n => `- ${n.name}: ${n.message || 'Unknown error'}`).join('\n');
                    const channel = vscode.window.createOutputChannel('CodePath Validation');
                    channel.appendLine('Invalid Nodes:');
                    channel.appendLine(details);
                    channel.show();
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to validate node locations: ${errorMessage}`);
        }
    }

    /**
     * Handle relocating a node to a new location
     */
    private async handleRelocateNode(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                vscode.window.showWarningMessage('No active CodePath. Please create or load a CodePath first.');
                return;
            }

            // Get all nodes
            const nodes = Array.from(currentGraph.nodes.values());
            if (nodes.length === 0) {
                vscode.window.showWarningMessage('No nodes in the current CodePath.');
                return;
            }

            // Let user select a node
            const nodeItems = nodes.map(node => ({
                label: node.name,
                description: `${node.filePath}:${node.lineNumber}`,
                node
            }));

            const selectedItem = await vscode.window.showQuickPick(nodeItems, {
                placeHolder: 'Select a node to relocate'
            });

            if (!selectedItem) {
                return;
            }

            // Get current editor position
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Please open a file and position the cursor where you want to relocate the node.');
                return;
            }

            const newFilePath = editor.document.uri.fsPath;
            const newLineNumber = editor.selection.active.line + 1;

            const action = await vscode.window.showInformationMessage(
                `Relocate "${selectedItem.node.name}" to ${newFilePath}:${newLineNumber}?`,
                'Yes',
                'No'
            );

            if (action === 'Yes') {
                await this.integrationManager.getNodeManager().relocateNode(
                    selectedItem.node.id,
                    newFilePath,
                    newLineNumber
                );

                vscode.window.showInformationMessage('Node relocated successfully!');
                await this.integrationManager.updatePreview();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to relocate node: ${errorMessage}`);
        }
    }

    /**
     * Handle debugging graph state
     */
    private async handleDebugGraphState(): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            
            if (!currentGraph) {
                vscode.window.showInformationMessage('No active graph found.');
                return;
            }

            const { Graph } = require('../models/Graph');
            const graphModel = Graph.fromJSON(currentGraph);

            const info = [
                `Graph ID: ${currentGraph.id}`,
                `Graph Name: ${currentGraph.name}`,
                `Total Nodes: ${currentGraph.nodes.size}`,
                `Root Nodes: ${currentGraph.rootNodes.length}`,
                `Current Node ID: ${currentGraph.currentNodeId || 'None'}`,
                ``,
                `Node IDs in graph:`,
                ...Array.from(currentGraph.nodes.keys()).map(id => `  - ${id}`),
                ``,
                `Root Node IDs:`,
                ...currentGraph.rootNodes.map(id => `  - ${id}`)
            ];

            // Check if current node exists
            if (currentGraph.currentNodeId) {
                const currentNodeExists = currentGraph.nodes.has(currentGraph.currentNodeId);
                info.push(``);
                info.push(`Current Node Status: ${currentNodeExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
                
                if (!currentNodeExists) {
                    info.push(`⚠️ WARNING: Current node ID points to non-existent node!`);
                    info.push(`This will be fixed automatically on next graph load.`);
                }
            }

            // Show in output channel
            const outputChannel = vscode.window.createOutputChannel('CodePath Debug');
            outputChannel.clear();
            outputChannel.appendLine('=== CodePath Graph State Debug ===');
            outputChannel.appendLine('');
            info.forEach(line => outputChannel.appendLine(line));
            outputChannel.show();

            vscode.window.showInformationMessage('Graph state written to Output panel (CodePath Debug)');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to debug graph state: ${errorMessage}`);
        }
    }

    /**
     * Handle previewing a graph file
     */
    private async handlePreviewGraphFile(uri: vscode.Uri): Promise<void> {
        try {
            if (!uri) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            // Read the graph file
            const content = await vscode.workspace.fs.readFile(uri);
            const graphData = JSON.parse(Buffer.from(content).toString('utf8'));

            // Load the graph
            const graph = await this.graphManager.loadGraph(graphData.id);

            // Show preview and switch to the graph
            await this.integrationManager.showPreview();
            await this.integrationManager.switchGraphWorkflow(graph.id);

            vscode.window.showInformationMessage(`已切换到图表 "${graph.name}"`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to preview graph: ${errorMessage}`);
        }
    }

    /**
     * Handle sharing a graph file
     */
    private async handleShareGraphFile(uri: vscode.Uri): Promise<void> {
        try {
            if (!uri) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }

            const fileName = uri.fsPath.split(/[\\/]/).pop() || 'graph file';

            // Try to copy file using system commands
            const platform = process.platform;
            let copyCommand: string;
            
            if (platform === 'win32') {
                // Windows: Use PowerShell to copy file to clipboard
                copyCommand = `powershell.exe -Command "Set-Clipboard -Path '${uri.fsPath}'"`;
            } else if (platform === 'darwin') {
                // macOS: Use osascript
                copyCommand = `osascript -e 'set the clipboard to (POSIX file "${uri.fsPath}")'`;
            } else {
                // Linux: Fall back to copying file path as text
                await vscode.env.clipboard.writeText(uri.fsPath);
                vscode.window.showInformationMessage(
                    `✅ 文件路径已复制到剪贴板！\n📁 ${fileName}\n\n您可以将此路径分享给团队成员，或手动复制文件。`,
                    { modal: false }
                );
                return;
            }

            // Execute copy command
            const { exec } = require('child_process');
            exec(copyCommand, (error: any) => {
                if (error) {
                    // Fallback to copying path
                    vscode.env.clipboard.writeText(uri.fsPath);
                    vscode.window.showInformationMessage(
                        `✅ 文件路径已复制到剪贴板！\n📁 ${fileName}\n\n您可以将此路径分享给团队成员。`,
                        { modal: false }
                    );
                } else {
                    vscode.window.showInformationMessage(
                        `✅ 文件已复制到剪贴板！\n📁 ${fileName}\n\n您可以直接粘贴（Ctrl+V）到聊天工具或文件夹中分享。`,
                        { modal: false }
                    );
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to share graph: ${errorMessage}`);
        }
    }

    /**
     * 处理从资源管理器或编辑器快速备份文件/文件夹
     */
     private async handleBackupResource(uri?: vscode.Uri, selectedUris?: vscode.Uri[]): Promise<void> {
        try {
            const targetUris = this.resolveBackupTargetUris(uri, selectedUris);
            if (!targetUris.length) {
                this.showWarning('请先在资源管理器或编辑器中选择要备份的文件或文件夹');
                return;
            }

            const note = await vscode.window.showInputBox({
                prompt: '请输入本次备份备注（可留空）',
                placeHolder: '例如：重构前版本、测试前快照等'
            });

            const targetPaths = targetUris.map(item => item.fsPath);

            for (const targetPath of targetPaths) {
                await this.fileBackupManager.backupResource(targetPath, note ?? undefined);
            }

            if (targetPaths.length === 1) {
                this.showSuccess('已创建文件备份', `路径: ${targetPaths[0]}`);
            } else {
                this.showSuccess(
                    `已创建 ${targetPaths.length} 个文件/文件夹备份`,
                    targetPaths.join('\n')
                );
            }
        } catch (error) {
            this.handleError('创建文件备份', error);
        }
    }

    /**
     * 处理从最新备份还原文件/文件夹
     */
    private async handleRestoreResourceFromLatestBackup(uri?: vscode.Uri): Promise<void> {
        try {
            const targetUri = this.resolveBackupTargetUri(uri);
            if (!targetUri) {
                this.showWarning('请先在资源管理器或编辑器中选择需要还原的文件或文件夹');
                return;
            }

            await this.fileBackupManager.restoreResourceFromLatestBackup(targetUri.fsPath);

            this.showSuccess('已从最新备份还原', `路径: ${targetUri.fsPath}`);
        } catch (error) {
            this.handleError('从备份还原文件或文件夹', error);
        }
    }

    /**
     * 处理：在备份文件/目录上“还原到此备份版本”
     */
    private async handleRestoreResourceFromBackupFile(uri?: vscode.Uri): Promise<void> {
        try {
            if (!uri || uri.scheme !== 'file') {
                this.showWarning('请在 .codepath/file-backups 中选择需要还原的备份文件或目录');
                return;
            }

            await this.fileBackupManager.restoreResourceFromBackupFile(uri.fsPath);

            this.showSuccess('已从此备份版本还原', `备份路径: ${uri.fsPath}`);
        } catch (error) {
            this.handleError('从指定备份版本还原文件或文件夹', error);
        }
    }

    /**
     * 处理全局备份清理：每个资源只保留一份最新备份
     */
    private async handleKeepLatestBackups(): Promise<void> {
        try {
            const result = await this.fileBackupManager.keepLatestBackups();

            if (result.deletedRecords === 0) {
                this.showInfo('当前没有需要清理的旧备份');
            } else {
                this.showSuccess(
                    `已清理 ${result.deletedRecords} 条旧备份`,
                    `实际删除备份文件/目录数量: ${result.deletedFiles}`
                );
            }
        } catch (error) {
            this.handleError('清理旧备份', error);
        }
    }

    /**
     * 处理清空所有文件备份
     */
    private async handleClearAllBackups(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                '确定要删除所有 CodePath 文件备份吗？此操作不可撤销。',
                { modal: true },
                '确定删除'
            );

            if (confirmation !== '确定删除') {
                return;
            }

            await this.fileBackupManager.clearAllBackups();
            this.showSuccess('所有 CodePath 文件备份已清空');
        } catch (error) {
            this.handleError('清空所有文件备份', error);
        }
    }

    /**
     * 根据当前上下文解析备份目标 URI
     */
    private resolveBackupTargetUri(uri?: vscode.Uri): vscode.Uri | null {
        if (uri && uri.scheme === 'file') {
            return uri;
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            return activeEditor.document.uri;
        }

        return null;
    }

    /**
     * 解析多选或单选场景下的备份目标 URI 列表
     */
    private resolveBackupTargetUris(uri?: vscode.Uri, selectedUris?: vscode.Uri[]): vscode.Uri[] {
        const candidates: vscode.Uri[] = [];

        if (Array.isArray(selectedUris) && selectedUris.length) {
            candidates.push(...selectedUris.filter(item => item.scheme === 'file'));
        }

        if (uri && uri.scheme === 'file') {
            candidates.push(uri);
        }

        if (!candidates.length) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.scheme === 'file') {
                candidates.push(activeEditor.document.uri);
            }
        }

        const unique = new Map<string, vscode.Uri>();
        for (const item of candidates) {
            unique.set(item.fsPath, item);
        }

        return Array.from(unique.values());
    }

    /**
     * 复制选中代码的上下文到剪贴板
     */
    private async handleCopyCodeContext(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                this.showWarning('当前没有活动的文本编辑器');
                return;
            }

            const selections = editor.selections?.length ? editor.selections : [editor.selection];
            const segments: string[] = [];

            for (const selection of selections) {
                if (selection.isEmpty) {
                    continue;
                }

                const selectedText = editor.document.getText(selection);
                if (!selectedText.trim()) {
                    continue;
                }

                const startLine = selection.start.line + 1;
                let endLine = selection.end.line + 1;

                if (selection.end.character === 0 && selection.end.line > selection.start.line) {
                    endLine -= 1;
                }

                const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
                let relativePath = workspaceFolder
                    ? path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath)
                    : editor.document.uri.fsPath;

                if (!relativePath) {
                    relativePath = editor.document.fileName || 'untitled';
                }

                const lineLabel = endLine > startLine ? `${startLine}-${endLine}` : `${startLine}`;
                const header = `${relativePath}:${lineLabel}`;
                const snippet = `\`\`\`\n${selectedText.replace(/\r\n/g, '\n')}\n\`\`\``;

                segments.push(`${header}\n${snippet}`);
            }

            if (!segments.length) {
                this.showWarning('请先选择需要复制的代码片段');
                return;
            }

            await vscode.env.clipboard.writeText(segments.join('\n\n'));
            this.showSuccess('代码上下文已复制到剪贴板', `共复制 ${segments.length} 个片段`);
        } catch (error) {
            this.handleError('复制代码上下文', error);
        }
    }

    private async handleOpenTextReference(...args: unknown[]): Promise<void> {
        await this.handleOpenTextReferenceInternal({
            setBreakpoint: false,
            preferredInput: this.extractCommandTextArgument(args)
        });
    }

    private async handleOpenTextReferenceAndSetBreakpoint(...args: unknown[]): Promise<void> {
        await this.handleOpenTextReferenceInternal({
            setBreakpoint: true,
            preferredInput: this.extractCommandTextArgument(args)
        });
    }

    private async handleOpenTextReferenceFromContext(...args: unknown[]): Promise<void> {
        await this.handleOpenTextReferenceInternal({
            setBreakpoint: false,
            preferredInput: this.extractCommandTextArgument(args),
            skipEditorSelection: true
        });
    }

    private async handleOpenTextReferenceInternal(options: {
        setBreakpoint: boolean;
        preferredInput?: string;
        skipEditorSelection?: boolean;
    }): Promise<void> {
        const operation = options.setBreakpoint ? '根据文本引用定位并添加断点' : '根据文本引用定位';

        try {
            const rawInput = await this.resolveTextReferenceInput({
                preferredInput: options.preferredInput,
                skipEditorSelection: options.skipEditorSelection
            });
            if (!rawInput) {
                this.showWarning('未提供可解析的文件引用');
                return;
            }

            const resolvedReference = await this.fileReferenceResolver.resolveReference(rawInput);
            const targetUri = await this.pickTextReferenceCandidate(resolvedReference);
            if (!targetUri) {
                return;
            }

            const openResult = await this.openReferenceDocument(targetUri, resolvedReference.reference);
            const breakpointCreated = options.setBreakpoint
                ? this.ensureBreakpointAt(targetUri, openResult.actualLineNumber)
                : false;
            const displayPath = this.getDisplayPath(targetUri);
            const detail = openResult.actualLineNumber === resolvedReference.reference.lineNumber
                ? `${displayPath}#L${openResult.actualLineNumber}`
                : `${displayPath}#L${openResult.actualLineNumber}（原始请求 #L${resolvedReference.reference.lineNumber} 超出文件范围）`;

            if (options.setBreakpoint) {
                const message = breakpointCreated ? '已打开文件并添加断点' : '已打开文件，目标行已存在断点';
                this.showSuccess(message, detail);
                return;
            }

            this.showSuccess('已打开文件并定位到目标行', detail);
        } catch (error) {
            this.handleError(operation, error);
        }
    }

    private async resolveTextReferenceInput(options: {
        preferredInput?: string;
        skipEditorSelection?: boolean;
    } = {}): Promise<string | null> {
        const preferredText = (options.preferredInput || '').trim();
        if (preferredText && this.fileReferenceResolver.parseReference(preferredText)) {
            return preferredText;
        }

        const selectedText = options.skipEditorSelection ? '' : this.getSelectedEditorText();
        if (selectedText && this.fileReferenceResolver.parseReference(selectedText)) {
            return selectedText;
        }

        const clipboardText = (await vscode.env.clipboard.readText()).trim();
        if (clipboardText && this.fileReferenceResolver.parseReference(clipboardText)) {
            return clipboardText;
        }

        const input = await vscode.window.showInputBox({
            prompt: '输入文件引用，例如 ReagentGridView.cs#L794',
            placeHolder: '支持 file.cs#L123、src/file.cs:123、path/to/file.cs#L123-L130',
            value: preferredText || selectedText || clipboardText
        });

        return input?.trim() || null;
    }

    private extractCommandTextArgument(args: unknown[]): string {
        for (const arg of args) {
            if (typeof arg === 'string') {
                const text = arg.trim();
                if (text) {
                    return text;
                }
                continue;
            }

            if (!arg || typeof arg !== 'object') {
                continue;
            }

            const record = arg as Record<string, unknown>;
            const candidateKeys = ['selectionText', 'selectedText', 'text', 'value', 'label'];
            for (const key of candidateKeys) {
                const value = record[key];
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
        }

        return '';
    }

    private getSelectedEditorText(): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return '';
        }

        const selection = editor.selection;
        if (!selection || selection.isEmpty) {
            return '';
        }

        return editor.document.getText(selection).trim();
    }

    private async pickTextReferenceCandidate(resolvedReference: ResolvedTextReference): Promise<vscode.Uri | null> {
        const { reference, candidates } = resolvedReference;
        if (candidates.length === 1) {
            return candidates[0];
        }

        const items: TextReferenceQuickPickItem[] = candidates.map(uri => ({
            label: path.basename(uri.fsPath),
            description: `${this.getDisplayPath(uri)}#L${reference.lineNumber}`,
            detail: uri.fsPath,
            uri
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `找到 ${items.length} 个匹配文件，请选择要打开的目标`
        });

        return selected?.uri ?? null;
    }

    private async openReferenceDocument(
        uri: vscode.Uri,
        reference: ParsedTextReference
    ): Promise<{ actualLineNumber: number; actualColumnNumber: number; actualEndLineNumber?: number }> {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, {
            preserveFocus: false,
            preview: false
        });

        const maximumLineNumber = Math.max(1, document.lineCount || 1);
        const actualLineNumber = Math.min(Math.max(reference.lineNumber, 1), maximumLineNumber);
        const actualEndLineNumber = reference.endLineNumber
            ? Math.min(Math.max(reference.endLineNumber, actualLineNumber), maximumLineNumber)
            : undefined;
        const actualColumnNumber = this.clampColumnNumber(document, actualLineNumber, reference.columnNumber);
        const startPosition = new vscode.Position(actualLineNumber - 1, actualColumnNumber - 1);
        const endPosition = actualEndLineNumber
            ? new vscode.Position(actualEndLineNumber - 1, this.getLineLength(document, actualEndLineNumber - 1))
            : startPosition;
        const range = new vscode.Range(startPosition, endPosition);

        editor.selection = new vscode.Selection(startPosition, endPosition);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        return { actualLineNumber, actualColumnNumber, actualEndLineNumber };
    }

    private clampColumnNumber(document: vscode.TextDocument, lineNumber: number, requestedColumnNumber?: number): number {
        const requestedColumn = requestedColumnNumber ?? 1;
        const lineLength = this.getLineLength(document, lineNumber - 1);
        return Math.min(Math.max(requestedColumn, 1), lineLength + 1);
    }

    private getLineLength(document: vscode.TextDocument, zeroBasedLineNumber: number): number {
        if (typeof document.lineAt !== 'function') {
            return 0;
        }

        try {
            return document.lineAt(zeroBasedLineNumber).text.length;
        } catch {
            return 0;
        }
    }

    private ensureBreakpointAt(uri: vscode.Uri, lineNumber: number): boolean {
        if (this.hasSourceBreakpointAt(uri, lineNumber)) {
            return false;
        }

        const position = new vscode.Position(lineNumber - 1, 0);
        const range = new vscode.Range(position, position);
        const location = new vscode.Location(uri, range);

        vscode.debug.addBreakpoints([
            new vscode.SourceBreakpoint(location, true)
        ]);

        return true;
    }

    private hasSourceBreakpointAt(uri: vscode.Uri, lineNumber: number): boolean {
        const normalizedTargetPath = uri.fsPath.replace(/\\/g, '/').toLowerCase();
        const zeroBasedLineNumber = lineNumber - 1;

        return vscode.debug.breakpoints.some((breakpoint: any) => {
            const breakpointPath = breakpoint?.location?.uri?.fsPath;
            const breakpointLine = breakpoint?.location?.range?.start?.line;

            return typeof breakpointPath === 'string'
                && breakpointLine === zeroBasedLineNumber
                && breakpointPath.replace(/\\/g, '/').toLowerCase() === normalizedTargetPath;
        });
    }

    private getDisplayPath(uri: vscode.Uri): string {
        const relativePath = vscode.workspace.asRelativePath(uri);
        if (relativePath && relativePath !== uri.fsPath) {
            return relativePath;
        }

        return uri.fsPath;
    }

    /**
     * 获取创建上下文，支持编辑器与资源管理器两种入口
     */
    private async getCreationContext(uri?: vscode.Uri): Promise<CreationContext> {
        const activeEditor = vscode.window.activeTextEditor;

        if (uri && activeEditor && this.areUrisEqual(activeEditor.document.uri, uri)) {
            const editorContext = await this.getEditorCreationContext(activeEditor);
            if (editorContext) {
                return editorContext;
            }
        }

        if (uri) {
            const explorerContext = await this.getExplorerContextFromUri(uri);
            if (explorerContext) {
                return explorerContext;
            }
        }

        if (!activeEditor) {
            const explorerContext = await this.getExplorerContext();
            if (explorerContext) {
                return explorerContext;
            }
            throw new Error('未找到活动编辑器或选中的文件/文件夹');
        }

        const editorContext = await this.getEditorCreationContext(activeEditor);
        if (editorContext) {
            return editorContext;
        }

        throw new Error('请先选择代码文本或在文件资源管理器中选择文件/文件夹');
    }

    /**
     * Get creation context from explorer selection (file/folder context)
     */
    private async getExplorerContext(): Promise<CreationContext | null> {
        try {
            // Try to get the selected resource from the explorer
            const selectedResource = await this.getSelectedExplorerResource();
            
            if (selectedResource) {
                return await this.getExplorerContextFromUri(selectedResource);
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get explorer context:', error);
            return null;
        }
    }

    /**
     * Get creation context from a specific URI (file/folder)
     */
    private async getExplorerContextFromUri(uri: vscode.Uri): Promise<CreationContext | null> {
        try {
            // Validate that the URI exists and get its stats
            const stats = await vscode.workspace.fs.stat(uri);
            const isDirectory = (stats.type & vscode.FileType.Directory) !== 0;
            
            // Validate the file system path
            this.validateFileSystemPath(uri.fsPath);
            
            // Get safe node name from path
            const name = this.getSafeNodeName(uri.fsPath);
            
            // For directories, always use line 1 as specified in requirements (9.5)
            // For files, also use line 1 as default when no editor selection is available
            const lineNumber = 1;
            
            // Use absolute path for consistency with other node creation methods
            const finalPath = uri.fsPath;
            
            // Log the context creation for debugging
            console.log(`[CommandManager] Created context from ${isDirectory ? 'folder' : 'file'}: ${name} at ${finalPath}:${lineNumber}`);
            
            return {
                name: name,
                filePath: finalPath,
                lineNumber: lineNumber
            };
        } catch (error) {
            console.error('Failed to get explorer context from URI:', error);
            
            // Handle VS Code file system errors
            if (error instanceof vscode.FileSystemError) {
                if (error.code === 'FileNotFound') {
                    throw new Error('选中的文件或文件夹不存在');
                } else if (error.code === 'NoPermissions') {
                    throw new Error('没有权限访问选中的文件或文件夹');
                }
            }
            
            // Re-throw our custom validation errors
            if (error instanceof Error && (
                error.message.includes('无效') || 
                error.message.includes('过长') || 
                error.message.includes('字符') ||
                error.message.includes('保留名称') ||
                error.message.includes('节点名称')
            )) {
                throw error;
            }
            
            throw new Error('无法处理选中的文件或文件夹');
        }
    }

    /**
     * Get the currently selected resource from the explorer
     */
    private async getSelectedExplorerResource(): Promise<vscode.Uri | null> {
        // VS Code doesn't provide a direct API to get the selected explorer resource
        // when no URI is passed as argument. This is a limitation.
        
        // Try to get from the active text editor if it's a file
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            // Validate that the file still exists
            try {
                await vscode.workspace.fs.stat(activeEditor.document.uri);
                return activeEditor.document.uri;
            } catch (error) {
                console.warn('Active editor file no longer exists:', activeEditor.document.uri.fsPath);
                return null;
            }
        }
        
        return null;
    }

    /**
     * 判断两个 URI 是否指向同一路径
     */
    private areUrisEqual(a: vscode.Uri, b: vscode.Uri): boolean {
        return a.fsPath === b.fsPath;
    }

    /**
     * 从编辑器中推导创建上下文
     */
    private async getEditorCreationContext(editor: vscode.TextEditor): Promise<CreationContext | null> {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (selectedText && selectedText.trim().length > 0) {
            return {
                name: selectedText.trim().substring(0, 50),
                filePath: editor.document.uri.fsPath,
                lineNumber: selection.start.line + 1
            };
        }

        if (editor.document.uri.scheme === 'file') {
            try {
                const fileContext = await this.getExplorerContextFromUri(editor.document.uri);
                if (fileContext) {
                    return {
                        ...fileContext,
                        lineNumber: selection.start.line + 1
                    };
                }
            } catch (error) {
                console.warn('无法从编辑器上下文推导文件信息:', error);
            }
        }

        return null;
    }

    /**
     * 获取 AI 蓝图内容来源，优先选中内容，其次尝试剪贴板
     */
    private async resolveBlueprintContent(): Promise<string | null> {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const selection = editor.selection;
            if (selection && !selection.isEmpty) {
                const selectedText = editor.document.getText(selection).trim();
                if (selectedText) {
                    return selectedText;
                }
            }

            const documentText = editor.document.getText().trim();
            const languageId = editor.document.languageId;
            const isTextCandidate = ['json', 'markdown', 'plaintext'].includes(languageId);

            if (isTextCandidate && documentText && documentText.length <= 200000 && documentText.includes('{')) {
                return documentText;
            }
        }

        const clipboardText = (await vscode.env.clipboard.readText()).trim();
        if (clipboardText) {
            return clipboardText;
        }

        return null;
    }

    /**
     * 从文本中提取 JSON 负载，兼容 Markdown 代码块
     */
    private extractBlueprintJson(rawContent: string): string {
        if (!rawContent) {
            return '';
        }

        const trimmed = rawContent.trim();
        const jsonBlockPattern = /```json\s*([\s\S]*?)```/i;
        const genericBlockPattern = /```\s*([\s\S]*?)```/;

        const jsonBlockMatch = trimmed.match(jsonBlockPattern);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            return jsonBlockMatch[1].trim();
        }

        const genericMatch = trimmed.match(genericBlockPattern);
        if (genericMatch && genericMatch[1]) {
            return genericMatch[1].trim();
        }

        return trimmed;
    }

    /**
     * Validate file/folder path for node creation
     */
    private validateFileSystemPath(filePath: string): void {
        // Check path length (Windows has 260 character limit)
        if (filePath.length > 260) {
            throw new Error('文件路径过长，请使用较短的路径');
        }
        
        // Check for invalid characters
        const invalidChars = /[<>"|?*]/;
        if (invalidChars.test(filePath)) {
            throw new Error('文件路径包含无效字符');
        }
        
        // Check for reserved names on Windows
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
        const fileName = filePath.split(/[\\/]/).pop() || '';
        if (reservedNames.test(fileName)) {
            throw new Error('文件名为系统保留名称');
        }
    }

    /**
     * Check if a path represents a directory
     */
    private async isDirectory(uri: vscode.Uri): Promise<boolean> {
        try {
            const stats = await vscode.workspace.fs.stat(uri);
            return (stats.type & vscode.FileType.Directory) !== 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get a safe node name from file/folder path
     */
    private getSafeNodeName(filePath: string): string {
        const pathParts = filePath.split(/[\\/]/);
        let name = pathParts[pathParts.length - 1] || '';
        
        // Remove file extension for cleaner node names (optional)
        // name = name.replace(/\.[^/.]+$/, '');
        
        // Trim and validate
        name = name.trim();
        if (!name) {
            throw new Error('无法从路径中提取有效的节点名称');
        }
        
        // Limit length for display purposes
        if (name.length > 50) {
            name = name.substring(0, 47) + '...';
        }
        
        return name;
    }

    /**
     * Handle errors with enhanced feedback and recovery suggestions
     */
    private handleError(operation: string, error: any): void {
        this.feedbackManager.handleError(operation, error, 'CommandManager');
    }

    /**
     * Show success message with enhanced feedback
     */
    private showSuccess(message: string, details?: string, actionLabel?: string, action?: () => void): void {
        this.feedbackManager.showSuccess(message, details, actionLabel, action);
    }

    /**
     * Show information message with logging
     */
    private showInfo(message: string, details?: string): void {
        this.feedbackManager.showInfo(message, details);
    }

    /**
     * Show warning message with enhanced feedback
     */
    private showWarning(message: string, details?: string, actionLabel?: string, action?: () => void): void {
        this.feedbackManager.showWarning(message, details, actionLabel, action);
    }

    /**
     * Update VS Code context state for conditional menu items
     */
    private updateContextState(): void {
        // This is now handled by IntegrationManager
        // Keep this method for backward compatibility but delegate to integration manager
        const state = this.integrationManager.getState();
        
        executeCommandSafely('setContext', 'codepath.hasCurrentNode', state.hasCurrentNode);
        executeCommandSafely('setContext', 'codepath.hasCurrentGraph', state.hasGraph);
    }

    // ==================== Code Context Basket Commands ====================

    /**
     * Handle adding selected code to basket
     * 处理将选中代码添加到篮子
     */
    private async handleAddToBasket(): Promise<void> {
        await this.addSelectionToBasket();
    }

    /**
     * Handle clearing basket before adding selection
     * 处理清空篮子后再添加选中代码
     */
    private async handleClearAndAddToBasket(): Promise<void> {
        await this.addSelectionToBasket({ clearBeforeAdd: true });
    }

    /**
     * Shared logic for adding selected text into basket
     */
    private async addSelectionToBasket(options: { clearBeforeAdd?: boolean } = {}): Promise<void> {
        const { clearBeforeAdd } = options;

        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor. Please open a file first.');
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                throw new Error('No code selected. Please select some code first.');
            }

            const selectedCode = editor.document.getText(selection);
            const filePath = editor.document.fileName;
            const lineNumber = selection.start.line + 1;
            const lineEndNumber = selection.end.line + 1;
            const language = editor.document.languageId;

            const note = await vscode.window.showInputBox({
                prompt: 'Add a note for this code snippet (optional)',
                placeHolder: 'e.g., "Component initialization logic"'
            });

            const multipleContextManager = (this.integrationManager as any).getMultipleContextManager?.();
            if (!multipleContextManager) {
                throw new Error('Code Context Basket is not initialized. Please try again.');
            }

            let currentBasket = multipleContextManager.getCurrentBasket();
            if (!currentBasket) {
                currentBasket = await multipleContextManager.createBasket('Default Basket');
                multipleContextManager.setCurrentBasket(currentBasket);
            }

            if (clearBeforeAdd) {
                await multipleContextManager.clearBasket();
                currentBasket = multipleContextManager.getCurrentBasket();
            }

            if (!currentBasket) {
                throw new Error('Failed to load basket after clearing.');
            }

            await multipleContextManager.addItem({
                code: selectedCode,
                filePath,
                lineNumber,
                lineEndNumber,
                language,
                note: note || '',
                id: '',
                createdAt: new Date(),
                order: 0
            });

            const itemCount = currentBasket.items.length;
            const successTitle = clearBeforeAdd
                ? `✅ Basket cleared and code added to "${currentBasket.name}"`
                : `✅ Code added to basket "${currentBasket.name}"`;

            this.showSuccess(successTitle, `Total items: ${itemCount}`);

            await vscode.commands.executeCommand('codepath.basketView.focus');
        } catch (error) {
            const action = clearBeforeAdd ? 'Clear And Add to Basket' : 'Add to Basket';
            this.handleError(action, error);
        }
    }

    /**
     * Handle opening the basket panel
     * 处理打开篮子面板
     */
  private async handleOpenBasketPanel(): Promise<void> {
    try {
      await vscode.commands.executeCommand('codepath.basketView.focus');
    } catch (error) {
      this.handleError('Open Basket Panel', error);
    }
  }

  /**
   * 展示历史记录 QuickPick
   */
  private async handleShowBasketHistory(): Promise<void> {
    try {
      const entry = await this.pickHistoryEntry('选择要打开的 Code Context Basket 历史记录');
      if (!entry) {
        return;
      }
      await this.restoreHistoryEntryById(entry.historyId);
    } catch (error) {
      this.handleError('Show Basket History', error);
    }
  }

  /**
   * 处理从历史记录恢复篮子
   */
  private async handleRestoreBasketFromHistory(): Promise<void> {
    try {
      const entry = await this.pickHistoryEntry('选择要恢复的历史记录');
      if (!entry) {
        return;
      }
      await this.restoreHistoryEntryById(entry.historyId);
    } catch (error) {
      this.handleError('Restore Basket From History', error);
    }
  }

  /**
   * 处理删除历史记录
   */
  private async handleDeleteBasketHistoryEntry(): Promise<void> {
    try {
      const entry = await this.pickHistoryEntry('选择要删除的历史记录');
      if (!entry) {
        return;
      }

      const confirmed = await vscode.window.showWarningMessage(
        `确定要删除 "${entry.name}" 的历史记录吗？删除后无法恢复。`,
        { modal: true },
        '删除'
      );
      if (confirmed !== '删除') {
        return;
      }

      const multipleManager = this.integrationManager.getMultipleContextManager();
      await multipleManager.deleteHistoryEntry(entry.historyId);
      this.showSuccess('历史记录已删除', entry.name);
    } catch (error) {
      this.handleError('Delete Basket History Entry', error);
    }
  }

  /**
   * 处理编辑历史记录元数据
   */
  private async handleRenameBasketHistoryEntry(): Promise<void> {
    try {
      const entry = await this.pickHistoryEntry('选择要编辑的历史记录');
      if (!entry) {
        return;
      }

      const multipleManager = this.integrationManager.getMultipleContextManager();
      const detail = await multipleManager.getHistoryEntry(entry.historyId);

      const newName = await vscode.window.showInputBox({
        prompt: '输入新的历史记录名称',
        value: detail?.name || entry.name,
        ignoreFocusOut: true
      });

      if (!newName || newName.trim().length === 0) {
        return;
      }

      const newDescription = await vscode.window.showInputBox({
        prompt: '更新描述（可选）',
        value: detail?.description || '',
        ignoreFocusOut: true
      });

      const newTags = await vscode.window.showInputBox({
        prompt: '更新标签（用逗号分隔，可选）',
        value: detail?.tags?.join(', ') || '',
        ignoreFocusOut: true
      });

      const tags = newTags
        ? newTags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
        : detail?.tags;

      await multipleManager.updateHistoryEntry(entry.historyId, {
        name: newName,
        description: newDescription && newDescription.trim().length > 0 ? newDescription.trim() : undefined,
        tags
      });

      this.showSuccess('历史记录已更新', newName.trim());
    } catch (error) {
      this.handleError('Edit Basket History Entry', error);
    }
  }

  /**
   * 执行恢复操作的共享逻辑
   */
  private async restoreHistoryEntryById(historyId: string): Promise<void> {
    const multipleManager = this.integrationManager.getMultipleContextManager();
    const restored = await multipleManager.restoreBasketFromHistory(historyId, {
      asNew: false,
      setActive: true
    });

    if (!restored) {
      void vscode.window.showWarningMessage('未找到目标历史记录，可能已被删除。');
      return;
    }

    this.showSuccess('已打开历史篮子', `名称: ${restored.name}，片段数: ${restored.items.length}`);
    await vscode.commands.executeCommand('codepath.basketView.focus');
  }

  /**
   * 展示历史 QuickPick 并返回用户选择
   */
  private async pickHistoryEntry(
    placeHolder: string
  ): Promise<BasketHistorySummary | null> {
    const multipleManager = this.integrationManager.getMultipleContextManager();
    const historyEntries = await multipleManager.getHistorySummaries();

    if (historyEntries.length === 0) {
      void vscode.window.showInformationMessage('暂无可用的篮子历史记录。');
      return null;
    }

    const items: HistoryQuickPickItem[] = historyEntries.map(entry => ({
      label: entry.name,
      description: `${entry.itemCount} snippets`,
      detail: this.formatHistoryDetail(entry),
      entry
    }));

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder,
      matchOnDetail: true,
      ignoreFocusOut: true
    });

    return selection?.entry ?? null;
  }

  /**
   * 构建历史条目的详情文本
   */
  private formatHistoryDetail(entry: BasketHistorySummary): string {
    const detailParts: string[] = [
      `创建: ${this.formatDateTime(entry.createdAt)}`,
      `更新: ${this.formatDateTime(entry.updatedAt)}`
    ];

    if (entry.tags?.length) {
      detailParts.push(`标签: ${entry.tags.join(', ')}`);
    }

    return detailParts.join(' | ');
  }

  private formatDateTime(date: Date | undefined): string {
    if (!date) {
      return '-';
    }

    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.feedbackManager.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];

        // Dispose of clipboard manager
        if (this.clipboardManager) {
            this.clipboardManager.dispose();
        }
    }
}
