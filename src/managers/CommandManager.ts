import * as vscode from 'vscode';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { IntegrationManager } from './IntegrationManager';

/**
 * Manages VS Code command integration and context menu functionality
 */
export class CommandManager {
    private graphManager: GraphManager;
    private nodeManager: NodeManager;
    private integrationManager: IntegrationManager;
    private disposables: vscode.Disposable[] = [];

    constructor(
        graphManager: GraphManager,
        nodeManager: NodeManager,
        integrationManager: IntegrationManager
    ) {
        this.graphManager = graphManager;
        this.nodeManager = nodeManager;
        this.integrationManager = integrationManager;
    }

    /**
     * Register all VS Code commands and context menu handlers
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Register command handlers
        this.registerCommand(context, 'codepath.createNode', this.handleCreateNode.bind(this));
        this.registerCommand(context, 'codepath.createChildNode', this.handleCreateChildNode.bind(this));
        this.registerCommand(context, 'codepath.createParentNode', this.handleCreateParentNode.bind(this));
        this.registerCommand(context, 'codepath.switchCurrentNode', this.handleSwitchCurrentNode.bind(this));
        this.registerCommand(context, 'codepath.deleteCurrentNode', this.handleDeleteCurrentNode.bind(this));
        this.registerCommand(context, 'codepath.deleteCurrentNodeWithChildren', this.handleDeleteCurrentNodeWithChildren.bind(this));
        this.registerCommand(context, 'codepath.openPanel', this.handleOpenPanel.bind(this));
        this.registerCommand(context, 'codepath.refreshPreview', this.handleRefreshPreview.bind(this));
        this.registerCommand(context, 'codepath.createGraph', this.handleCreateGraph.bind(this));
        this.registerCommand(context, 'codepath.switchGraph', this.handleSwitchGraph.bind(this));
        this.registerCommand(context, 'codepath.exportGraph', this.handleExportGraph.bind(this));
        this.registerCommand(context, 'codepath.importGraph', this.handleImportGraph.bind(this));
        this.registerCommand(context, 'codepath.deleteGraph', this.handleDeleteGraph.bind(this));
        this.registerCommand(context, 'codepath.togglePreviewFormat', this.handleTogglePreviewFormat.bind(this));
        this.registerCommand(context, 'codepath.validateNodeLocations', this.handleValidateNodeLocations.bind(this));
        this.registerCommand(context, 'codepath.relocateNode', this.handleRelocateNode.bind(this));
        this.registerCommand(context, 'codepath.debugGraphState', this.handleDebugGraphState.bind(this));
        this.registerCommand(context, 'codepath.previewGraphFile', this.handlePreviewGraphFile.bind(this));
        this.registerCommand(context, 'codepath.shareGraphFile', this.handleShareGraphFile.bind(this));

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
    private async handleCreateNode(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('Please select code text first');
                return;
            }

            const selectedText = editor.document.getText(selection);
            const filePath = editor.document.uri.fsPath;
            const lineNumber = selection.start.line + 1; // VS Code uses 0-based line numbers

            // Use integration manager for complete workflow
            await this.integrationManager.createNodeWorkflow(selectedText, filePath, lineNumber);
        } catch (error) {
            // Error handling is done in IntegrationManager
            console.error('Create node command failed:', error);
        }
    }

    /**
     * Handle creating a child node
     */
    private async handleCreateChildNode(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('Please select code text first');
                return;
            }

            const selectedText = editor.document.getText(selection);
            const filePath = editor.document.uri.fsPath;
            const lineNumber = selection.start.line + 1;

            // Use integration manager for complete workflow
            await this.integrationManager.createChildNodeWorkflow(selectedText, filePath, lineNumber);
        } catch (error) {
            // Error handling is done in IntegrationManager
            console.error('Create child node command failed:', error);
        }
    }

    /**
     * Handle creating a parent node
     */
    private async handleCreateParentNode(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('Please select code text first');
                return;
            }

            const selectedText = editor.document.getText(selection);
            const filePath = editor.document.uri.fsPath;
            const lineNumber = selection.start.line + 1;

            // Use integration manager for complete workflow
            await this.integrationManager.createParentNodeWorkflow(selectedText, filePath, lineNumber);
        } catch (error) {
            // Error handling is done in IntegrationManager
            console.error('Create parent node command failed:', error);
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
            vscode.window.showErrorMessage(`Failed to switch node: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                vscode.window.showInformationMessage(`已删除节点: ${currentNode.name}`);
                await this.integrationManager.updatePreview();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`删除节点失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            const GraphModel = require('../models/Graph').Graph;
            const graphModel = GraphModel.fromJSON(currentGraph);
            const descendants = graphModel.getDescendants(currentGraph.currentNodeId);
            const totalToDelete = descendants.length + 1;

            const confirmation = await vscode.window.showWarningMessage(
                `确定要删除节点 "${currentNode.name}" 及其所有 ${descendants.length} 个子节点吗？共 ${totalToDelete} 个节点将被删除。此操作无法撤销。`,
                { modal: true },
                '删除'
            );

            if (confirmation === '删除') {
                await this.nodeManager.deleteNodeWithChildren(currentGraph.currentNodeId);
                vscode.window.showInformationMessage(`已删除 ${totalToDelete} 个节点`);
                await this.integrationManager.updatePreview();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`删除节点失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            await this.integrationManager.updatePreview();
            vscode.window.showInformationMessage('Preview refreshed');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                    'Markdown': ['md']
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
                    'Markdown': ['md']
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

            const GraphModel = require('../models/Graph').Graph;
            const graphModel = GraphModel.fromJSON(currentGraph);

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
     * Update VS Code context state for conditional menu items
     */
    private updateContextState(): void {
        // This is now handled by IntegrationManager
        // Keep this method for backward compatibility but delegate to integration manager
        const state = this.integrationManager.getState();
        vscode.commands.executeCommand('setContext', 'codepath.hasCurrentNode', state.hasCurrentNode);
        vscode.commands.executeCommand('setContext', 'codepath.hasCurrentGraph', state.hasGraph);
    }

    /**
     * Dispose of all registered commands
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}