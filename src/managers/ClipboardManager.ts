import * as vscode from 'vscode';
import { Node } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';
import { Graph as GraphModel } from '../models/Graph';
import { CodePathError } from '../types/errors';

/**
 * Data structure for clipboard operations
 */
export interface ClipboardData {
    type: 'copy' | 'cut';
    nodeTree: NodeTreeData;
    timestamp: number;
    originalNodeId?: string;
}

/**
 * Hierarchical representation of a node and its children for clipboard operations
 */
export interface NodeTreeData {
    node: Node;
    children: NodeTreeData[];
}

/**
 * ClipboardManager handles node copy, cut, and paste operations
 * Supports copying/cutting entire node trees (node + all descendants)
 */
export class ClipboardManager {
    private clipboardData: ClipboardData | null = null;
    private nodeManager: INodeManager;
    private graphManager: IGraphManager;

    constructor(nodeManager: INodeManager, graphManager: IGraphManager) {
        this.nodeManager = nodeManager;
        this.graphManager = graphManager;
    }

    /**
     * Copy node and all its children to clipboard
     * Creates a deep copy of the node tree structure
     * 
     * @param nodeId - ID of the node to copy
     * @throws Error if node not found or graph not available
     */
    public async copyNode(nodeId: string): Promise<void> {
        try {
            // Validate input
            if (!nodeId || typeof nodeId !== 'string') {
                throw CodePathError.userError('节点ID必须是非空字符串', '请提供有效的节点ID');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw CodePathError.userError('没有找到活动图表', '请先创建或打开一个图表');
            }

            // Find the node to copy
            const node = currentGraph.nodes.get(nodeId);
            if (!node) {
                throw CodePathError.userError(`未找到ID为 ${nodeId} 的节点`, '请选择一个有效的节点');
            }

            // Build the complete node tree (node + all descendants)
            const nodeTree = this.buildNodeTree(node, currentGraph);

            // Store in clipboard
            this.clipboardData = {
                type: 'copy',
                nodeTree: nodeTree,
                timestamp: Date.now()
            };

            // Update VS Code context to enable paste command
            await vscode.commands.executeCommand('setContext', 'codepath.hasClipboardNode', true);

            console.log(`[ClipboardManager] Copied node tree rooted at: ${node.name} (${nodeId})`);
        } catch (error) {
            console.error('[ClipboardManager] Copy operation failed:', error);
            throw CodePathError.clipboardError(`复制节点失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * Cut node and all its children to clipboard
     * Similar to copy but marks for removal on paste
     * 
     * @param nodeId - ID of the node to cut
     * @throws Error if node not found or graph not available
     */
    public async cutNode(nodeId: string): Promise<void> {
        try {
            // First copy the node (this validates input and builds tree)
            await this.copyNode(nodeId);

            // Mark as cut operation and store original node ID for removal
            if (this.clipboardData) {
                this.clipboardData.type = 'cut';
                this.clipboardData.originalNodeId = nodeId;
            }

            console.log(`[ClipboardManager] Cut node tree rooted at: ${nodeId}`);
        } catch (error) {
            console.error('[ClipboardManager] Cut operation failed:', error);
            throw CodePathError.clipboardError(`剪切节点失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * Paste node tree from clipboard to specified location
     * Creates new nodes with new IDs to avoid conflicts
     * If it was a cut operation, removes the original nodes
     * 
     * @param parentId - Optional parent ID. If provided, nodes are pasted as children. If null, pasted as root nodes.
     * @returns Array of newly created nodes (root nodes of pasted tree)
     * @throws Error if no clipboard data or paste operation fails
     */
    public async pasteNode(parentId?: string): Promise<Node[]> {
        try {
            // Validate clipboard data
            if (!this.clipboardData) {
                throw CodePathError.clipboardError('剪贴板为空', '请先复制或剪切一个节点');
            }

            // Validate parent if provided
            if (parentId) {
                const currentGraph = this.graphManager.getCurrentGraph();
                if (!currentGraph) {
                    throw new Error('No active graph found');
                }

                if (!currentGraph.nodes.has(parentId)) {
                    throw new Error(`Parent node with ID ${parentId} not found`);
                }
            }

            // Create nodes from clipboard tree
            const pastedNodes = await this.createNodesFromTree(this.clipboardData.nodeTree, parentId);

            // If it was a cut operation, remove the original nodes
            if (this.clipboardData.type === 'cut' && this.clipboardData.originalNodeId) {
                try {
                    // Verify original node still exists before attempting deletion
                    const currentGraph = this.graphManager.getCurrentGraph();
                    if (currentGraph && currentGraph.nodes.has(this.clipboardData.originalNodeId)) {
                        await this.nodeManager.deleteNodeWithChildren(this.clipboardData.originalNodeId);
                        console.log(`[ClipboardManager] Removed original cut node: ${this.clipboardData.originalNodeId}`);
                    } else {
                        console.warn(`[ClipboardManager] Original cut node ${this.clipboardData.originalNodeId} no longer exists`);
                    }
                } catch (deleteError) {
                    console.error('[ClipboardManager] Failed to remove original cut node:', deleteError);
                    // Don't fail the paste operation if deletion fails
                }
            }

            console.log(`[ClipboardManager] Pasted ${pastedNodes.length} root nodes from clipboard`);
            return pastedNodes;

        } catch (error) {
            console.error('[ClipboardManager] Paste operation failed:', error);
            throw new Error(`Failed to paste node: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Checks if clipboard has data available for pasting
     * 
     * @returns true if clipboard contains node data
     */
    public hasClipboardData(): boolean {
        return this.clipboardData !== null;
    }

    /**
     * Gets information about current clipboard contents
     * 
     * @returns Clipboard info or null if empty
     */
    public getClipboardInfo(): { type: 'copy' | 'cut'; nodeName: string; timestamp: number } | null {
        if (!this.clipboardData) {
            return null;
        }

        return {
            type: this.clipboardData.type,
            nodeName: this.clipboardData.nodeTree.node.name,
            timestamp: this.clipboardData.timestamp
        };
    }

    /**
     * Clears the clipboard data
     */
    public async clearClipboard(): Promise<void> {
        this.clipboardData = null;
        await vscode.commands.executeCommand('setContext', 'codepath.hasClipboardNode', false);
        console.log('[ClipboardManager] Clipboard cleared');
    }

    /**
     * Builds a hierarchical tree structure from a node and all its descendants
     * 
     * @param node - Root node of the tree to build
     * @param graph - Graph containing all nodes
     * @returns Complete node tree structure
     */
    private buildNodeTree(node: Node, graph: any): NodeTreeData {
        // Create a deep copy of the node data to avoid reference issues
        const nodeCopy: Node = {
            id: node.id,
            name: node.name,
            filePath: node.filePath,
            fileName: node.fileName,
            lineNumber: node.lineNumber,
            codeSnippet: node.codeSnippet,
            codeHash: node.codeHash,
            createdAt: node.createdAt,
            parentId: node.parentId,
            childIds: [...node.childIds],
            validationWarning: node.validationWarning,
            description: node.description
        };

        // Recursively build children trees
        const children: NodeTreeData[] = [];
        for (const childId of node.childIds) {
            const childNode = graph.nodes.get(childId);
            if (childNode) {
                const childTree = this.buildNodeTree(childNode, graph);
                children.push(childTree);
            } else {
                console.warn(`[ClipboardManager] Child node ${childId} not found while building tree`);
            }
        }

        return {
            node: nodeCopy,
            children: children
        };
    }

    /**
     * Creates new nodes from a clipboard tree structure
     * Generates new IDs for all nodes to avoid conflicts
     * 
     * @param nodeTree - Tree structure to recreate
     * @param parentId - Optional parent for the root of the tree
     * @returns Array of created root nodes
     */
    private async createNodesFromTree(nodeTree: NodeTreeData, parentId?: string): Promise<Node[]> {
        try {
            // Create the root node with a new ID
            const originalNode = nodeTree.node;
            
            let newNode: Node;
            if (parentId) {
                // Create as child node
                newNode = await this.nodeManager.createChildNode(
                    parentId,
                    originalNode.name,
                    originalNode.filePath,
                    originalNode.lineNumber
                );
            } else {
                // Create as root node
                newNode = await this.nodeManager.createNode(
                    originalNode.name,
                    originalNode.filePath,
                    originalNode.lineNumber,
                    originalNode.codeSnippet
                );
            }

            // Validate that node was created successfully
            if (!newNode || !newNode.id) {
                throw new Error('Failed to create node - node manager returned invalid result');
            }

            // Copy additional properties if they exist
            const updates: Partial<Node> = {};
            if (originalNode.description) {
                updates.description = originalNode.description;
            }
            if (originalNode.validationWarning) {
                updates.validationWarning = originalNode.validationWarning;
            }
            if (originalNode.codeSnippet) {
                updates.codeSnippet = originalNode.codeSnippet;
            }

            // Apply updates if any
            if (Object.keys(updates).length > 0) {
                await this.nodeManager.updateNode(newNode.id, updates);
            }

            const allCreatedNodes = [newNode];

            // Recursively create children
            for (const childTree of nodeTree.children) {
                const childNodes = await this.createNodesFromTree(childTree, newNode.id);
                allCreatedNodes.push(...childNodes);
            }

            return allCreatedNodes;

        } catch (error) {
            console.error('[ClipboardManager] Failed to create nodes from tree:', error);
            throw new Error(`Failed to recreate node tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates clipboard data integrity
     * 
     * @param data - Clipboard data to validate
     * @returns true if data is valid
     */
    private validateClipboardData(data: ClipboardData): boolean {
        try {
            // Check basic structure
            if (!data || typeof data !== 'object') {
                return false;
            }

            // Check required fields
            if (!data.type || !['copy', 'cut'].includes(data.type)) {
                return false;
            }

            if (!data.nodeTree || typeof data.nodeTree !== 'object') {
                return false;
            }

            if (!data.timestamp || typeof data.timestamp !== 'number') {
                return false;
            }

            // Validate node tree structure
            return this.validateNodeTree(data.nodeTree);

        } catch (error) {
            console.error('[ClipboardManager] Clipboard data validation failed:', error);
            return false;
        }
    }

    /**
     * Validates node tree structure recursively
     * 
     * @param nodeTree - Node tree to validate
     * @returns true if structure is valid
     */
    private validateNodeTree(nodeTree: NodeTreeData): boolean {
        try {
            // Check node structure
            if (!nodeTree.node || typeof nodeTree.node !== 'object') {
                return false;
            }

            const node = nodeTree.node;
            if (!node.id || !node.name || !node.filePath || typeof node.lineNumber !== 'number') {
                return false;
            }

            // Check children array
            if (!Array.isArray(nodeTree.children)) {
                return false;
            }

            // Recursively validate children
            for (const child of nodeTree.children) {
                if (!this.validateNodeTree(child)) {
                    return false;
                }
            }

            return true;

        } catch (error) {
            console.error('[ClipboardManager] Node tree validation failed:', error);
            return false;
        }
    }

    /**
     * Disposes of the clipboard manager and clears resources
     */
    public async dispose(): Promise<void> {
        await this.clearClipboard();
        console.log('[ClipboardManager] Disposed');
    }
}