import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { IWebviewManager, WebviewConfig } from '../interfaces/IWebviewManager';
import { ViewFormat } from '../types';
import { LocationTracker } from './LocationTracker';
import { INodeManager } from '../interfaces/INodeManager';

/**
 * WebviewManager handles VS Code webview panels for CodePath preview display
 * Implements split-screen layout with code and preview, toolbar with format toggle
 *
 * 统一管理所有 Webview 面板的创建、展示与销毁，并负责和预览面板之间的消息通信、格式切换等交互行为。
 */
export class WebviewManager implements IWebviewManager {
    private panel: vscode.WebviewPanel | null = null;
    private view: vscode.WebviewView | null = null;
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

        // 优先复用已有的分栏以减少面板闪烁，从而在多编辑器场景下保持布局稳定
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
        this.setupMessageHandling(this.panel.webview);

        // Set up disposal handling
        this.panel.onDidDispose(() => {
            if (this.panel) {
                this.panel = null;
            }
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

    /**
     * Attaches the manager to a sidebar webview view
     */
    public attachView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        this.view.webview.options = {
            enableScripts: this.config.enableScripts,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        };

        this.setupMessageHandling(webviewView.webview);

        webviewView.onDidDispose(() => {
            if (this.view === webviewView) {
                this.view = null;
            }
        });

        const html = this.generateWebviewHtml(webviewView.webview);
        webviewView.webview.html = html;
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

        // 检查内容是否真的发生变化（除非是强制更新）
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
        console.log('[WebviewManager] Panel exists:', !!this.panel, 'visible:', this.panel?.visible, 'active:', this.panel?.active, 'View exists:', !!this.view);
        this.currentContent = content;
        this.currentFormat = format;
        this.lastUpdateTime = Date.now();

        const message = {
            command: 'updateContent',
            content,
            format
        };

        if (this.panel) {
            console.log('[WebviewManager] Posting message to panel webview');
            const result = this.panel.webview.postMessage(message);
            console.log('[WebviewManager] Panel postMessage result:', result);
        } else {
            console.log('[WebviewManager] Panel does not exist!');
        }

        if (this.view) {
            console.log('[WebviewManager] Posting message to sidebar webview');
            this.view.webview.postMessage(message);
        } else {
            console.log('[WebviewManager] Sidebar view does not exist or not resolved yet');
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
     *
     * 批量校验图节点在源码中的位置是否仍然有效，并在发生偏移时同步更新行号等信息。
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
            vscode.window.showInformationMessage(`鉁?All ${validCount} nodes are valid`);
            return;
        }
        
        // Build detailed message
        const messages: string[] = [];
        
        if (validCount > 0) {
            messages.push(`鉁?${validCount} valid`);
        }
        
        if (updatedCount > 0) {
            messages.push(`馃攧 ${updatedCount} updated`);
            const updatedNodes = results.filter(r => r.result === 'updated');
            for (const node of updatedNodes.slice(0, 3)) { // Show first 3
                messages.push(`  鈥?${node.nodeName}: line ${node.oldLine} 鈫?${node.newLine}`);
            }
            if (updatedNodes.length > 3) {
                messages.push(`  鈥?... and ${updatedNodes.length - 3} more`);
            }
        }
        
        if (warningCount > 0) {
            messages.push(`鈿狅笍 ${warningCount} warnings`);
            const warningNodes = results.filter(r => r.result === 'warning');
            for (const node of warningNodes.slice(0, 3)) { // Show first 3
                messages.push(`  鈥?${node.nodeName}: ${node.message}`);
            }
            if (warningNodes.length > 3) {
                messages.push(`  鈥?... and ${warningNodes.length - 3} more`);
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
        const panelVisible = this.panel !== null && this.panel.visible;
        const viewVisible = this.view !== null && this.view.visible;
        return panelVisible || viewVisible;
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

            // 妫€鏌ユ槸鍚︿负鐩綍锛岀洰褰曟棤娉曠洿鎺ユ墦寮€鏂囦欢
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
                            `鈿狅笍 ${result.message}. You can edit the node to update its location.`,
                            'Edit Node',
                            'Dismiss'
                        );
                        
                        // If user clicks Edit Node, open the edit panel
                        if (choice === 'Edit Node') {
                            this.postMessageToAll({ command: 'requestCurrentNodeData' });
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
    private setupMessageHandling(webview: vscode.Webview): void {
        // 通过集中式消息分发，将 Webview 的前端事件映射到扩展后端的具体执行逻辑，避免前端直接访问内部管理器
        webview.onDidReceiveMessage(
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
                        await this.sendCurrentNodeData(webview);
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
                },
                {
                    label: '⚙️ 打开设置',
                    description: 'Open configuration settings',
                    detail: 'Adjust CodePath preferences in VS Code settings'
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
                    `请选择操作 (节点: ${actualNode?.name || 'Unknown'})` : 
                    '请选择操作 (Select Action)',
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
                case '打开设置':
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'codepath');
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
    private async sendCurrentNodeData(target?: vscode.Webview): Promise<void> {
        if (!this.getCurrentGraphCallback) {
            return;
        }

        const destination = target ?? this.panel?.webview ?? this.view?.webview;
        if (!destination) {
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

        destination.postMessage({
            command: 'showEditPanel',
            nodeData: {
                name: currentNode.name,
                lineNumber: currentNode.lineNumber,
                codeSnippet: currentNode.codeSnippet,
                description: currentNode.description
            }
        });
    }

    private postMessageToAll(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
        if (this.view) {
            this.view.webview.postMessage(message);
        }
    }

    /**
     * Updates the webview HTML content
     */
    private async updateWebviewContent(): Promise<void> {
        if (!this.panel) { return; }

        const html = this.generateWebviewHtml(this.panel.webview);
        this.panel.webview.html = html;
    }

    /**
     * Generates the HTML content for the webview
     */
    private generateWebviewHtml(webview: vscode.Webview): string {
        const nonce = this.getNonce();
        const templateUri = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.html');
        let html = readFileSync(templateUri.fsPath, 'utf8');

        html = html.replace(/{{nonce}}/g, nonce);
        html = html.replace(/{{cspSource}}/g, webview.cspSource);
        html = html.replace('{{content}}', this.renderContent());

        return html;
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
     *
     * 将纯文本渲染结果转换为带有跳转能力的超链接行，保留完整路径以保证跨工作区导航的准确性。
     */
    private convertTextToClickableHtml(text: string): string {
        const lines = text.split('\n');
        const htmlLines: string[] = [];

        for (const rawLine of lines) {
            const line = rawLine ?? '';

            if (line.includes('<i>') && line.includes('</i>')) {
                const descMatch = line.match(/^(.*?)<i>(.*?)<\/i>$/);
                if (descMatch) {
                    const [, prefix, descText] = descMatch;
                    htmlLines.push(`${this.escapeHtml(prefix)}<span class="node-description">${this.escapeHtml(descText)}</span>`);
                    continue;
                }
            }

            let match = line.match(/^(.+?)(→|->)\s*(.+?):(\d+)\|([^\s]+)(.*)$/);
            if (match) {
                const [, prefix, arrow, displayPath, lineNumber, fullPath, suffix] = match;
                const navigationPath = fullPath.trim();
                const label = this.getDisplayLabel(displayPath.trim(), navigationPath);
                const nodeId = `${navigationPath}:${lineNumber}`;
                const clickableLocation = `<a href="#" class="node-link" data-filepath="${this.escapeHtml(navigationPath)}" data-linenumber="${lineNumber}" data-node-id="${this.escapeHtml(nodeId)}" title="单击跳转到${this.escapeHtml(navigationPath)}:${lineNumber}；按下Ctrl 单击保持当前节点">${this.escapeHtml(label)}:${lineNumber}</a>`;
                htmlLines.push(`${this.escapeHtml(prefix)}${this.escapeHtml(arrow)} ${clickableLocation}${this.escapeHtml(suffix)}`);
                continue;
            }

            match = line.match(/^(.+?)(→|->)\s*(.+?):(\d+)(.*)$/);
            if (match) {
                const [, prefix, arrow, filePath, lineNumber, suffix] = match;
                const navigationPath = filePath.trim();
                const label = this.getDisplayLabel(filePath.trim(), navigationPath);
                const nodeId = `${navigationPath}:${lineNumber}`;
                const clickableLocation = `<a href="#" class="node-link" data-filepath="${this.escapeHtml(navigationPath)}" data-linenumber="${lineNumber}" data-node-id="${this.escapeHtml(nodeId)}" title="单击跳转到${this.escapeHtml(navigationPath)}:${lineNumber}；按下Ctrl 单击保持当前节点">${this.escapeHtml(label)}:${lineNumber}</a>`;
                htmlLines.push(`${this.escapeHtml(prefix)}${this.escapeHtml(arrow)} ${clickableLocation}${this.escapeHtml(suffix)}`);
                continue;
            }

            htmlLines.push(this.escapeHtml(this.stripFullPathSegment(line)));
        }

        return htmlLines.join('\n');
    }

    private getDisplayLabel(displayPath: string, fullPath: string): string {
        const trimmed = displayPath.trim();
        if (trimmed && !/[\\/]/.test(trimmed)) {
            return trimmed;
        }

        const normalized = fullPath.replace(/\\/g, '/').replace(/\/+$/g, '');
        if (!normalized) {
            return trimmed || fullPath;
        }

        const segments = normalized.split('/');
        const lastSegment = segments[segments.length - 1] || normalized;
        return lastSegment || trimmed || fullPath;
    }

    private stripFullPathSegment(line: string): string {
        return line.replace(/\|[^\s)]+/g, '');
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
