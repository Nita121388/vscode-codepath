import * as vscode from 'vscode';
import { GraphManager } from './GraphManager';
import { NodeManager } from './NodeManager';
import { PreviewManager } from './PreviewManager';
import { WebviewManager } from './WebviewManager';
import { StatusBarManager } from './StatusBarManager';
import { ConfigurationManager } from './ConfigurationManager';
import { ClipboardManager } from './ClipboardManager';
import { NodeOrderManager } from './NodeOrderManager';
import { FeedbackManager } from './FeedbackManager';
import { MultipleContextManager } from './MultipleContextManager';
import { StorageManager } from './StorageManager';
import { BasketHistoryManager } from './BasketHistoryManager';
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
    private clipboardManager: ClipboardManager;
    private nodeOrderManager: NodeOrderManager;
    private feedbackManager: FeedbackManager;
    private multipleContextManager: MultipleContextManager;
    private basketHistoryManager: BasketHistoryManager;
    private storageManager: StorageManager;
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
        context: vscode.ExtensionContext,
        storageManager?: StorageManager
    ) {
        this.graphManager = graphManager;
        this.nodeManager = nodeManager;
        this.previewManager = previewManager;
        this.webviewManager = webviewManager;
        this.statusBarManager = statusBarManager;
        this.configManager = configManager;
        this.context = context;

        // Initialize new managers
        this.clipboardManager = new ClipboardManager(nodeManager, graphManager);
        this.nodeOrderManager = new NodeOrderManager(nodeManager, graphManager);
        this.feedbackManager = new FeedbackManager();

        // Initialize MultipleContextManager
        this.storageManager = storageManager || new StorageManager();
        this.basketHistoryManager = new BasketHistoryManager(this.storageManager);
        this.multipleContextManager = new MultipleContextManager(
            this.storageManager,
            undefined,
            this.basketHistoryManager
        );

        this.setupIntegration();
    }

    /**
     * 安全调用 VS Code 信息提示，避免在测试环境或 API 缺失时抛出异常
     */
    private safeShowInformationMessage(message: string, ...items: any[]): void {
        if (typeof vscode.window.showInformationMessage === 'function') {
            vscode.window.showInformationMessage(message, ...items);
        } else {
            console.warn(`[IntegrationManager] VS Code API 缺少 showInformationMessage，消息：${message}`);
        }
    }

    /**
     * 安全调用 VS Code 警告提示
     */
    private async safeShowWarningMessage(message: string, ...items: any[]): Promise<string | undefined> {
        if (typeof vscode.window.showWarningMessage === 'function') {
            return vscode.window.showWarningMessage(message, ...items);
        }
        console.warn(`[IntegrationManager] VS Code API 缺少 showWarningMessage，消息：${message}`);
        return undefined;
    }

    /**
     * 安全调用 VS Code 错误提示
     */
    private safeShowErrorMessage(message: string, ...items: any[]): void {
        if (typeof vscode.window.showErrorMessage === 'function') {
            vscode.window.showErrorMessage(message, ...items);
        } else {
            console.warn(`[IntegrationManager] VS Code API 缺少 showErrorMessage，消息：${message}`);
        }
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
            this.feedbackManager.handleError('预览渲染', error, 'PreviewManager');
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
                const { Graph } = await import('../models/Graph');
                const graphModel = Graph.fromJSON(currentGraph);
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
                
                const { Graph } = await import('../models/Graph');
                const graphModel = Graph.fromJSON(currentGraph);
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
                let currentGraph = this.graphManager.getCurrentGraph();
                if (currentGraph) {
                    console.log(`[IntegrationManager] Current graph currentNodeId: ${currentGraph.currentNodeId}`);
                    
                    const switchedNode = currentGraph.nodes.get(nodeId);
                    if (switchedNode) {
                        try {
                            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(switchedNode.filePath));
                            if ((stat.type & vscode.FileType.Directory) !== 0 && switchedNode.validationWarning) {
                                console.log('[IntegrationManager] Clearing validation warning for directory node:', switchedNode.name);
                                await this.nodeManager.updateNode(nodeId, { validationWarning: undefined });
                                currentGraph = this.graphManager.getCurrentGraph() || currentGraph;
                            }
                        } catch (error) {
                            console.warn('[IntegrationManager] Failed to stat node path during switch:', error);
                        }
                    }
                    
                    // Convert to Graph model and set in preview manager
                    const { Graph } = await import('../models/Graph');
                    const graphModel = Graph.fromJSON(currentGraph);
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
                    void this.safeShowWarningMessage('No current node selected');
                    return;
                }

                const currentNode = currentGraph.nodes.get(currentGraph.currentNodeId);
                if (!currentNode) {
                    void this.safeShowWarningMessage('Current node not found');
                    return;
                }

                const confirmation = await this.safeShowWarningMessage(
                    `确定要删除节点 "${currentNode.name}" 吗？子节点将被保留并重新连接到父节点。`,
                    { modal: true },
                    '删除'
                );

                if (confirmation === '删除') {
                    await this.nodeManager.deleteNode(currentGraph.currentNodeId);
                    this.feedbackManager.showSuccess(`已删除节点: ${currentNode.name}`);
                    await this.updatePreview();
                }
            } catch (error) {
                this.feedbackManager.handleError('删除节点', error, 'IntegrationManager');
            }
        });

        // Connect delete current node with children callback
        this.webviewManager.setDeleteCurrentNodeWithChildrenCallback(async () => {
            try {
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph || !currentGraph.currentNodeId) {
                    void this.safeShowWarningMessage('No current node selected');
                    return;
                }

                const currentNode = currentGraph.nodes.get(currentGraph.currentNodeId);
                if (!currentNode) {
                    void this.safeShowWarningMessage('Current node not found');
                    return;
                }

                // Count descendants
                const { Graph } = await import('../models/Graph');
                const graphModel = Graph.fromJSON(currentGraph);
                const descendants = graphModel.getDescendants(currentGraph.currentNodeId);
                const totalToDelete = descendants.length + 1;

                const confirmation = await this.safeShowWarningMessage(
                    `确定要删除节点 "${currentNode.name}" 及其所有 ${descendants.length} 个子节点吗？共 ${totalToDelete} 个节点将被删除。此操作无法撤销。`,
                    { modal: true },
                    '删除'
                );

                if (confirmation === '删除') {
                    await this.nodeManager.deleteNodeWithChildren(currentGraph.currentNodeId);
                    this.feedbackManager.showSuccess(`已删除 ${totalToDelete} 个节点`);
                    await this.updatePreview();
                }
            } catch (error) {
                this.feedbackManager.handleError('删除节点', error, 'IntegrationManager');
            }
        });

        // Connect export graph callback
        this.webviewManager.setExportGraphCallback(async () => {
            try {
                await vscode.commands.executeCommand('codepath.exportGraph');
            } catch (error) {
                this.safeShowErrorMessage(`导出 CodePath 失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Connect update current node callback
        this.webviewManager.setUpdateCurrentNodeCallback(async (updates: any) => {
            try {
                console.log('[IntegrationManager] Received update request:', JSON.stringify(updates));
                
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph || !currentGraph.currentNodeId) {
                    void this.safeShowWarningMessage('No current node selected');
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

            try {
                await this.previewManager.forceUpdate();
            } catch (error) {
                this.feedbackManager.handleError('预览刷新', error, 'IntegrationManager');
            }

            // Trigger debounced auto-save if enabled
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            this.feedbackManager.showSuccess(`已标记为新节点: ${node.name}`, `文件: ${node.filePath}, 行号: ${node.lineNumber}`);
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

            this.feedbackManager.showSuccess(`已标记为子节点: ${childNode.name}`, `文件: ${childNode.filePath}, 行号: ${childNode.lineNumber}`);
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
                const { Graph } = require('../models/Graph');
                const graphModel = Graph.fromJSON(currentGraph);
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

            this.feedbackManager.showSuccess(`已标记为父节点: ${parentNode.name}`, `文件: ${parentNode.filePath}, 行号: ${parentNode.lineNumber}`);
            return parentNode;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create parent node: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete bro node creation workflow
     * 
     * This method orchestrates the entire process of creating a sibling (bro) node,
     * including validation, node creation, UI updates, and user feedback.
     * 
     * Workflow steps:
     * 1. Validate prerequisites (current node exists, text selected)
     * 2. Create the sibling node using NodeManager
     * 3. Set the new node as current
     * 4. Update all UI components (preview, status bar, context)
     * 5. Auto-open preview panel if needed
     * 6. Trigger auto-save if configured
     * 7. Show success message to user
     * 
     * @param selectedText - The selected code text to use as node name/content
     * @param filePath - The file path where the code is located
     * @param lineNumber - The line number in the file (1-based)
     * @returns Promise<Node> - The newly created sibling node
     * @throws CodePathError for user-facing errors, Error for system errors
     */
    public async createBroNodeWorkflow(selectedText: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            // Step 1: Validate prerequisites
            // Ensure we have a current node to create a sibling for
            const currentNode = this.nodeManager.getCurrentNode();
            if (!currentNode) {
                throw CodePathError.userError('没有选择当前节点。请先创建或选择一个节点。');
            }

            // Validate that user has selected meaningful text
            if (!selectedText || selectedText.trim().length === 0) {
                throw CodePathError.userError('请先选择代码文本');
            }

            // Step 2: Create the sibling node
            // Delegate to NodeManager for the actual node creation logic
            const broNode = await this.nodeManager.createBroNode(
                selectedText.trim(), // Clean up whitespace from selection
                filePath,
                lineNumber
            );

            // Step 3: Update current node reference
            // Set the newly created sibling as the active node
            await this.nodeManager.setCurrentNode(broNode.id);

            // Step 4: Update all connected UI components
            // Ensure preview, status bar, and VS Code context are synchronized
            await this.updateAllComponents();

            // Step 5: Auto-open preview panel for immediate feedback
            // Show the updated graph structure to the user
            await this.ensurePreviewVisible();

            // Step 6: Trigger auto-save if configured
            // Persist changes automatically if user has enabled auto-save
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            // Step 7: Provide user feedback
            // Show success message with the name of the created node
            vscode.window.showInformationMessage(`已标记为兄弟节点: ${broNode.name}`);
            return broNode;

        } catch (error) {
            // Handle and report errors with appropriate user messaging
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`创建兄弟节点失败: ${errorMessage}`);
            
            // Re-throw to allow caller to handle if needed
            throw error;
        }
    }

    /**
     * Complete clipboard copy workflow
     * Copies the current node and all its children to clipboard
     */
    public async copyNodeWorkflow(nodeId?: string): Promise<void> {
        try {
            // Use provided nodeId or current node
            const targetNodeId = nodeId || this.nodeManager.getCurrentNode()?.id;
            if (!targetNodeId) {
                throw CodePathError.userError('没有选择当前节点。请先创建或选择一个节点。');
            }

            // Perform copy operation
            await this.clipboardManager.copyNode(targetNodeId);

            // Update VS Code context for paste command availability
            this.updateVSCodeContext();

            vscode.window.showInformationMessage('已复制该节点及其子节点');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`复制节点失败: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete clipboard cut workflow
     * Cuts the current node and all its children to clipboard
     */
    public async cutNodeWorkflow(nodeId?: string): Promise<void> {
        try {
            // Use provided nodeId or current node
            const targetNodeId = nodeId || this.nodeManager.getCurrentNode()?.id;
            if (!targetNodeId) {
                throw CodePathError.userError('没有选择当前节点。请先创建或选择一个节点。');
            }

            // Perform cut operation
            await this.clipboardManager.cutNode(targetNodeId);

            // Update VS Code context for paste command availability
            this.updateVSCodeContext();

            vscode.window.showInformationMessage('已剪切该节点及其子节点');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`剪切节点失败: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete clipboard paste workflow
     * Pastes nodes from clipboard as children of current node or as root nodes
     */
    public async pasteNodeWorkflow(parentId?: string): Promise<Node[]> {
        try {
            // Check if clipboard has data
            if (!this.clipboardManager.hasClipboardData()) {
                throw CodePathError.userError('剪贴板为空。请先复制或剪切一个节点。');
            }

            // Use provided parentId or current node as parent
            const targetParentId = parentId || this.nodeManager.getCurrentNode()?.id;

            // Perform paste operation
            const pastedNodes = await this.clipboardManager.pasteNode(targetParentId);

            // Set the first pasted node as current if any were created
            if (pastedNodes.length > 0) {
                await this.nodeManager.setCurrentNode(pastedNodes[0].id);
            }

            // Update all connected components
            await this.updateAllComponents();

            // Auto-open preview panel if not already open
            await this.ensurePreviewVisible();

            // Trigger debounced auto-save if enabled
            if ((this as any).debouncedSave) {
                (this as any).debouncedSave();
            }

            const nodeCount = pastedNodes.length;
            const rootCount = pastedNodes.filter(n => !n.parentId || n.parentId === targetParentId).length;
            vscode.window.showInformationMessage(`已粘贴 ${rootCount} 个节点树（共 ${nodeCount} 个节点）`);

            return pastedNodes;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`粘贴节点失败: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete node move up workflow
     * Moves the current node up in its sibling order
     */
    public async moveNodeUpWorkflow(nodeId?: string): Promise<void> {
        try {
            // Use provided nodeId or current node
            const targetNodeId = nodeId || this.nodeManager.getCurrentNode()?.id;
            if (!targetNodeId) {
                throw CodePathError.userError('没有选择当前节点。请先创建或选择一个节点。');
            }

            // Perform move up operation
            const moved = await this.nodeOrderManager.moveNodeUp(targetNodeId);

            if (moved) {
                // Update all connected components
                await this.updateAllComponents();

                // Trigger debounced auto-save if enabled
                if ((this as any).debouncedSave) {
                    (this as any).debouncedSave();
                }

                vscode.window.showInformationMessage('节点已上移');
            } else {
                vscode.window.showInformationMessage('节点已在最上方');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`移动节点失败: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete node move down workflow
     * Moves the current node down in its sibling order
     */
    public async moveNodeDownWorkflow(nodeId?: string): Promise<void> {
        try {
            // Use provided nodeId or current node
            const targetNodeId = nodeId || this.nodeManager.getCurrentNode()?.id;
            if (!targetNodeId) {
                throw CodePathError.userError('没有选择当前节点。请先创建或选择一个节点。');
            }

            // Perform move down operation
            const moved = await this.nodeOrderManager.moveNodeDown(targetNodeId);

            if (moved) {
                // Update all connected components
                await this.updateAllComponents();

                // Trigger debounced auto-save if enabled
                if ((this as any).debouncedSave) {
                    (this as any).debouncedSave();
                }

                vscode.window.showInformationMessage('节点已下移');
            } else {
                vscode.window.showInformationMessage('节点已在最下方');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`移动节点失败: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Complete file/folder context node creation workflow
     * Creates a node from file explorer context (file or folder selection)
     */
    public async createNodeFromFileContextWorkflow(
        resourceUri: vscode.Uri,
        nodeType: 'new' | 'child' | 'parent' | 'bro' = 'new'
    ): Promise<Node> {
        try {
            if (!resourceUri) {
                throw CodePathError.userError('未选择文件或文件夹');
            }

            // Get file/folder information
            const filePath = resourceUri.fsPath;
            const pathModule = require('path');
            const fileName = pathModule.basename(filePath);

            let stats: vscode.FileStat;
            try {
                stats = await vscode.workspace.fs.stat(resourceUri);
            } catch (fsError) {
                const normalizedError = fsError instanceof Error ? fsError : new Error(String(fsError));
                throw CodePathError.filesystemError(normalizedError.message, normalizedError);
            }
            const isDirectory = (stats.type & vscode.FileType.Directory) !== 0;

            // Use filename/foldername as node name
            const lineNumber = isDirectory ? 1 : 1; // Default to line 1 for folders and files

            // Create node based on type
            let node: Node;
            switch (nodeType) {
                case 'new':
                    node = await this.createNodeWorkflow(fileName, filePath, lineNumber);
                    break;
                case 'child':
                    node = await this.createChildNodeWorkflow(fileName, filePath, lineNumber);
                    break;
                case 'parent':
                    node = await this.createParentNodeWorkflow(fileName, filePath, lineNumber);
                    break;
                case 'bro':
                    node = await this.createBroNodeWorkflow(fileName, filePath, lineNumber);
                    break;
                default:
                    throw CodePathError.userError(`不支持的节点类型: ${nodeType}`);
            }

            return node;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`从文件创建节点失败: ${errorMessage}`);
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

            try {
                await this.previewManager.forceUpdate();
            } catch (error) {
                this.feedbackManager.handleError('预览刷新', error, 'IntegrationManager');
            }

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
                const { Graph } = await import('../models/Graph');
                const graphModel = Graph.fromJSON(currentGraph);
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
     * 强制刷新预览，并在需要时打开预览面板
     */
    public async refreshPreviewAndReveal(): Promise<void> {
        try {
            const wasVisible = this.webviewManager.isVisible();
            this.lastGraphUpdateTime = 0;
            await this.updatePreview();
            await this.previewManager.forceUpdate();

            if (!wasVisible) {
                await this.webviewManager.showPreview();
            }
        } catch (error) {
            console.error('Failed to refresh preview and reveal panel:', error);
            throw error;
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
        try {
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
        } catch (error) {
            console.error('Failed to update status bar:', error);
            // Don't throw - status bar updates should not interrupt main functionality
        }
    }

    /**
     * Update VS Code context for conditional menu items
     */
    private updateVSCodeContext(): void {
        const hasCurrentNode = this.nodeManager.getCurrentNode() !== null;
        const hasCurrentGraph = this.graphManager.getCurrentGraph() !== null;
        const hasClipboardNode = this.clipboardManager.hasClipboardData();

        const executeSafely = (key: string, value: unknown) => {
            try {
                const result = vscode.commands.executeCommand('setContext', key, value);
                const maybeThenable = result as { then?: (onFulfilled?: any, onRejected?: any) => any };
                if (maybeThenable && typeof maybeThenable.then === 'function') {
                    maybeThenable.then(undefined, (error: unknown) => {
                        console.warn(`[IntegrationManager] 更新 VS Code 上下文 ${key} 失败:`, error);
                    });
                }
            } catch (error) {
                console.warn(`[IntegrationManager] 调用 VS Code 命令 ${key} 失败:`, error);
            }
        };
        
        executeSafely('codepath.hasCurrentNode', hasCurrentNode);
        executeSafely('codepath.hasCurrentGraph', hasCurrentGraph);
        executeSafely('codepath.hasClipboardNode', hasClipboardNode);
    }

    /**
     * Navigate to a specific node's location in the editor
     */
    private async navigateToNode(node: Node): Promise<void> {
        try {
            const uri = vscode.Uri.file(node.filePath);
            console.log('[IntegrationManager] navigateToNode start:', {
                path: node.filePath,
                line: node.lineNumber
            });

            const fileStat = await vscode.workspace.fs.stat(uri);

            if ((fileStat.type & vscode.FileType.Directory) !== 0) {
                // 对于目录节点，无法在编辑器中打开，聚焦资源管理器
                console.log('[IntegrationManager] navigateToNode detected directory, revealing in explorer');
                await vscode.commands.executeCommand('revealInExplorer', uri);
                vscode.window.showInformationMessage(`已在资源管理器中定位目录：${node.filePath}`);
                return;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            // Navigate to the line
            const position = new vscode.Position(Math.max(0, node.lineNumber - 1), 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
            console.log('[IntegrationManager] navigateToNode completed navigation');
        } catch (error) {
            console.warn('[IntegrationManager] navigateToNode failed:', {
                path: node.filePath,
                line: node.lineNumber,
                error
            });
            const message = error instanceof Error ? error.message : String(error);
            void this.safeShowWarningMessage(`无法定位到 ${node.filePath}:${node.lineNumber}，原因：${message}`);
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
            await this.updatePreview();
            await this.previewManager.forceUpdate();
            vscode.window.showInformationMessage(`Preview format changed to: ${newFormat}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to toggle preview format: ${errorMessage}`);
            throw error;
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
     * Get the clipboard manager instance
     */
    public getClipboardManager(): ClipboardManager {
        return this.clipboardManager;
    }

    /**
     * Get the node order manager instance
     */
    public getNodeOrderManager(): NodeOrderManager {
        return this.nodeOrderManager;
    }

    /**
     * Gets the multiple context manager
     * 获取多段上下文管理器
     */
    public getMultipleContextManager(): MultipleContextManager {
        return this.multipleContextManager;
    }

    /**
     * 获取篮子历史管理器
     */
    public getBasketHistoryManager(): BasketHistoryManager {
        return this.basketHistoryManager;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.nodeManager.dispose();
        this.clipboardManager.dispose();
        this.feedbackManager.dispose();
    }
}
