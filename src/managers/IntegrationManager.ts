import * as vscode from 'vscode';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { PreviewManager } from './PreviewManager';
import { WebviewManager } from './WebviewManager';
import { StatusBarManager } from './StatusBarManager';
import { ConfigurationManager } from './ConfigurationManager';
import { CodePathError } from '../types/errors';
import { Graph, Node } from '../types';
import { INodeManager } from '../interfaces';

/**
 * IntegrationManager coordinates all components and handles end-to-end workflows
 * This is the main orchestrator that ensures all components work together properly
 */
export class IntegrationManager {
    private graphManager: GraphManager;
    private nodeManager: NodeManager;
    private previewManager: PreviewManager;
    private webviewManager: WebviewManager;
    private statusBarManager: StatusBarManager;
    private configManager: ConfigurationManager;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private lastGraphUpdateTime: number = 0;

    constructor(
        graphManager: GraphManager,
        nodeManager: NodeManager,
        previewManager: PreviewManager,
        webviewManager: WebviewManager,
        statusBarManager: StatusBarManager,
        configManager: ConfigurationManager,
        context: vscode.ExtensionContext
    ) {
        this.graphManager = graphManager;
        this.nodeManager = nodeManager;
        this.previewManager = previewManager;
        this.webviewManager = webviewManager;
        this.statusBarManager = statusBarManager;
        this.configManager = configManager;
        this.context = context;

        this.setupIntegration();
    }

    /**
     * Sets up integration between all components
     */
    private setupIntegration(): void {
        // Connect preview manager to webview manager
        this.previewManager.onUpdate((content, format) => {
            this.webviewManager.updateContent(content, format);
        });

        this.previewManager.onError((error) => {
            vscode.window.showErrorMessage(`Preview error: ${error.message}`);
        });

        // Connect webview manager callbacks
        this.webviewManager.setFormatToggleCallback(async () => {
            this.previewManager.toggleFormat();
            // toggleFormat already triggers an update, no need to call updatePreview
        });

        this.webviewManager.setRefreshCallback(async () => {
            console.log('[IntegrationManager] RefreshCallback triggered');
            // Reload graph data from storage before forcing update
            const currentGraph = this.graphManager.getCurrentGraph();
            console.log('[IntegrationManager] Current graph:', currentGraph ? `${currentGraph.id} with ${currentGraph.nodes.size} nodes` : 'null');
            if (currentGraph) {
                const { Graph: GraphModel } = await import('../models/Graph');
                const graphModel = GraphModel.fromJSON(currentGraph);
                console.log('[IntegrationManager] Setting graph in PreviewManager');
                this.previewManager.setGraph(graphModel);
            }
            // Force immediate update for manual refresh
            console.log('[IntegrationManager] Forcing preview update');
            await this.previewManager.forceUpdate();
            console.log('[IntegrationManager] RefreshCallback completed');
        });

        // Connect node lookup callback for intelligent navigation
        this.webviewManager.setGetNodeByLocationCallback((filePath: string, lineNumber: number) => {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                console.log('[IntegrationManager] getNodeByLocationCallback: No current graph');
                return null;
            }

            console.log(`[IntegrationManager] Looking for node at: ${filePath}:${lineNumber}`);
            console.log(`[IntegrationManager] Available nodes:`, Array.from(currentGraph.nodes.values()).map(n => `${n.id}: ${n.filePath}:${n.lineNumber}`));

            // Find node by location - try exact match first
            for (const node of currentGraph.nodes.values()) {
                if (node.filePath === filePath && node.lineNumber === lineNumber) {
                    console.log(`[IntegrationManager] Found exact match: ${node.id} (${node.name})`);
                    return node;
                }
            }

            // Try normalized path comparison (handle different path separators)
            const normalizedSearchPath = filePath.replace(/\\/g, '/').toLowerCase();
            for (const node of currentGraph.nodes.values()) {
                const normalizedNodePath = node.filePath.replace(/\\/g, '/').toLowerCase();
                if (normalizedNodePath === normalizedSearchPath && node.lineNumber === lineNumber) {
                    console.log(`[IntegrationManager] Found normalized match: ${node.id} (${node.name})`);
                    return node;
                }
            }

            console.log('[IntegrationManager] No matching node found');
            return null;
        });

        // Set node manager for location updates
        this.webviewManager.setNodeManager(this.nodeManager);
        
        // Set callback to get current graph
        this.webviewManager.setGetCurrentGraphCallback(() => {
            return this.graphManager.getCurrentGraph();
        });
        
        // Set callback to force preview update (for immediate refresh after validation)
        this.webviewManager.setForcePreviewUpdateCallback(async () => {
            console.log('[IntegrationManager] forcePreviewUpdateCallback called');
            const currentGraph = this.graphManager.getCurrentGraph();
            console.log('[IntegrationManager] Current graph:', currentGraph ? `${currentGraph.id} with ${currentGraph.nodes.size} nodes` : 'null');
            if (currentGraph) {
                // Log node line numbers and warnings to verify data
                const nodes = Array.from(currentGraph.nodes.values());
                console.log('[IntegrationManager] Node line numbers:', nodes.map((n: any) => `${n.name}:${n.lineNumber}`).join(', '));
                console.log('[IntegrationManager] Node warnings:', nodes.map((n: any) => `${n.name}:${n.validationWarning || 'none'}`).join(', '));
                
                const { Graph: GraphModel } = await import('../models/Graph');
                const graphModel = GraphModel.fromJSON(currentGraph);
                console.log('[IntegrationManager] Setting graph in PreviewManager');
                
                // Clear current graph first to force setGraph to accept the new one
                this.previewManager.setGraph(null);
                this.previewManager.setGraph(graphModel);
                
                console.log('[IntegrationManager] Calling forceUpdate');
                await this.previewManager.forceUpdate();
                console.log('[IntegrationManager] forceUpdate completed');
            }
        });

        // Connect node switch callback for automatic node switching on click
        this.webviewManager.setNodeSwitchCallback(async (nodeId: string) => {
            try {
                console.log(`[IntegrationManager] Node switch callback called for: ${nodeId}`);
                
                // Set as current node and wait for save to complete
                await this.nodeManager.setCurrentNode(nodeId);
                console.log(`[IntegrationManager] Current node set to: ${nodeId}`);

                // Reload the graph to get the updated currentNodeId
                const currentGraph = this.graphManager.getCurrentGraph();
                if (currentGraph) {
                    console.log(`[IntegrationManager] Current graph currentNodeId: ${currentGraph.currentNodeId}`);
                    
                    // Convert to Graph model and set in preview manager
                    const { Graph: GraphModel } = await import('../models/Graph');
                    const graphModel = GraphModel.fromJSON(currentGraph);
                    this.previewManager.setGraph(graphModel);
                    console.log(`[IntegrationManager] Graph set in preview manager`);
                }

                // Force immediate preview update (bypass debouncing and caching)
                await this.previewManager.forceUpdate();
                console.log(`[IntegrationManager] Preview force updated`);

                // Update status bar and context
                this.updateStatusBar();
                this.updateVSCodeContext();
                console.log(`[IntegrationManager] Status bar and context updated`);
            } catch (error) {
                console.error('[IntegrationManager] Failed to switch node:', error);
            }
        });

        // Connect delete current node callback
        this.webviewManager.setDeleteCurrentNodeCallback(async () => {
            try {
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph || !currentGraph.currentNodeId) {
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
                    await this.updatePreview();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`删除节点失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Connect delete current node with children callback
        this.webviewManager.setDeleteCurrentNodeWithChildrenCallback(async () => {
            try {
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph || !currentGraph.currentNodeId) {
                    vscode.window.showWarningMessage('No current node selected');
                    return;
                }

                const currentNode = currentGraph.nodes.get(currentGraph.currentNodeId);
                if (!currentNode) {
                    vscode.window.showWarningMessage('Current node not found');
                    return;
                }

                // Count descendants
                const { Graph: GraphModel } = await import('../models/Graph');
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
                    await this.updatePreview();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`删除节点失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Connect export graph callback
        this.webviewManager.setExportGraphCallback(async () => {
            try {
                await vscode.commands.executeCommand('codepath.exportGraph');
            } catch (error) {
                vscode.window.showErrorMessage(`导出 CodePath 失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Connect update current node callback
        this.webviewManager.setUpdateCurrentNodeCallback(async (updates: any) => {
            try {
                console.log('[IntegrationManager] Received update request:', JSON.stringify(updates));
                
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph || !currentGraph.currentNodeId) {
                    vscode.window.showWarningMessage('No current node selected');
                    return;
                }

                const currentNodeId = currentGraph.currentNodeId;
                console.log('[IntegrationManager] Current node ID:', currentNodeId);
                console.log('[IntegrationManager] Calling nodeManager.updateNode');
                
                await this.nodeManager.updateNode(currentNodeId, updates);
                
                console.log('[IntegrationManager] Node updated successfully');
                
                // Re-validate the node after update to clear/update warning
                // Get the fresh graph data after the first update
                const freshGraph = this.graphManager.getCurrentGraph();
                if (freshGraph && freshGraph.currentNodeId) {
                    const updatedNode = freshGraph.nodes.get(freshGraph.currentNodeId);
                    if (updatedNode) {
                        console.log('[IntegrationManager] Re-validating node after update');
                        console.log('[IntegrationManager] Updated node data:', {
                            lineNumber: updatedNode.lineNumber,
                            codeSnippet: updatedNode.codeSnippet?.substring(0, 50)
                        });
                        
                        const validation = await this.nodeManager.getLocationTracker().validateLocation(updatedNode);
                        console.log('[IntegrationManager] Validation result:', {
                            isValid: validation.isValid,
                            confidence: validation.confidence,
                            reason: validation.reason
                        });
                        
                        if (validation.isValid) {
                            // Clear warning if validation passes
                            await this.nodeManager.updateNode(currentNodeId, {
                                validationWarning: undefined
                            });
                            console.log('[IntegrationManager] Validation passed, warning cleared');
                        } else {
                            // Update warning if validation fails
                            await this.nodeManager.updateNode(currentNodeId, {
                                validationWarning: validation.reason
                            });
                            console.log('[IntegrationManager] Validation failed, warning updated:', validation.reason);
                        }
                    }
                }
                
                vscode.window.showInformationMessage('节点已更新');
                
                console.log('[IntegrationManager] Calling updatePreview');
                await this.updatePreview();
                console.log('[IntegrationManager] Preview updated');
            } catch (error) {
                console.error('[IntegrationManager] Update failed:', error);
                vscode.window.showErrorMessage(`更新节点失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Setup auto-save if enabled
        this.setupAutoSave();

        // Setup status bar updates
        this.setupStatusBarUpdates();
    }

    /**
     * Complete node creation workflow with validation and error handling
     */
    public async createNodeWorkflow(selectedText: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            if (!filePath) {
                throw CodePathError.userError('No active file found');
            }

            // If no text is selected, try to use the current line
            let nodeName = selectedText;
            if (!selectedText || selectedText.trim().length === 0) {
                try {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                    if (lineNumber <= document.lineCount) {
                        const lineText = document.lineAt(lineNumber - 1).text.trim();
                        if (lineText.length > 0) {
                            nodeName = lineText;
                            // Extract a meaningful name (first 50 chars or until special char)
                            const match = lineText.match(/^[\w\s]+/);
                            if (match) {
                                nodeName = match[0].trim().substring(0, 50);
                            } else {
                                nodeName = lineText.substring(0, 50);
                            }
                        } else {
                            throw CodePathError.userError('Please select code text first or position cursor on a non-empty line');
                        }
                    } else {
                        throw CodePathError.userError('Please select code text first');
                    }
                } catch (error) {
                    if (error instanceof CodePathError) {
                        throw error;
                    }
                    throw CodePathError.userError('Please select code text first');
                }
            }

            // Ensure we have a current graph
            let currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                currentGraph = await this.graphManager.createGraph();
                vscode.window.showInformationMessage(`Created new graph: ${currentGraph.name}`);
            }

            // Create the node (createNode will read the full line automatically)
            const node = await this.nodeManager.createNode(
                nodeName.trim(),
                filePath,
                lineNumber,
                selectedText || undefined  // Pass undefined if no selection
            );

            // Set as current node
            await this.nodeManager.setCurrentNode(node.id);

            // Update all connected components
            await this.updateAllComponents();

            // Auto-open preview panel if not already open
            await this.ensurePreviewVisible();

            // Trigger debounced auto-save if enabled
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            vscode.window.showInformationMessage(`Created node: ${node.name}`);
            return node;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create node: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete child node creation workflow
     */
    public async createChildNodeWorkflow(selectedText: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            // Validate current node exists
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw CodePathError.userError('No current node selected. Please create or select a node first.');
            }

            // Validate input
            if (!selectedText || selectedText.trim().length === 0) {
                throw CodePathError.userError('Please select code text first');
            }

            // Create child node
            const childNode = await this.nodeManager.createChildNode(
                currentNode.id,
                selectedText.trim(),
                filePath,
                lineNumber
            );

            // Set as current node
            await this.nodeManager.setCurrentNode(childNode.id);

            // Update all connected components
            await this.updateAllComponents();

            // Auto-open preview panel if not already open
            await this.ensurePreviewVisible();

            // Trigger debounced auto-save if enabled
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            vscode.window.showInformationMessage(`Created child node: ${childNode.name}`);
            return childNode;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create child node: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete parent node creation workflow
     */
    public async createParentNodeWorkflow(selectedText: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            // Get current graph first for debugging
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw CodePathError.userError('No active graph found. Please create a graph first.');
            }

            console.log(`[IntegrationManager] Current graph has ${currentGraph.nodes.size} nodes`);
            console.log(`[IntegrationManager] Current graph ID: ${currentGraph.id}`);
            console.log(`[IntegrationManager] Current node ID in graph: ${currentGraph.currentNodeId}`);
            console.log(`[IntegrationManager] Available node IDs: ${Array.from(currentGraph.nodes.keys()).join(', ')}`);

            // Validate current node exists
            const currentNode = this.nodeManager.getCurrentNode();
            console.log(`[IntegrationManager] getCurrentNode() returned: ${currentNode ? currentNode.id : 'null'}`);
            
            if (!currentNode) {
                throw CodePathError.userError('No current node selected. Please create or select a node first.');
            }

            // Validate input
            if (!selectedText || selectedText.trim().length === 0) {
                throw CodePathError.userError('Please select code text first');
            }

            // Verify the current node still exists in the graph (in case of data corruption)
            if (!currentGraph.nodes.has(currentNode.id)) {
                console.error(`[IntegrationManager] Current node ${currentNode.id} not found in graph!`);
                console.error(`[IntegrationManager] This indicates the graph data is out of sync`);
                
                // Try to repair the graph
                const GraphModel = require('../models/Graph').Graph;
                const graphModel = GraphModel.fromJSON(currentGraph);
                await this.graphManager.saveGraph(graphModel.toJSON());
                
                throw CodePathError.userError('Current node is no longer valid. The graph has been repaired. Please select a node and try again.');
            }

            // Create parent node
            const parentNode = await this.nodeManager.createParentNode(
                currentNode.id,
                selectedText.trim(),
                filePath,
                lineNumber
            );

            // Set as current node
            await this.nodeManager.setCurrentNode(parentNode.id);

            // Update all connected components
            await this.updateAllComponents();

            // Auto-open preview panel if not already open
            await this.ensurePreviewVisible();

            // Trigger debounced auto-save if enabled
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            vscode.window.showInformationMessage(`Created parent node: ${parentNode.name}`);
            return parentNode;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create parent node: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete node switching workflow
     */
    public async switchNodeWorkflow(nodeId: string): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw CodePathError.userError('No active graph found');
            }

            const targetNode = currentGraph.nodes.get(nodeId);
            if (!targetNode) {
                throw CodePathError.userError(`Node with ID ${nodeId} not found`);
            }

            // Set as current node
            await this.nodeManager.setCurrentNode(nodeId);

            // Navigate to the node's location
            await this.navigateToNode(targetNode);

            // Update all connected components
            await this.updateAllComponents();

            vscode.window.showInformationMessage(`Switched to node: ${targetNode.name}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to switch node: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete graph switching workflow
     */
    public async switchGraphWorkflow(graphId: string): Promise<void> {
        try {
            // Load the graph (validation happens automatically in loadGraph)
            const graph = await this.graphManager.loadGraph(graphId);
            
            // Update all connected components
            await this.updateAllComponents();

            vscode.window.showInformationMessage(`Switched to graph: ${graph.name}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to switch graph: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Show preview panel
     */
    public async showPreview(): Promise<void> {
        try {
            const wasAlreadyVisible = this.webviewManager.isVisible();
            await this.webviewManager.showPreview();
            
            // Only force update if panel was just created
            if (!wasAlreadyVisible) {
                await this.previewManager.forceUpdate();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to show preview: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Update preview content
     */
    public async updatePreview(): Promise<void> {
        try {
            // Set current graph in preview manager
            const currentGraph = this.graphManager.getCurrentGraph();
            
            // Check if graph has actually changed to avoid unnecessary updates
            const currentUpdateTime = currentGraph?.updatedAt?.getTime() || 0;
            if (currentUpdateTime === this.lastGraphUpdateTime && currentGraph) {
                // Graph hasn't changed, skip update
                return;
            }
            this.lastGraphUpdateTime = currentUpdateTime;
            
            if (currentGraph) {
                // Convert to Graph model for preview manager
                const { Graph: GraphModel } = await import('../models/Graph');
                const graphModel = GraphModel.fromJSON(currentGraph);
                // setGraph will automatically schedule an update with debouncing
                this.previewManager.setGraph(graphModel);
            } else {
                this.previewManager.setGraph(null);
            }
        } catch (error) {
            console.error('Failed to update preview:', error);
        }
    }

    /**
     * Ensures preview panel is visible (auto-opens if not already open)
     */
    private async ensurePreviewVisible(): Promise<void> {
        try {
            await this.webviewManager.showPreview();
        } catch (error) {
            console.error('Failed to ensure preview visible:', error);
        }
    }

    /**
     * Update all connected components
     */
    private async updateAllComponents(): Promise<void> {
        // Update preview
        await this.updatePreview();

        // Update status bar
        this.updateStatusBar();

        // Update VS Code context
        this.updateVSCodeContext();
    }

    /**
     * Update status bar with current state
     */
    private updateStatusBar(): void {
        const currentGraph = this.graphManager.getCurrentGraph();
        const currentNode = this.nodeManager.getCurrentNode();
        
        this.statusBarManager.updateGraphInfo(
            currentGraph?.name || null,
            currentGraph?.nodes.size || 0
        );

        this.statusBarManager.updateCurrentNode(
            currentNode?.name || null
        );

        const previewStatus = this.previewManager.getStatus();
        this.statusBarManager.updatePreviewStatus(
            previewStatus.isUpdating ? 'updating' : 'ready'
        );
    }

    /**
     * Update VS Code context for conditional menu items
     */
    private updateVSCodeContext(): void {
        const hasCurrentNode = this.nodeManager.getCurrentNode() !== null;
        const hasCurrentGraph = this.graphManager.getCurrentGraph() !== null;
        
        vscode.commands.executeCommand('setContext', 'codepath.hasCurrentNode', hasCurrentNode);
        vscode.commands.executeCommand('setContext', 'codepath.hasCurrentGraph', hasCurrentGraph);
    }

    /**
     * Navigate to a specific node's location in the editor
     */
    private async navigateToNode(node: Node): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(node.filePath);
            const editor = await vscode.window.showTextDocument(document);
            
            // Navigate to the line
            const position = new vscode.Position(node.lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
        } catch (error) {
            vscode.window.showWarningMessage(`Could not navigate to ${node.filePath}:${node.lineNumber}`);
        }
    }

    /**
     * Setup auto-save functionality
     */
    private setupAutoSave(): void {
        const config = this.configManager.getConfiguration();
        if (!config.autoSave) {
            return;
        }

        // Auto-save on graph changes with debouncing
        let saveTimeout: NodeJS.Timeout | null = null;
        const debouncedSave = () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(async () => {
                await this.autoSaveIfEnabled();
            }, 2000); // 2 second debounce
        };

        // Set up periodic auto-save as backup
        const autoSaveInterval = setInterval(async () => {
            await this.autoSaveIfEnabled();
        }, 300000); // 5 minutes

        this.disposables.push({
            dispose: () => {
                if (saveTimeout) {
                    clearTimeout(saveTimeout);
                }
                clearInterval(autoSaveInterval);
            }
        });

        // Store the debounced save function for use in workflows
        (this as any).debouncedSave = debouncedSave;
    }

    /**
     * Auto-save current graph if enabled
     */
    private async autoSaveIfEnabled(): Promise<void> {
        try {
            const config = this.configManager.getConfiguration();
            if (!config.autoSave) {
                return;
            }

            const currentGraph = this.graphManager.getCurrentGraph();
            if (currentGraph) {
                await this.graphManager.saveGraph(currentGraph);
            }
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }

    /**
     * Setup status bar updates
     */
    private setupStatusBarUpdates(): void {
        // Initial update
        this.updateStatusBar();

        // Show status bar
        this.statusBarManager.show();
    }

    /**
     * Toggle preview format
     */
    public async togglePreviewFormat(): Promise<void> {
        try {
            const newFormat = this.previewManager.toggleFormat();
            // toggleFormat already triggers an update, no need to call updatePreview
            vscode.window.showInformationMessage(`Preview format changed to: ${newFormat}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to toggle preview format: ${errorMessage}`);
        }
    }

    /**
     * Get current extension state for debugging
     */
    public getState(): {
        hasGraph: boolean;
        hasCurrentNode: boolean;
        nodeCount: number;
        previewFormat: string;
        isPreviewUpdating: boolean;
    } {
        const currentGraph = this.graphManager.getCurrentGraph();
        const currentNode = this.nodeManager.getCurrentNode();
        const previewStatus = this.previewManager.getStatus();

        return {
            hasGraph: currentGraph !== null,
            hasCurrentNode: currentNode !== null,
            nodeCount: currentGraph?.nodes.size || 0,
            previewFormat: previewStatus.format,
            isPreviewUpdating: previewStatus.isUpdating
        };
    }

    /**
     * Get the node manager instance
     */
    public getNodeManager(): INodeManager {
        return this.nodeManager;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.nodeManager.dispose();
    }
}