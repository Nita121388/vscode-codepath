import * as vscode from 'vscode';
import { IWebviewManager, WebviewConfig } from '../interfaces/IWebviewManager';
import { ViewFormat } from '../types';
import { LocationTracker } from './LocationTracker';
import { INodeManager } from '../interfaces/INodeManager';

/**
 * WebviewManager handles VS Code webview panels for CodePath preview display
 * Implements split-screen layout with code and preview, toolbar with format toggle
 */
export class WebviewManager implements IWebviewManager {
    private panel: vscode.WebviewPanel | null = null;
    private context: vscode.ExtensionContext;
    private currentContent: string = '';
    private currentFormat: ViewFormat = 'text';
    private config: WebviewConfig;
    private onFormatToggleCallback?: () => Promise<void>;
    private onRefreshCallback?: () => Promise<void>;
    private locationTracker: LocationTracker;
    private nodeManager?: INodeManager;
    private getNodeByLocationCallback?: (filePath: string, lineNumber: number) => any;
    private onNodeSwitchCallback?: (nodeId: string) => Promise<void>;
    private onDeleteCurrentNodeCallback?: () => Promise<void>;
    private onDeleteCurrentNodeWithChildrenCallback?: () => Promise<void>;
    private onExportGraphCallback?: () => Promise<void>;
    private getCurrentGraphCallback?: () => any;
    private forcePreviewUpdateCallback?: () => Promise<void>;
    private onUpdateCurrentNodeCallback?: (updates: any) => Promise<void>;
    private isValidating: boolean = false;
    private nextUpdateIsForced: boolean = false;

    constructor(
        context: vscode.ExtensionContext,
        config?: Partial<WebviewConfig>
    ) {
        this.context = context;
        this.config = {
            title: 'CodePath Preview',
            viewType: 'codepath.preview',
            showOptions: vscode.ViewColumn.Beside,
            enableScripts: true,
            retainContextWhenHidden: true,
            ...config
        };
        this.locationTracker = new LocationTracker();
    }

    /**
     * Shows the preview panel with split-screen layout
     */
    public async showPreview(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(this.config.showOptions);
            return;
        }

        // Smart column selection: use existing column if available
        const viewColumn = this.getOptimalViewColumn();
        
        this.panel = vscode.window.createWebviewPanel(
            this.config.viewType,
            this.config.title,
            viewColumn,
            {
                enableScripts: this.config.enableScripts,
                retainContextWhenHidden: this.config.retainContextWhenHidden,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ]
            }
        );

        // Set up message handling
        this.setupMessageHandling();

        // Set up disposal handling
        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        // Initial content update
        await this.updateWebviewContent();
    }

    /**
     * Hides the preview panel
     */
    public hidePreview(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }

    private lastUpdateTime: number = 0;
    private readonly UPDATE_THROTTLE_MS = 100; // 节流：最多每100ms更新一次

    /**
     * Updates the webview content
     */
    public async updateContent(content: string, format: ViewFormat): Promise<void> {
        const force = this.nextUpdateIsForced;
        if (this.nextUpdateIsForced) {
            console.log('[WebviewManager] updateContent called with FORCE flag');
            this.nextUpdateIsForced = false; // Reset flag
        } else {
            console.log('[WebviewManager] updateContent called, content length:', content.length);
        }
        
        // 检查内容是否真的变化了（除非是强制更新）
        if (!force && this.currentContent === content && this.currentFormat === format) {
            console.log('[WebviewManager] Content unchanged, skipping');
            return; // 内容没变，不更新
        }

        // 节流：防止更新太频繁（除非是强制更新）
        if (!force) {
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastUpdateTime;
            if (timeSinceLastUpdate < this.UPDATE_THROTTLE_MS) {
                console.log('[WebviewManager] Throttled, time since last:', timeSinceLastUpdate);
                return; // 更新太频繁，跳过
            }
        }

        console.log('[WebviewManager] Updating webview, force:', force);
        console.log('[WebviewManager] Panel exists:', !!this.panel, 'visible:', this.panel?.visible, 'active:', this.panel?.active);
        this.currentContent = content;
        this.currentFormat = format;
        this.lastUpdateTime = Date.now();

        if (this.panel) {
            if (this.panel.visible) {
                console.log('[WebviewManager] Posting message to webview');
                // 只在面板可见时更新
                const result = this.panel.webview.postMessage({
                    command: 'updateContent',
                    content: content,
                    format: format
                });
                console.log('[WebviewManager] postMessage result:', result);
            } else {
                console.log('[WebviewManager] Panel exists but not visible!');
            }
        } else {
            console.log('[WebviewManager] Panel does not exist!');
        }
    }

    /**
     * Toggles the preview format between text and mermaid
     */
    public async toggleFormat(): Promise<void> {
        if (this.onFormatToggleCallback) {
            await this.onFormatToggleCallback();
        }
    }

    /**
     * Refreshes the preview content and validates node locations
     */
    public async refreshPreview(): Promise<void> {
        if (this.onRefreshCallback) {
            await this.onRefreshCallback();
        }
        
        // Validate all nodes after refresh (only if not already validating)
        if (!this.isValidating) {
            await this.validateAllNodeLocations();
        }
    }
    
    /**
     * Validates all nodes in the current graph and updates locations if needed
     */
    private async validateAllNodeLocations(): Promise<void> {
        if (!this.nodeManager || !this.getCurrentGraphCallback) {
            return;
        }
        
        // Prevent recursive validation
        if (this.isValidating) {
            return;
        }
        
        this.isValidating = true;
        
        try {
            const graphData = this.getCurrentGraphCallback();
            if (!graphData) {
                return;
            }
            
            // getCurrentGraph returns JSON data with nodes as a Map
            // Convert Map to array of nodes
            const nodesMap = graphData.nodes;
            if (!nodesMap || !(nodesMap instanceof Map)) {
                return;
            }
            
            const nodes = Array.from(nodesMap.values());
            
            // Store original line numbers before validation
            const originalLineNumbers = new Map<string, number>();
            for (const node of nodes) {
                originalLineNumbers.set(node.id, node.lineNumber);
            }
            
            const validationResults: Array<{
                nodeId: string;
                nodeName: string;
                result: 'valid' | 'updated' | 'warning';
                oldLine?: number;
                newLine?: number;
                message?: string;
            }> = [];
            
            for (const node of nodes) {
                const originalLine = originalLineNumbers.get(node.id)!;
                const validation = await this.locationTracker.validateLocation(node);
                
                if (validation.isValid) {
                    // Node is valid, no action needed
                    validationResults.push({
                        nodeId: node.id,
                        nodeName: node.name,
                        result: 'valid'
                    });
                } else if (validation.suggestedLocation && validation.confidence !== 'failed') {
                    // Found a better location, update the node
                    try {
                        const updatedNode = await this.locationTracker.updateNodeLocation(
                            node,
                            validation.suggestedLocation.filePath,
                            validation.suggestedLocation.lineNumber
                        );
                        
                        console.log(`[WebviewManager] Updating node ${node.name} from line ${originalLine} to ${validation.suggestedLocation.lineNumber}`);
                        await this.nodeManager.updateNode(node.id, {
                            filePath: updatedNode.filePath,
                            lineNumber: updatedNode.lineNumber,
                            codeSnippet: updatedNode.codeSnippet
                        });
                        console.log(`[WebviewManager] Node ${node.name} update completed`);
                        
                        validationResults.push({
                            nodeId: node.id,
                            nodeName: node.name,
                            result: 'updated',
                            oldLine: originalLine,
                            newLine: validation.suggestedLocation.lineNumber,
                            message: validation.reason
                        });
                    } catch (error) {
                        console.error(`Failed to update node ${node.id}:`, error);
                        validationResults.push({
                            nodeId: node.id,
                            nodeName: node.name,
                            result: 'warning',
                            message: `Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`
                        });
                    }
                } else {
                    // Could not find valid location
                    validationResults.push({
                        nodeId: node.id,
                        nodeName: node.name,
                        result: 'warning',
                        message: validation.reason || 'Location not found'
                    });
                }
            }
            
            // Save warning messages to nodes
            for (const result of validationResults) {
                if (result.result === 'warning' && result.message) {
                    console.log(`[WebviewManager] Saving warning for node ${result.nodeName}: ${result.message}`);
                    try {
                        await this.nodeManager.updateNode(result.nodeId, {
                            validationWarning: result.message
                        });
                        console.log(`[WebviewManager] Warning saved for node ${result.nodeName}`);
                    } catch (error) {
                        console.error(`Failed to save warning for node ${result.nodeId}:`, error);
                    }
                } else if (result.result === 'valid' || result.result === 'updated') {
                    // Clear warning for valid/updated nodes
                    try {
                        await this.nodeManager.updateNode(result.nodeId, {
                            validationWarning: undefined
                        });
                    } catch (error) {
                        console.error(`Failed to clear warning for node ${result.nodeId}:`, error);
                    }
                }
            }
            
            // Show summary to user
            this.showValidationSummary(validationResults);
            
            // Log validation results
            console.log('[WebviewManager] Validation results:', validationResults.map(r => `${r.nodeName}: ${r.result}`).join(', '));
            
            // If any nodes were updated or have warnings, force preview update
            const hasUpdates = validationResults.some(r => r.result === 'updated');
            const hasWarnings = validationResults.some(r => r.result === 'warning');
            console.log('[WebviewManager] Has updates:', hasUpdates, 'Has warnings:', hasWarnings);
            if (hasUpdates || hasWarnings) {
                console.log('[WebviewManager] Waiting for all changes to be saved...');
                // Wait to ensure all updates (including warnings) are saved to storage
                await new Promise(resolve => setTimeout(resolve, 150));
                console.log('[WebviewManager] Setting nextUpdateIsForced flag');
                // Set flag to force next update (bypass content check and throttling)
                this.nextUpdateIsForced = true;
                
                console.log('[WebviewManager] Checking callbacks - force:', !!this.forcePreviewUpdateCallback, 'refresh:', !!this.onRefreshCallback);
                
                // Use direct preview update callback if available
                if (this.forcePreviewUpdateCallback) {
                    console.log('[WebviewManager] Calling forcePreviewUpdateCallback');
                    await this.forcePreviewUpdateCallback();
                    console.log('[WebviewManager] forcePreviewUpdateCallback completed');
                } else if (this.onRefreshCallback) {
                    console.log('[WebviewManager] Calling onRefreshCallback');
                    // Temporarily set isValidating to false to allow refresh
                    this.isValidating = false;
                    await this.onRefreshCallback();
                    this.isValidating = true;
                    console.log('[WebviewManager] onRefreshCallback completed');
                }
            }
            
        } catch (error) {
            console.error('Failed to validate node locations:', error);
            vscode.window.showErrorMessage(`Failed to validate node locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isValidating = false;
        }
    }
    
    /**
     * Shows a summary of validation results to the user
     */
    private showValidationSummary(results: Array<{
        nodeId: string;
        nodeName: string;
        result: 'valid' | 'updated' | 'warning';
        oldLine?: number;
        newLine?: number;
        message?: string;
    }>): void {
        const validCount = results.filter(r => r.result === 'valid').length;
        const updatedCount = results.filter(r => r.result === 'updated').length;
        const warningCount = results.filter(r => r.result === 'warning').length;
        
        if (updatedCount === 0 && warningCount === 0) {
            // All nodes are valid
            vscode.window.showInformationMessage(`✅ All ${validCount} nodes are valid`);
            return;
        }
        
        // Build detailed message
        const messages: string[] = [];
        
        if (validCount > 0) {
            messages.push(`✅ ${validCount} valid`);
        }
        
        if (updatedCount > 0) {
            messages.push(`🔄 ${updatedCount} updated`);
            const updatedNodes = results.filter(r => r.result === 'updated');
            for (const node of updatedNodes.slice(0, 3)) { // Show first 3
                messages.push(`  • ${node.nodeName}: line ${node.oldLine} → ${node.newLine}`);
            }
            if (updatedNodes.length > 3) {
                messages.push(`  • ... and ${updatedNodes.length - 3} more`);
            }
        }
        
        if (warningCount > 0) {
            messages.push(`⚠️ ${warningCount} warnings`);
            const warningNodes = results.filter(r => r.result === 'warning');
            for (const node of warningNodes.slice(0, 3)) { // Show first 3
                messages.push(`  • ${node.nodeName}: ${node.message}`);
            }
            if (warningNodes.length > 3) {
                messages.push(`  • ... and ${warningNodes.length - 3} more`);
            }
        }
        
        const summary = messages.join('\n');
        
        if (warningCount > 0) {
            vscode.window.showWarningMessage(`Node validation completed:\n${summary}`, 'OK');
        } else {
            vscode.window.showInformationMessage(`Node validation completed:\n${summary}`, 'OK');
        }
    }

    /**
     * Checks if the preview panel is visible
     */
    public isVisible(): boolean {
        return this.panel !== null && this.panel.visible;
    }

    /**
     * Sets the format toggle callback
     */
    public setFormatToggleCallback(callback: () => Promise<void>): void {
        this.onFormatToggleCallback = callback;
    }

    /**
     * Sets the refresh callback
     */
    public setRefreshCallback(callback: () => Promise<void>): void {
        this.onRefreshCallback = callback;
    }

    /**
     * Sets the callback to get node by location
     */
    public setGetNodeByLocationCallback(callback: (filePath: string, lineNumber: number) => any): void {
        this.getNodeByLocationCallback = callback;
    }

    /**
     * Sets the callback to switch to a node
     */
    public setNodeSwitchCallback(callback: (nodeId: string) => Promise<void>): void {
        this.onNodeSwitchCallback = callback;
    }

    /**
     * Sets the node manager for updating node locations
     */
    public setNodeManager(nodeManager: INodeManager): void {
        this.nodeManager = nodeManager;
    }
    
    /**
     * Sets the callback to get current graph
     */
    public setGetCurrentGraphCallback(callback: () => any): void {
        this.getCurrentGraphCallback = callback;
    }
    
    /**
     * Sets the callback to force preview update
     */
    public setForcePreviewUpdateCallback(callback: () => Promise<void>): void {
        this.forcePreviewUpdateCallback = callback;
    }

    /**
     * Sets the callback to delete current node
     */
    public setDeleteCurrentNodeCallback(callback: () => Promise<void>): void {
        this.onDeleteCurrentNodeCallback = callback;
    }

    /**
     * Sets the callback to delete current node with children
     */
    public setDeleteCurrentNodeWithChildrenCallback(callback: () => Promise<void>): void {
        this.onDeleteCurrentNodeWithChildrenCallback = callback;
    }

    /**
     * Sets the callback to export graph
     */
    public setExportGraphCallback(callback: () => Promise<void>): void {
        this.onExportGraphCallback = callback;
    }

    /**
     * Sets the callback to update current node
     */
    public setUpdateCurrentNodeCallback(callback: (updates: any) => Promise<void>): void {
        this.onUpdateCurrentNodeCallback = callback;
    }

    /**
     * Disposes of webview resources
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
        this.locationTracker.dispose();
    }

    /**
     * Navigates to a specific file and line number with intelligent fallback
     */
    private async navigateToNode(
        filePath: string,
        lineNumber: number,
        codeSnippet?: string,
        options?: { preserveCurrentNode?: boolean }
    ): Promise<void> {
        try {
            console.log(`[WebviewManager] navigateToNode called: ${filePath}:${lineNumber}`);
            const preserveCurrent = options?.preserveCurrentNode ?? false;
            if (preserveCurrent) {
                console.log('[WebviewManager] preserveCurrentNode flag detected, will navigate without switching current node');
            }
            
            // Resolve the file path first
            const resolvedPath = await this.resolveFilePath(filePath);
            if (!resolvedPath) {
                throw new Error(`File not found: ${filePath}`);
            }
            console.log(`[WebviewManager] Resolved path: ${resolvedPath}`);

            // 检查是否为目录，目录无法直接打开文件
            try {
                const uri = vscode.Uri.file(resolvedPath);
                const stat = await vscode.workspace.fs.stat(uri);
                if ((stat.type & vscode.FileType.Directory) !== 0) {
                    console.log('[WebviewManager] Target is directory, reveal in explorer instead of opening');
                    await vscode.commands.executeCommand('revealInExplorer', uri);
                    vscode.window.showInformationMessage(`已在资源管理器中定位目录：${resolvedPath}`);
                    return;
                }
            } catch (error) {
                console.warn('[WebviewManager] Failed to stat resolved path:', error);
            }

            // Try to get the actual node if callback is available
            let actualNode = null;
            if (this.getNodeByLocationCallback) {
                actualNode = this.getNodeByLocationCallback(resolvedPath, lineNumber);
                console.log(`[WebviewManager] Found actual node: ${actualNode ? actualNode.id : 'null'}`);
            } else {
                console.log(`[WebviewManager] No getNodeByLocationCallback available`);
            }

            // Create a temporary node for validation
            const tempNode = actualNode || {
                id: 'temp',
                name: 'temp',
                filePath: resolvedPath,
                lineNumber,
                codeSnippet,
                createdAt: new Date(),
                parentId: null,
                childIds: []
            };

            // Use LocationTracker for intelligent navigation
            const result = await this.locationTracker.navigateToNode(tempNode);
            console.log(`[WebviewManager] Navigation result: success=${result.success}, confidence=${result.confidence}`);

            if (result.success) {
                // If we found the actual node, switch to it as the current node (unless preserving current selection)
                if (!preserveCurrent && actualNode && actualNode.id !== 'temp' && this.onNodeSwitchCallback) {
                    console.log(`[WebviewManager] Calling onNodeSwitchCallback for node: ${actualNode.id}`);
                    await this.onNodeSwitchCallback(actualNode.id);
                } else if (preserveCurrent) {
                    console.log('[WebviewManager] Skipping node switch due to preserveCurrentNode flag');
                } else {
                    console.log(`[WebviewManager] Not calling onNodeSwitchCallback: actualNode=${actualNode ? actualNode.id : 'null'}, hasCallback=${!!this.onNodeSwitchCallback}`);
                }

                // Show message if location was adjusted and update node location if user confirms
                if (result.confidence !== 'exact' && result.message && result.actualLocation) {
                    // For failed validation, show a different message
                    if (result.confidence === 'failed') {
                        const choice = await vscode.window.showWarningMessage(
                            `⚠️ ${result.message}. You can edit the node to update its location.`,
                            'Edit Node',
                            'Dismiss'
                        );
                        
                        // If user clicks Edit Node, open the edit panel
                        if (choice === 'Edit Node' && this.panel) {
                            this.panel.webview.postMessage({ command: 'requestCurrentNodeData' });
                        }
                    } else {
                        // For other confidence levels, offer to update location
                        const choice = await vscode.window.showWarningMessage(
                            `Code location may have changed: ${result.message}`,
                            'Update Location',
                            'Dismiss'
                        );
                        
                        // If user clicks Update Location, update the node's location
                        if (choice === 'Update Location' && actualNode && actualNode.id !== 'temp') {
                            try {
                                console.log(`[WebviewManager] Updating node ${actualNode.id} location to line ${result.actualLocation.lineNumber}`);
                                
                                // Update the node's location using LocationTracker
                                const updatedNode = await this.locationTracker.updateNodeLocation(
                                    actualNode,
                                    result.actualLocation.filePath,
                                    result.actualLocation.lineNumber
                                );
                                
                                // Save the updated node through NodeManager
                                if (this.nodeManager) {
                                    await this.nodeManager.updateNode(actualNode.id, {
                                        filePath: updatedNode.filePath,
                                        lineNumber: updatedNode.lineNumber,
                                        codeSnippet: updatedNode.codeSnippet
                                    });
                                    
                                    console.log(`[WebviewManager] Node location updated successfully`);
                                    console.log(`[WebviewManager] Updated node data:`, {
                                        id: actualNode.id,
                                        oldLine: actualNode.lineNumber,
                                        newLine: updatedNode.lineNumber
                                    });
                                    
                                    // Trigger preview refresh to show updated information
                                    if (this.onRefreshCallback) {
                                        console.log(`[WebviewManager] Triggering preview refresh after location update`);
                                        await this.onRefreshCallback();
                                        console.log(`[WebviewManager] Preview refresh completed`);
                                    } else {
                                        console.warn(`[WebviewManager] No refresh callback available!`);
                                    }
                                    
                                    vscode.window.showInformationMessage('Node location updated successfully');
                                }
                            } catch (error) {
                                console.error(`[WebviewManager] Failed to update node location:`, error);
                                vscode.window.showErrorMessage(`Failed to update node location: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                        }
                    }
                }
            } else {
                vscode.window.showErrorMessage(
                    `Failed to navigate: ${result.message || 'Location not found'}`
                );
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[WebviewManager] navigateToNode error:`, error);
            vscode.window.showErrorMessage(`Failed to navigate to node: ${errorMessage}`);
        }
    }

    /**
     * Resolves a file path to an absolute path
     */
    private async resolveFilePath(filePath: string): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        let uri: vscode.Uri | undefined;
        
        // Try 1: Use the path as-is if it's absolute
        if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
            const absoluteUri = vscode.Uri.file(filePath);
            try {
                await vscode.workspace.fs.stat(absoluteUri);
                uri = absoluteUri;
                console.log(`[WebviewManager] Resolved absolute path: ${uri.fsPath}`);
            } catch {
                // File doesn't exist at absolute path, will try other methods
                console.log(`[WebviewManager] Absolute path not found: ${filePath}`);
            }
        }
        
        // Try 2: Treat as relative path from workspace root
        if (!uri) {
            const relativeUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
            try {
                await vscode.workspace.fs.stat(relativeUri);
                uri = relativeUri;
                console.log(`[WebviewManager] Resolved relative path: ${uri.fsPath}`);
            } catch {
                // File doesn't exist as relative path either
                console.log(`[WebviewManager] Relative path not found: ${filePath}`);
            }
        }
        
        // Don't search by filename - this can find the wrong file!
        // If we can't find the exact path, return null and let the error be shown
        if (!uri) {
            console.warn(`[WebviewManager] Could not resolve file path: ${filePath}`);
        }
        
        return uri ? uri.fsPath : null;
    }

    /**
     * Sets up message handling for webview communication
     */
    private setupMessageHandling(): void {
        if (!this.panel) { return; }

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        await this.refreshPreview();
                        break;
                    case 'exportGraph':
                        if (this.onExportGraphCallback) {
                            await this.onExportGraphCallback();
                        }
                        break;
                    case 'ready':
                        // Webview is ready - content is already in initial HTML
                        // No need to update again
                        break;
                    case 'navigateToNode':
                        await this.navigateToNode(message.filePath, message.lineNumber, message.codeSnippet, {
                            preserveCurrentNode: message.preserveCurrentNode
                        });
                        break;
                    case 'deleteCurrentNode':
                        if (this.onDeleteCurrentNodeCallback) {
                            await this.onDeleteCurrentNodeCallback();
                        }
                        break;
                    case 'showContextMenu':
                        await this.showPreviewContextMenu(message.nodeId, message.x, message.y);
                        break;
                    case 'deleteCurrentNodeWithChildren':
                        if (this.onDeleteCurrentNodeWithChildrenCallback) {
                            await this.onDeleteCurrentNodeWithChildrenCallback();
                        }
                        break;
                    case 'requestCurrentNodeData':
                        await this.sendCurrentNodeData();
                        break;
                    case 'updateCurrentNode':
                        if (this.onUpdateCurrentNodeCallback) {
                            await this.onUpdateCurrentNodeCallback(message.data);
                        }
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Shows custom context menu for preview interface
     * Provides node-specific operations based on current context
     */
    private async showPreviewContextMenu(nodeId: string | null, x: number, y: number): Promise<void> {
        try {
            // Try to find the actual node from the nodeId (which might be filepath:lineNumber)
            const actualNode = this.findNodeByIdentifier(nodeId);
            const hasValidNode = actualNode !== null;

            // Build menu items based on context
            const items: vscode.QuickPickItem[] = [
                { 
                    label: '🔄 刷新', 
                    description: 'Refresh preview content',
                    detail: 'Reload and validate all node locations'
                },
                { 
                    label: '📤 导出', 
                    description: 'Export graph',
                    detail: 'Export current graph to file'
                }
            ];

            // Add node-specific operations if a valid node is found
            if (hasValidNode && this.isNodeOperationAvailable()) {
                items.push(
                    { 
                        label: '📋 复制', 
                        description: 'Copy node and children',
                        detail: 'Copy the selected node and all its children to clipboard'
                    },
                    { 
                        label: '📄 粘贴', 
                        description: 'Paste node',
                        detail: 'Paste node from clipboard as child of current node'
                    },
                    { 
                        label: '✂️ 剪切', 
                        description: 'Cut node and children',
                        detail: 'Move the selected node and all its children to clipboard'
                    },
                    { 
                        label: '⬆️ 上移', 
                        description: 'Move node up',
                        detail: 'Move node up in the sibling order'
                    },
                    { 
                        label: '⬇️ 下移', 
                        description: 'Move node down',
                        detail: 'Move node down in the sibling order'
                    }
                );
            } else if (await this.hasClipboardData()) {
                // Show paste option even without node selection if clipboard has data
                items.push({ 
                    label: '📄 粘贴', 
                    description: 'Paste node',
                    detail: 'Paste node from clipboard as new root node'
                });
            }

            // Show the quick pick menu
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: hasValidNode ? 
                    `选择操作 (Node: ${actualNode?.name || 'Unknown'})` : 
                    '选择操作 (Select Action)',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                await this.executePreviewAction(selected.label, actualNode?.id || null);
            }
        } catch (error) {
            console.error('[WebviewManager] Error showing context menu:', error);
            vscode.window.showErrorMessage(`Failed to show context menu: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Executes the selected preview action
     */
    private async executePreviewAction(action: string, nodeId: string | null): Promise<void> {
        try {
            // Extract the action type from the label (remove emoji and trim)
            const actionType = action.replace(/^[^\w\s]+\s*/, '').trim();

            switch (actionType) {
                case '刷新':
                    await this.refreshPreview();
                    break;
                case '导出':
                    if (this.onExportGraphCallback) {
                        await this.onExportGraphCallback();
                    } else {
                        await vscode.commands.executeCommand('codepath.exportGraph');
                    }
                    break;
                case '复制':
                    if (nodeId) {
                        // Set the node as current before copying
                        await this.setCurrentNodeForOperation(nodeId);
                        await vscode.commands.executeCommand('codepath.copyNode');
                    }
                    break;
                case '粘贴':
                    if (nodeId) {
                        // Set the node as current before pasting (paste as child)
                        await this.setCurrentNodeForOperation(nodeId);
                    }
                    await vscode.commands.executeCommand('codepath.pasteNode');
                    break;
                case '剪切':
                    if (nodeId) {
                        // Set the node as current before cutting
                        await this.setCurrentNodeForOperation(nodeId);
                        await vscode.commands.executeCommand('codepath.cutNode');
                    }
                    break;
                case '上移':
                    if (nodeId) {
                        // Set the node as current before moving
                        await this.setCurrentNodeForOperation(nodeId);
                        await vscode.commands.executeCommand('codepath.moveNodeUp');
                    }
                    break;
                case '下移':
                    if (nodeId) {
                        // Set the node as current before moving
                        await this.setCurrentNodeForOperation(nodeId);
                        await vscode.commands.executeCommand('codepath.moveNodeDown');
                    }
                    break;
                default:
                    console.warn(`[WebviewManager] Unknown action: ${actionType}`);
                    vscode.window.showWarningMessage(`Unknown action: ${actionType}`);
            }
        } catch (error) {
            console.error(`[WebviewManager] Error executing action ${action}:`, error);
            vscode.window.showErrorMessage(`Failed to execute ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sets the specified node as current for operations
     */
    private async setCurrentNodeForOperation(nodeId: string): Promise<void> {
        if (this.onNodeSwitchCallback) {
            await this.onNodeSwitchCallback(nodeId);
        }
    }

    /**
     * Checks if node operations are available (current graph exists)
     */
    private isNodeOperationAvailable(): boolean {
        if (!this.getCurrentGraphCallback) {
            return false;
        }
        
        const graph = this.getCurrentGraphCallback();
        return graph && graph.nodes && graph.nodes.size > 0;
    }

    /**
     * Finds a node by identifier (could be actual nodeId or filepath:lineNumber)
     */
    private findNodeByIdentifier(identifier: string | null): any | null {
        if (!identifier || !this.getCurrentGraphCallback || !this.getNodeByLocationCallback) {
            return null;
        }

        const graph = this.getCurrentGraphCallback();
        if (!graph || !graph.nodes) {
            return null;
        }

        // First try to find by actual node ID
        if (graph.nodes.has(identifier)) {
            return graph.nodes.get(identifier);
        }

        // If not found, try to parse as filepath:lineNumber and find matching node
        const match = identifier.match(/^(.+):(\d+)$/);
        if (match) {
            const [, filePath, lineNumber] = match;
            const lineNum = parseInt(lineNumber, 10);
            
            // Use the callback to find node by location
            return this.getNodeByLocationCallback(filePath, lineNum);
        }

        return null;
    }

    /**
     * Checks if clipboard has data for paste operations
     */
    private async hasClipboardData(): Promise<boolean> {
        try {
            // Check VS Code context for clipboard state
            const hasClipboard = await vscode.commands.executeCommand('getContext', 'codepath.hasClipboardNode');
            return Boolean(hasClipboard);
        } catch (error) {
            console.warn('[WebviewManager] Failed to check clipboard state:', error);
            return false;
        }
    }

    /**
     * Sends current node data to webview for editing
     */
    private async sendCurrentNodeData(): Promise<void> {
        if (!this.getCurrentGraphCallback || !this.panel) {
            return;
        }

        const graphData = this.getCurrentGraphCallback();
        if (!graphData || !graphData.currentNodeId) {
            vscode.window.showWarningMessage('No current node selected');
            return;
        }

        const nodesMap = graphData.nodes;
        if (!nodesMap || !(nodesMap instanceof Map)) {
            return;
        }

        const currentNode = nodesMap.get(graphData.currentNodeId);
        if (!currentNode) {
            vscode.window.showWarningMessage('Current node not found');
            return;
        }

        this.panel.webview.postMessage({
            command: 'showEditPanel',
            nodeData: {
                name: currentNode.name,
                lineNumber: currentNode.lineNumber,
                codeSnippet: currentNode.codeSnippet,
                description: currentNode.description
            }
        });
    }

    /**
     * Updates the webview HTML content
     */
    private async updateWebviewContent(): Promise<void> {
        if (!this.panel) { return; }

        const html = this.generateWebviewHtml();
        this.panel.webview.html = html;
    }

    /**
     * Generates the HTML content for the webview
     */
    private generateWebviewHtml(): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>CodePath Preview</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .toolbar {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background-color: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            gap: 8px;
            flex-shrink: 0;
        }

        .toolbar button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            font-size: 12px;
            cursor: pointer;
        }

        .toolbar button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .toolbar button.delete-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .toolbar button.delete-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .toolbar button.delete-btn.danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .toolbar button.delete-btn.danger:hover {
            opacity: 0.8;
        }

        .format-indicator {
            margin-left: auto;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }

        .content {
            flex: 1;
            overflow: auto;
            padding: 16px;
        }

        .preview-footer {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 6px 16px 12px;
            border-top: 1px solid var(--vscode-panel-border);
            font-style: italic;
        }

        .preview-text {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.2;
        }

        a.node-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
        }

        a.node-link:hover {
            color: var(--vscode-textLink-activeForeground);
        }

        .preview-mermaid {
            text-align: center;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
        }

        .empty-state h3 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .node-description {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-left: 1em;
        }

        .edit-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            min-width: 400px;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            display: none;
        }

        .edit-panel.visible {
            display: block;
        }

        .edit-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: none;
        }

        .edit-overlay.visible {
            display: block;
        }

        .edit-panel h3 {
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }

        .edit-field {
            margin-bottom: 12px;
        }

        .edit-field label {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .edit-field input,
        .edit-field textarea {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        .edit-field input:focus,
        .edit-field textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .edit-field textarea {
            resize: vertical;
            min-height: 60px;
        }

        .edit-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
        }

        .edit-actions button {
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }

        .edit-actions button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .edit-actions button.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .edit-actions button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .edit-actions button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="refresh">🔄 Refresh</button>
        <button id="exportGraph">📤 Export</button>
        <button id="editNode">✏️ Edit</button>
        <button id="deleteNode" class="delete-btn">🗑️ Delete Node</button>
        <button id="deleteNodeWithChildren" class="delete-btn danger">🗑️ Delete Node & Children</button>
    </div>
    
    <div class="content" id="content">
        ${this.renderContent()}
    </div>
    <div class="preview-footer">💡 Tip：按住 Ctrl 单击节点可在不切换当前节点的情况下跳转到代码位置。</div>

    <div class="edit-overlay" id="editOverlay"></div>
    <div class="edit-panel" id="editPanel">
        <h3>Edit Node</h3>
        <div class="edit-field">
            <label for="editName">Name</label>
            <input type="text" id="editName" />
        </div>
        <div class="edit-field">
            <label for="editLineNumber">Line Number</label>
            <input type="number" id="editLineNumber" min="1" />
        </div>
        <div class="edit-field">
            <label for="editCodeSnippet">Code Snippet</label>
            <textarea id="editCodeSnippet"></textarea>
        </div>
        <div class="edit-field">
            <label for="editDescription">Description</label>
            <textarea id="editDescription" placeholder="Optional description..."></textarea>
        </div>
        <div class="edit-actions">
            <button class="secondary" id="cancelEdit">Cancel</button>
            <button class="primary" id="saveEdit">Save</button>
        </div>
    </div>

    <script nonce="${nonce}">
        console.log('[Webview] Script loaded');
        const vscode = acquireVsCodeApi();
        console.log('[Webview] vscode API acquired');
        
        document.getElementById('refresh').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });
        
        document.getElementById('exportGraph').addEventListener('click', () => {
            vscode.postMessage({ command: 'exportGraph' });
        });
        
        document.getElementById('deleteNode').addEventListener('click', () => {
            vscode.postMessage({ command: 'deleteCurrentNode' });
        });
        
        document.getElementById('deleteNodeWithChildren').addEventListener('click', () => {
            vscode.postMessage({ command: 'deleteCurrentNodeWithChildren' });
        });
        
        document.getElementById('editNode').addEventListener('click', () => {
            vscode.postMessage({ command: 'requestCurrentNodeData' });
        });
        
        document.getElementById('cancelEdit').addEventListener('click', () => {
            hideEditPanel();
        });
        
        document.getElementById('saveEdit').addEventListener('click', () => {
            const name = document.getElementById('editName').value;
            const lineNumber = parseInt(document.getElementById('editLineNumber').value, 10);
            const codeSnippet = document.getElementById('editCodeSnippet').value;
            const description = document.getElementById('editDescription').value;
            
            console.log('[Webview] Save edit clicked');
            console.log('[Webview] Raw description value:', JSON.stringify(description));
            console.log('[Webview] Trimmed description:', JSON.stringify(description.trim()));
            
            // Use null instead of undefined so it's preserved in JSON serialization
            const trimmedCodeSnippet = codeSnippet.trim();
            const trimmedDescription = description.trim();
            
            const updateData = {
                name: name,
                lineNumber: lineNumber,
                codeSnippet: trimmedCodeSnippet || null,
                description: trimmedDescription || null
            };
            
            console.log('[Webview] Final description:', updateData.description);
            console.log('[Webview] Sending update data:', JSON.stringify(updateData));
            
            vscode.postMessage({
                command: 'updateCurrentNode',
                data: updateData
            });
            
            hideEditPanel();
        });
        
        document.getElementById('editOverlay').addEventListener('click', () => {
            hideEditPanel();
        });
        
        function showEditPanel(nodeData) {
            document.getElementById('editName').value = nodeData.name || '';
            document.getElementById('editLineNumber').value = nodeData.lineNumber || 1;
            document.getElementById('editCodeSnippet').value = nodeData.codeSnippet || '';
            document.getElementById('editDescription').value = nodeData.description || '';
            
            document.getElementById('editOverlay').classList.add('visible');
            document.getElementById('editPanel').classList.add('visible');
        }
        
        function hideEditPanel() {
            document.getElementById('editOverlay').classList.remove('visible');
            document.getElementById('editPanel').classList.remove('visible');
        }
        
        // Add context menu handler for custom preview menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // Get clicked element and find the closest node
            const clickedElement = e.target;
            let nodeElement = null;
            let nodeId = null;
            
            // Look for node-related elements (links with data-filepath or elements with data-node-id)
            if (clickedElement && clickedElement.closest) {
                // First try to find a node link
                const nodeLink = clickedElement.closest('a.node-link');
                if (nodeLink) {
                    nodeElement = nodeLink;
                    // For node links, we can derive a nodeId from the filepath and line
                    const filePath = nodeLink.getAttribute('data-filepath');
                    const lineNumber = nodeLink.getAttribute('data-linenumber');
                    if (filePath && lineNumber) {
                        // Create a pseudo nodeId for context menu operations
                        nodeId = \`\${filePath}:\${lineNumber}\`;
                    }
                } else {
                    // Try to find any element with data-node-id attribute
                    nodeElement = clickedElement.closest('[data-node-id]');
                    if (nodeElement) {
                        nodeId = nodeElement.getAttribute('data-node-id');
                    }
                }
            }
            
            // Send message to extension to show context menu
            vscode.postMessage({
                command: 'showContextMenu',
                nodeId: nodeId,
                x: e.clientX,
                y: e.clientY
            });
        });
        
        // Add click handler for node navigation
        document.addEventListener('click', (e) => {
            const link = e.target;
            if (link && link.tagName === 'A' && link.classList.contains('node-link')) {
                e.preventDefault();
                const filePath = link.getAttribute('data-filepath');
                const lineNumber = link.getAttribute('data-linenumber');
                const preserveCurrent = e.ctrlKey || e.metaKey;
                
                if (filePath && lineNumber) {
                    vscode.postMessage({
                        command: 'navigateToNode',
                        filePath: filePath,
                        lineNumber: parseInt(lineNumber, 10),
                        preserveCurrentNode: preserveCurrent
                    });
                }
            }
        }, false);
        
        // Listen for content updates from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('[Webview] Received message:', message.command);
            
            switch (message.command) {
                case 'updateContent':
                    console.log('[Webview] Updating content, length:', message.content?.length, 'format:', message.format);
                    updateContentDisplay(message.content, message.format);
                    console.log('[Webview] Content updated');
                    break;
                case 'showEditPanel':
                    showEditPanel(message.nodeData);
                    break;
            }
        });
        
        // Function to update content without reloading page
        function updateContentDisplay(content, format) {
            console.log('[Webview] updateContentDisplay called');
            console.log('[Webview] New content preview:', content.substring(0, 200));
            const contentDiv = document.getElementById('content');
            const formatIndicator = document.querySelector('.format-indicator');
            
            console.log('[Webview] contentDiv:', !!contentDiv, 'formatIndicator:', !!formatIndicator);
            console.log('[Webview] Current innerHTML length:', contentDiv?.innerHTML?.length);
            
            // Update format indicator
            if (formatIndicator) {
                formatIndicator.textContent = format.toUpperCase();
            }
            
            // Update content
            if (!content) {
                contentDiv.innerHTML = \`
                    <div class="empty-state">
                        <h3>No CodePath Selected</h3>
                        <p>Create or load a CodePath to see the preview.</p>
                    </div>
                \`;
            } else if (format === 'mermaid') {
                contentDiv.innerHTML = \`
                    <div class="preview-mermaid">
                        <pre><code>\${escapeHtml(content)}</code></pre>
                    </div>
                \`;
            } else {
                const htmlContent = convertTextToClickableHtml(content);
                console.log('[Webview] Generated HTML preview:', htmlContent.substring(0, 200));
                contentDiv.innerHTML = \`
                    <div class="preview-text">\${htmlContent}</div>
                \`;
                console.log('[Webview] innerHTML updated, new length:', contentDiv.innerHTML.length);
            }
        }
        
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Helper function to convert text to clickable HTML
        function convertTextToClickableHtml(text) {
            const lines = text.split('\\n');
            const htmlLines = [];
            
            for (const line of lines) {
                // Check if line is a description (starts with <i> and ends with </i>)
                if (line.includes('<i>') && line.includes('</i>')) {
                    console.log('[Webview] Found description line:', JSON.stringify(line));
                    // Extract description text and apply styling
                    // Match any characters before <i>, not just whitespace (to handle tree symbols like │)
                    const descMatch = line.match(/^(.*?)<i>(.*?)<\\/i>$/);
                    console.log('[Webview] Regex match result:', descMatch);
                    if (descMatch) {
                        const [, prefix, descText] = descMatch;
                        console.log('[Webview] Matched - prefix:', JSON.stringify(prefix), 'text:', JSON.stringify(descText));
                        htmlLines.push(\`\${escapeHtml(prefix)}<span class="node-description">\${escapeHtml(descText)}</span>\`);
                        continue;
                    } else {
                        console.log('[Webview] Regex did not match, escaping line as-is');
                    }
                }
                
                // Try new format first: fileName:lineNumber|fullPath
                let match = line.match(/^(.+?)(→|->)\\s*(.+?):(\\d+)\\|([^\\s]+)(.*)$/);
                
                if (match) {
                    // New format with pipe separator
                    const [, prefix, arrow, displayPath, lineNumber, fullPath, suffix] = match;
                    const navigationPath = fullPath.trim();
                    const displayText = displayPath.trim();
                    const clickableLocation = \`<a href="#" class="node-link" data-filepath="\${escapeHtml(navigationPath)}" data-linenumber="\${lineNumber}" title="Navigate to \${escapeHtml(navigationPath)}:\${lineNumber}">\${escapeHtml(displayText)}:\${lineNumber}</a>\`;
                    htmlLines.push(\`\${escapeHtml(prefix)}\${escapeHtml(arrow)} \${clickableLocation}\${escapeHtml(suffix)}\`);
                } else {
                    // Try old format: fullPath:lineNumber
                    match = line.match(/^(.+?)(→|->)\\s*(.+?):(\\d+)(.*)$/);
                    
                    if (match) {
                        const [, prefix, arrow, filePath, lineNumber, suffix] = match;
                        const clickableLocation = \`<a href="#" class="node-link" data-filepath="\${escapeHtml(filePath.trim())}" data-linenumber="\${lineNumber}" title="Click to navigate">\${escapeHtml(filePath)}:\${lineNumber}</a>\`;
                        htmlLines.push(\`\${escapeHtml(prefix)}\${escapeHtml(arrow)} \${clickableLocation}\${escapeHtml(suffix)}\`);
                    } else {
                        htmlLines.push(escapeHtml(line));
                    }
                }
            }
            
            return htmlLines.join('\\n');
        }
    </script>
</body>
</html>`;
    }

    /**
     * Renders the content based on current format
     */
    private renderContent(): string {
        if (!this.currentContent) {
            return `
                <div class="empty-state">
                    <h3>No CodePath Selected</h3>
                    <p>Create or load a CodePath to see the preview.</p>
                </div>
            `;
        }

        if (this.currentFormat === 'mermaid') {
            return `
                <div class="preview-mermaid">
                    <pre><code>${this.escapeHtml(this.currentContent)}</code></pre>
                </div>
            `;
        } else {
            // Convert text content to clickable HTML
            return `
                <div class="preview-text">${this.convertTextToClickableHtml(this.currentContent)}</div>
            `;
        }
    }

    /**
     * Converts text content to HTML with clickable node links
     * Stores full file paths as data attributes for navigation
     * Format: "fileName:lineNumber|fullPath" or "fullPath:lineNumber"
     */
    private convertTextToClickableHtml(text: string): string {
        const lines = text.split('\n');
        const htmlLines: string[] = [];

        for (const line of lines) {
            // Check if line is a description (contains <i> tags)
            if (line.includes('<i>') && line.includes('</i>')) {
                console.log('[WebviewManager Server] Found description line:', JSON.stringify(line));
                // Extract description text and apply styling
                const descMatch = line.match(/^(.*?)<i>(.*?)<\/i>$/);
                console.log('[WebviewManager Server] Regex match:', descMatch);
                if (descMatch) {
                    const [, prefix, descText] = descMatch;
                    console.log('[WebviewManager Server] Matched - prefix:', JSON.stringify(prefix), 'text:', JSON.stringify(descText));
                    htmlLines.push(`${this.escapeHtml(prefix)}<span class="node-description">${this.escapeHtml(descText)}</span>`);
                    continue;
                } else {
                    console.log('[WebviewManager Server] Regex did not match');
                }
            }
            
            // Pattern to match: "anything → location:lineNumber|fullPath (rest)"
            // First try to match the new format with pipe separator
            let match = line.match(/^(.+?)(→|->)\s*(.+?):(\d+)\|([^\s]+)(.*)$/);
            
            if (match) {
                // New format: fileName:lineNumber|fullPath
                const [, prefix, arrow, displayPath, lineNumber, fullPath, suffix] = match;
                
                const navigationPath = fullPath.trim();
                const displayText = displayPath.trim();
                
                // Create a node identifier for context menu operations
                const nodeId = `${navigationPath}:${lineNumber}`;
                
                // Make the location part clickable using <a> tag with node identification
                const clickableLocation = `<a href="#" class="node-link" data-filepath="${this.escapeHtml(navigationPath)}" data-linenumber="${lineNumber}" data-node-id="${this.escapeHtml(nodeId)}" title="单击跳转到 ${this.escapeHtml(navigationPath)}:${lineNumber}；按住 Ctrl 单击保持当前节点">${this.escapeHtml(displayText)}:${lineNumber}</a>`;
                htmlLines.push(`${this.escapeHtml(prefix)}${this.escapeHtml(arrow)} ${clickableLocation}${this.escapeHtml(suffix)}`);
            } else {
                // Try old format: fullPath:lineNumber (backward compatible)
                match = line.match(/^(.+?)(→|->)\s*(.+?):(\d+)(.*)$/);
                
                if (match) {
                    const [, prefix, arrow, filePath, lineNumber, suffix] = match;
                    
                    // Create a node identifier for context menu operations
                    const nodeId = `${filePath.trim()}:${lineNumber}`;
                    
                    // Make the location part clickable using <a> tag with node identification
                    const clickableLocation = `<a href="#" class="node-link" data-filepath="${this.escapeHtml(filePath.trim())}" data-linenumber="${lineNumber}" data-node-id="${this.escapeHtml(nodeId)}" title="单击跳转到 ${this.escapeHtml(filePath)}:${lineNumber}；按住 Ctrl 单击保持当前节点">${this.escapeHtml(filePath)}:${lineNumber}</a>`;
                    htmlLines.push(`${this.escapeHtml(prefix)}${this.escapeHtml(arrow)} ${clickableLocation}${this.escapeHtml(suffix)}`);
                } else {
                    htmlLines.push(this.escapeHtml(line));
                }
            }
        }

        return htmlLines.join('\n');
    }

    /**
     * Escapes HTML characters for safe display
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Generates a nonce for Content Security Policy
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Get optimal view column for preview panel
     * Uses existing second column if available, otherwise creates beside current
     */
    private getOptimalViewColumn(): vscode.ViewColumn {
        // Check if there are already multiple editor groups
        const visibleEditors = vscode.window.visibleTextEditors;
        const editorColumns = new Set(visibleEditors.map(editor => editor.viewColumn).filter(col => col !== undefined));
        
        // If there are already 2 or more columns, use column 2
        if (editorColumns.size >= 2 || editorColumns.has(vscode.ViewColumn.Two)) {
            return vscode.ViewColumn.Two;
        }
        
        // Otherwise, create beside current editor
        return vscode.ViewColumn.Beside;
    }
}
