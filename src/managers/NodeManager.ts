import { Node as NodeModel } from '../models/Node';
import { Graph as GraphModel } from '../models/Graph';
import { Node } from '../types';
import { INodeManager } from '../interfaces/INodeManager';
import { IGraphManager } from '../interfaces/IGraphManager';
import { NodeMatcher, NodeMatchResult } from './NodeMatcher';
import { LocationTracker } from './LocationTracker';

/**
 * NodeManager handles node operations for CodePath extension
 * Manages node creation, relationships, navigation, and switching functionality
 */
export class NodeManager implements INodeManager {
    private graphManager: IGraphManager;
    private currentNodeId: string | null = null;
    private nodeMatcher: NodeMatcher;
    private locationTracker: LocationTracker;

    constructor(graphManager: IGraphManager) {
        this.graphManager = graphManager;
        this.nodeMatcher = new NodeMatcher();
        this.locationTracker = new LocationTracker();
    }

    /**
     * Creates a new root node at the specified location
     */
    public async createNode(name: string, filePath: string, lineNumber: number, codeSnippet?: string): Promise<Node> {
        try {
            this.validateNodeInput(name, filePath, lineNumber, codeSnippet);

            // Get or create current graph
            let currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                currentGraph = await this.graphManager.createGraph();
            }

            // Generate unique node ID
            const nodeId = NodeModel.generateId();

            // Read the actual code line from the file for better tracking
            let actualCodeLine = codeSnippet;
            let codeHash: string | undefined;
            
            try {
                const vscode = require('vscode');
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                
                if (lineNumber <= document.lineCount) {
                    // Get the full line of code
                    actualCodeLine = document.lineAt(lineNumber - 1).text.trim();
                    
                    // Generate hash from the full line for better matching
                    if (actualCodeLine) {
                        codeHash = this.locationTracker.generateCodeHash(actualCodeLine);
                        console.log(`[NodeManager] Generated codeHash for node: ${codeHash.substring(0, 8)}... for line: ${actualCodeLine.substring(0, 50)}`);
                    }
                } else {
                    console.warn(`[NodeManager] Line number ${lineNumber} exceeds file length ${document.lineCount}`);
                }
            } catch (error) {
                // If we can't read the file, use the provided codeSnippet
                console.warn(`[NodeManager] Could not read file for code hash generation: ${error}`);
                if (codeSnippet) {
                    codeHash = this.locationTracker.generateCodeHash(codeSnippet);
                    console.log(`[NodeManager] Generated codeHash from codeSnippet: ${codeHash.substring(0, 8)}...`);
                }
            }

            // Create new node with the actual code line (or fallback to codeSnippet)
            const node = new NodeModel(nodeId, name, filePath, lineNumber, actualCodeLine, null, undefined, codeHash);
            
            console.log(`[NodeManager] Created node with codeHash: ${node.codeHash ? node.codeHash.substring(0, 8) + '...' : 'undefined'}`);

            // Convert graph to model for manipulation
            const graphModel = GraphModel.fromJSON(currentGraph);
            
            // Add node to graph
            graphModel.addNode(node);

            // Set as current node
            graphModel.setCurrentNode(nodeId);
            this.currentNodeId = nodeId;

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());

            return node.toJSON();
        } catch (error) {
            throw new Error(`Failed to create node: ${error}`);
        }
    }

    /**
     * Creates a child node under the specified parent
     */
    public async createChildNode(parentId: string, name: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            this.validateNodeInput(name, filePath, lineNumber);
            
            if (!parentId || typeof parentId !== 'string') {
                throw new Error('Parent ID must be a non-empty string');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active CodePath found. Please create a CodePath first.');
            }

            // Convert to model for manipulation
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Verify parent exists
            const parentNode = graphModel.getNode(parentId);
            if (!parentNode) {
                throw new Error(`Parent node with ID ${parentId} not found`);
            }

            // Generate unique node ID
            const nodeId = NodeModel.generateId();

            // Generate code hash if we have a code snippet (get from current line)
            let codeSnippet: string | undefined;
            let codeHash: string | undefined;
            try {
                const uri = require('vscode').Uri.file(filePath);
                const document = await require('vscode').workspace.openTextDocument(uri);
                if (lineNumber <= document.lineCount) {
                    codeSnippet = document.lineAt(lineNumber - 1).text.trim();
                    if (codeSnippet) {
                        codeHash = this.locationTracker.generateCodeHash(codeSnippet);
                    }
                }
            } catch {
                // If we can't read the file, continue without code snippet
            }

            // Create new child node (without parentId initially)
            const childNode = new NodeModel(nodeId, name, filePath, lineNumber, codeSnippet, null, undefined, codeHash);

            // Add node to graph
            graphModel.addNode(childNode);

            // Establish parent-child relationship (this will set the parentId)
            graphModel.setParentChild(parentId, nodeId);

            // Set as current node
            graphModel.setCurrentNode(nodeId);
            this.currentNodeId = nodeId;

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());

            return childNode.toJSON();
        } catch (error) {
            throw new Error(`Failed to create child node: ${error}`);
        }
    }

    /**
     * Creates a parent node above the specified child and creates a tree fork if child already has a parent
     */
    public async createParentNode(childId: string, name: string, filePath: string, lineNumber: number): Promise<Node> {
        try {
            this.validateNodeInput(name, filePath, lineNumber);
            
            if (!childId || typeof childId !== 'string') {
                throw new Error('Child ID must be a non-empty string');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active CodePath found. Please create a CodePath first.');
            }

            // Convert to model for manipulation (this will auto-repair if needed)
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Verify child exists
            const childNode = graphModel.getNode(childId);
            if (!childNode) {
                const availableNodes = Array.from(graphModel.nodes.keys()).join(', ');
                throw new Error(`Child node with ID ${childId} not found. Available nodes: ${availableNodes}`);
            }

            // Generate unique node ID for new parent
            const nodeId = NodeModel.generateId();

            // Get the current parent of the child (if any)
            const currentParentId = childNode.parentId;

            // Generate code hash if we have a code snippet (get from current line)
            let codeSnippet: string | undefined;
            let codeHash: string | undefined;
            try {
                const uri = require('vscode').Uri.file(filePath);
                const document = await require('vscode').workspace.openTextDocument(uri);
                if (lineNumber <= document.lineCount) {
                    codeSnippet = document.lineAt(lineNumber - 1).text.trim();
                    if (codeSnippet) {
                        codeHash = this.locationTracker.generateCodeHash(codeSnippet);
                    }
                }
            } catch {
                // If we can't read the file, continue without code snippet
            }

            // Create new parent node (without parent initially)
            const parentNode = new NodeModel(nodeId, name, filePath, lineNumber, codeSnippet, null, undefined, codeHash);

            // Add node to graph
            graphModel.addNode(parentNode);

            // If child already has a parent, create a fork by duplicating the child node
            if (currentParentId) {
                console.log(`[NodeManager] Creating tree fork: child ${childId} already has parent ${currentParentId}`);
                
                // Generate a new ID for the duplicated child node
                const duplicatedChildId = NodeModel.generateId();
                
                // Create a duplicate of the child node with all its properties
                const duplicatedChild = new NodeModel(
                    duplicatedChildId,
                    childNode.name,
                    childNode.filePath,
                    childNode.lineNumber,
                    childNode.codeSnippet,
                    null, // Will be set when establishing relationship
                    undefined,
                    childNode.codeHash,
                    childNode.fileName
                );
                
                // Copy all children from original to duplicate
                for (const childChildId of childNode.childIds) {
                    duplicatedChild.addChild(childChildId);
                    // Update the child's parent reference to point to the duplicate
                    const childChild = graphModel.getNode(childChildId);
                    if (childChild) {
                        childChild.setParent(duplicatedChildId);
                    }
                }
                
                // Add duplicated node to graph
                graphModel.addNode(duplicatedChild);
                
                // Establish new parent-child relationship with the duplicate
                graphModel.setParentChild(nodeId, duplicatedChildId);
                
                // Remove children from original node (they now belong to duplicate)
                while (childNode.childIds.length > 0) {
                    childNode.removeChild(childNode.childIds[0]);
                }
                
                console.log(`[NodeManager] Tree fork created: original child ${childId} kept under ${currentParentId}, duplicate ${duplicatedChildId} under new parent ${nodeId}`);
            } else {
                // Child has no parent, simply establish the relationship
                graphModel.setParentChild(nodeId, childId);
            }

            // Set as current node
            graphModel.setCurrentNode(nodeId);
            this.currentNodeId = nodeId;

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());

            return parentNode.toJSON();
        } catch (error) {
            throw new Error(`Failed to create parent node: ${error}`);
        }
    }

    /**
     * Deletes a node and handles relationship cleanup
     */
    public async deleteNode(nodeId: string): Promise<void> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('Node ID must be a non-empty string');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            // Convert to model for manipulation
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Verify node exists
            if (!graphModel.hasNode(nodeId)) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            // Clear current node if it's being deleted
            if (this.currentNodeId === nodeId) {
                this.currentNodeId = null;
            }

            // Remove node from graph (handles relationship cleanup automatically)
            graphModel.removeNode(nodeId);

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());
        } catch (error) {
            throw new Error(`Failed to delete node: ${error}`);
        }
    }

    /**
     * Deletes a node and all its descendants (children, grandchildren, etc.)
     */
    public async deleteNodeWithChildren(nodeId: string): Promise<void> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('Node ID must be a non-empty string');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            // Convert to model for manipulation
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Verify node exists
            if (!graphModel.hasNode(nodeId)) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            // Get all descendants before deletion
            const descendants = graphModel.getDescendants(nodeId);
            const nodesToDelete = [nodeId, ...descendants.map(d => d.id)];

            // Clear current node if it's being deleted
            if (this.currentNodeId && nodesToDelete.includes(this.currentNodeId)) {
                this.currentNodeId = null;
            }

            // Delete all descendants first (bottom-up to avoid relationship issues)
            for (let i = descendants.length - 1; i >= 0; i--) {
                graphModel.removeNode(descendants[i].id);
            }

            // Finally delete the node itself
            graphModel.removeNode(nodeId);

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());
        } catch (error) {
            throw new Error(`Failed to delete node with children: ${error}`);
        }
    }

    /**
     * Updates node properties
     */
    public async updateNode(nodeId: string, updates: Partial<Node>): Promise<void> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('Node ID must be a non-empty string');
            }

            if (!updates || typeof updates !== 'object') {
                throw new Error('Updates must be provided as an object');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            // Convert to model for manipulation
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Get the node to update
            const node = graphModel.getNode(nodeId);
            if (!node) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            // Apply updates with validation
            console.log('[NodeManager] Applying updates to node:', nodeId);
            console.log('[NodeManager] Updates object:', JSON.stringify(updates));
            console.log('[NodeManager] Has description property:', 'description' in updates);
            console.log('[NodeManager] Description value:', updates.description);
            
            if (updates.name !== undefined) {
                console.log('[NodeManager] Updating name to:', updates.name);
                node.updateName(updates.name);
            }
            if (updates.filePath !== undefined) {
                console.log('[NodeManager] Updating filePath to:', updates.filePath);
                node.updateFilePath(updates.filePath);
            }
            if (updates.lineNumber !== undefined) {
                console.log('[NodeManager] Updating lineNumber to:', updates.lineNumber);
                node.updateLineNumber(updates.lineNumber);
            }
            if ('codeSnippet' in updates) {
                console.log('[NodeManager] Updating codeSnippet to:', updates.codeSnippet);
                // Convert null to undefined
                const newCodeSnippet = updates.codeSnippet === null ? undefined : updates.codeSnippet;
                node.updateCodeSnippet(newCodeSnippet);
                
                // Update codeHash when codeSnippet changes
                if (newCodeSnippet) {
                    const newCodeHash = this.locationTracker.generateCodeHash(newCodeSnippet);
                    node.codeHash = newCodeHash;
                    console.log('[NodeManager] Updated codeHash to:', newCodeHash.substring(0, 8) + '...');
                } else {
                    node.codeHash = undefined;
                    console.log('[NodeManager] Cleared codeHash');
                }
            }
            if ('validationWarning' in updates) {
                console.log('[NodeManager] Updating validationWarning to:', updates.validationWarning);
                // Convert null to undefined
                node.validationWarning = updates.validationWarning === null ? undefined : updates.validationWarning;
            }
            if ('description' in updates) {
                console.log('[NodeManager] Updating description to:', updates.description);
                // Convert null to undefined
                node.updateDescription(updates.description === null ? undefined : updates.description);
                console.log('[NodeManager] Node description after update:', node.description);
            }

            // Note: We don't allow updating id, createdAt, parentId, or childIds through this method
            // as they require special handling through other methods

            // Save updated graph
            await this.graphManager.saveGraph(graphModel.toJSON());
        } catch (error) {
            throw new Error(`Failed to update node: ${error}`);
        }
    }

    /**
     * Finds nodes by name using fuzzy matching
     */
    public findNodesByName(name: string): Node[] {
        try {
            if (!name || typeof name !== 'string') {
                return [];
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Convert to model for searching
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Use graph's built-in search functionality
            const foundNodes = graphModel.findNodesByName(name);

            // Convert to interface format and return
            return foundNodes.map(node => node.toJSON());
        } catch (error) {
            console.warn(`Error finding nodes by name: ${error}`);
            return [];
        }
    }

    /**
     * Finds nodes by exact file path and line number location
     */
    public findNodesByLocation(filePath: string, lineNumber: number): Node[] {
        try {
            if (!filePath || typeof filePath !== 'string') {
                return [];
            }

            if (typeof lineNumber !== 'number' || lineNumber < 1) {
                return [];
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Convert to model for searching
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Use graph's built-in location search
            const foundNodes = graphModel.findNodesByLocation(filePath, lineNumber);

            // Convert to interface format and return
            return foundNodes.map(node => node.toJSON());
        } catch (error) {
            console.warn(`Error finding nodes by location: ${error}`);
            return [];
        }
    }

    /**
     * Sets the current active node
     */
    public async setCurrentNode(nodeId: string): Promise<void> {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                throw new Error('Node ID must be a non-empty string');
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            // Verify node exists
            if (!currentGraph.nodes.has(nodeId)) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            // Update current node in graph
            const graphModel = GraphModel.fromJSON(currentGraph);
            graphModel.setCurrentNode(nodeId);

            // Update local state
            this.currentNodeId = nodeId;

            // Save updated graph and wait for completion
            await this.graphManager.saveGraph(graphModel.toJSON());
        } catch (error) {
            throw new Error(`Failed to set current node: ${error}`);
        }
    }

    /**
     * Gets the current active node
     */
    public getCurrentNode(): Node | null {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return null;
            }

            // Get current node from graph
            if (!currentGraph.currentNodeId) {
                return null;
            }

            const node = currentGraph.nodes.get(currentGraph.currentNodeId);
            return node ? node : null;
        } catch (error) {
            console.warn(`Error getting current node: ${error}`);
            return null;
        }
    }

    /**
     * Finds nodes using intelligent matching (fuzzy name + exact location)
     */
    public findNodesIntelligent(query?: string, filePath?: string, lineNumber?: number): Node[] {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Get all nodes
            const allNodes = Array.from(currentGraph.nodes.values());

            // Use NodeMatcher for intelligent matching
            const matchResults = this.nodeMatcher.findNodesIntelligent(allNodes, query, filePath, lineNumber);

            // Return just the nodes (sorted by relevance)
            return matchResults.map(result => result.node);
        } catch (error) {
            console.warn(`Error in intelligent node search: ${error}`);
            return [];
        }
    }

    /**
     * Finds nodes using intelligent matching and returns detailed results with scores
     */
    public findNodesIntelligentWithScores(query?: string, filePath?: string, lineNumber?: number): NodeMatchResult[] {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Get all nodes
            const allNodes = Array.from(currentGraph.nodes.values());

            // Use NodeMatcher for intelligent matching
            return this.nodeMatcher.findNodesIntelligent(allNodes, query, filePath, lineNumber);
        } catch (error) {
            console.warn(`Error in intelligent node search with scores: ${error}`);
            return [];
        }
    }

    /**
     * Gets all nodes in the current graph
     */
    public getAllNodes(): Node[] {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Convert all nodes to interface format
            return Array.from(currentGraph.nodes.values());
        } catch (error) {
            console.warn(`Error getting all nodes: ${error}`);
            return [];
        }
    }

    /**
     * Gets children of a specific node
     */
    public getNodeChildren(nodeId: string): Node[] {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                return [];
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Convert to model for querying
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Get children using graph model
            const children = graphModel.getChildren(nodeId);

            // Convert to interface format
            return children.map(child => child.toJSON());
        } catch (error) {
            console.warn(`Error getting node children: ${error}`);
            return [];
        }
    }

    /**
     * Gets parent of a specific node
     */
    public getNodeParent(nodeId: string): Node | null {
        try {
            if (!nodeId || typeof nodeId !== 'string') {
                return null;
            }

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return null;
            }

            // Convert to model for querying
            const graphModel = GraphModel.fromJSON(currentGraph);

            // Get parent using graph model
            const parent = graphModel.getParent(nodeId);

            // Convert to interface format
            return parent ? parent.toJSON() : null;
        } catch (error) {
            console.warn(`Error getting node parent: ${error}`);
            return null;
        }
    }

    /**
     * Validates node input parameters
     */
    private validateNodeInput(name: string, filePath: string, lineNumber: number, codeSnippet?: string): void {
        if (!name || typeof name !== 'string') {
            throw new Error('Node name must be a non-empty string');
        }

        if (name.trim().length === 0) {
            throw new Error('Node name cannot be empty or whitespace only');
        }

        if (!filePath || typeof filePath !== 'string') {
            throw new Error('File path must be a non-empty string');
        }

        if (filePath.trim().length === 0) {
            throw new Error('File path cannot be empty or whitespace only');
        }

        if (typeof lineNumber !== 'number') {
            throw new Error('Line number must be a number');
        }

        if (!Number.isInteger(lineNumber) || lineNumber < 1) {
            throw new Error('Line number must be a positive integer');
        }

        if (codeSnippet !== undefined) {
            if (typeof codeSnippet !== 'string') {
                throw new Error('Code snippet must be a string');
            }

            if (codeSnippet.length > 5000) {
                throw new Error('Code snippet cannot exceed 5000 characters');
            }
        }
    }

    /**
     * Finds the best matching node for quick navigation
     */
    public findBestMatchingNode(query?: string, filePath?: string, lineNumber?: number): Node | null {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return null;
            }

            // Get all nodes
            const allNodes = Array.from(currentGraph.nodes.values());

            // Use NodeMatcher to find best match
            return this.nodeMatcher.findBestMatch(allNodes, query, filePath, lineNumber);
        } catch (error) {
            console.warn(`Error finding best matching node: ${error}`);
            return null;
        }
    }

    /**
     * Finds nodes by proximity to a given location
     */
    public findNodesByProximity(filePath: string, lineNumber: number, maxDistance: number = 10): NodeMatchResult[] {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Get all nodes
            const allNodes = Array.from(currentGraph.nodes.values());

            // Use NodeMatcher for proximity search
            return this.nodeMatcher.findNodesByProximity(allNodes, filePath, lineNumber, maxDistance);
        } catch (error) {
            console.warn(`Error finding nodes by proximity: ${error}`);
            return [];
        }
    }

    /**
     * Finds nodes that are likely related to the given node
     */
    public findRelatedNodes(nodeId: string): NodeMatchResult[] {
        try {
            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // Get the target node
            const targetNode = currentGraph.nodes.get(nodeId);
            if (!targetNode) {
                return [];
            }

            // Get all nodes
            const allNodes = Array.from(currentGraph.nodes.values());

            // Use NodeMatcher for related node search
            return this.nodeMatcher.findRelatedNodes(allNodes, targetNode);
        } catch (error) {
            console.warn(`Error finding related nodes: ${error}`);
            return [];
        }
    }

    /**
     * Navigates to the best matching node and sets it as current
     */
    public async navigateToNode(query?: string, filePath?: string, lineNumber?: number): Promise<Node | null> {
        try {
            const bestMatch = this.findBestMatchingNode(query, filePath, lineNumber);
            
            if (bestMatch) {
                await this.setCurrentNode(bestMatch.id);
                return bestMatch;
            }

            return null;
        } catch (error) {
            console.warn(`Error navigating to node: ${error}`);
            return null;
        }
    }

    /**
     * Gets navigation suggestions based on current context
     */
    public getNavigationSuggestions(currentFilePath?: string, currentLineNumber?: number): NodeMatchResult[] {
        try {
            const suggestions: NodeMatchResult[] = [];

            // Get current graph
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return [];
            }

            // If we have a current node, find related nodes
            if (this.currentNodeId) {
                const relatedNodes = this.findRelatedNodes(this.currentNodeId);
                suggestions.push(...relatedNodes);
            }

            // If we have current location, find nearby nodes
            if (currentFilePath && currentLineNumber) {
                const proximityNodes = this.findNodesByProximity(currentFilePath, currentLineNumber, 20);
                suggestions.push(...proximityNodes);
            }

            // Remove duplicates and limit results
            const uniqueSuggestions = new Map<string, NodeMatchResult>();
            for (const suggestion of suggestions) {
                const existing = uniqueSuggestions.get(suggestion.node.id);
                if (!existing || suggestion.score > existing.score) {
                    uniqueSuggestions.set(suggestion.node.id, suggestion);
                }
            }

            return Array.from(uniqueSuggestions.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 10); // Limit to top 10 suggestions
        } catch (error) {
            console.warn(`Error getting navigation suggestions: ${error}`);
            return [];
        }
    }

    /**
     * Validates search parameters for node matching
     */
    public validateSearchParameters(query?: string, filePath?: string, lineNumber?: number): {
        isValid: boolean;
        errors: string[];
        normalizedParams: {
            query?: string;
            filePath?: string;
            lineNumber?: number;
        };
    } {
        const errors: string[] = [];
        const normalizedParams: any = {};

        // Validate query
        if (query !== undefined) {
            if (typeof query !== 'string') {
                errors.push('Query must be a string');
            } else if (query.trim().length === 0) {
                errors.push('Query cannot be empty');
            } else if (query.length > 200) {
                errors.push('Query cannot exceed 200 characters');
            } else {
                normalizedParams.query = query.trim();
            }
        }

        // Validate file path
        if (filePath !== undefined) {
            if (typeof filePath !== 'string') {
                errors.push('File path must be a string');
            } else if (filePath.trim().length === 0) {
                errors.push('File path cannot be empty');
            } else {
                normalizedParams.filePath = filePath.trim();
            }
        }

        // Validate line number
        if (lineNumber !== undefined) {
            if (typeof lineNumber !== 'number') {
                errors.push('Line number must be a number');
            } else if (!Number.isInteger(lineNumber)) {
                errors.push('Line number must be an integer');
            } else if (lineNumber < 1) {
                errors.push('Line number must be greater than 0');
            } else if (lineNumber > 1000000) {
                errors.push('Line number cannot exceed 1,000,000');
            } else {
                normalizedParams.lineNumber = lineNumber;
            }
        }

        // Check if at least one parameter is provided
        if (Object.keys(normalizedParams).length === 0) {
            errors.push('At least one search parameter (query, filePath, or lineNumber) must be provided');
        }

        return {
            isValid: errors.length === 0,
            errors,
            normalizedParams
        };
    }

    /**
     * Synchronizes current node state with graph manager
     */
    public syncCurrentNodeWithGraph(): void {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (currentGraph) {
                this.currentNodeId = currentGraph.currentNodeId;
            } else {
                this.currentNodeId = null;
            }
        } catch (error) {
            console.warn(`Error syncing current node with graph: ${error}`);
            this.currentNodeId = null;
        }
    }

    /**
     * Validates a node's location and suggests updates if needed
     */
    public async validateNodeLocation(nodeId: string): Promise<{
        isValid: boolean;
        confidence: 'exact' | 'high' | 'medium' | 'low' | 'failed';
        suggestedLocation?: { filePath: string; lineNumber: number };
        message?: string;
    }> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            const node = currentGraph.nodes.get(nodeId);
            if (!node) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            const validation = await this.locationTracker.validateLocation(node);

            return {
                isValid: validation.isValid,
                confidence: validation.confidence,
                suggestedLocation: validation.suggestedLocation,
                message: validation.reason
            };
        } catch (error) {
            return {
                isValid: false,
                confidence: 'failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Updates a node's location after validation
     */
    public async relocateNode(nodeId: string, newFilePath: string, newLineNumber: number): Promise<void> {
        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                throw new Error('No active graph found');
            }

            const node = currentGraph.nodes.get(nodeId);
            if (!node) {
                throw new Error(`Node with ID ${nodeId} not found`);
            }

            // Update the node location
            const updatedNode = await this.locationTracker.updateNodeLocation(node, newFilePath, newLineNumber);

            // Save the updated node
            await this.updateNode(nodeId, {
                filePath: updatedNode.filePath,
                lineNumber: updatedNode.lineNumber,
                codeSnippet: updatedNode.codeSnippet,
                codeHash: updatedNode.codeHash
            });
        } catch (error) {
            throw new Error(`Failed to relocate node: ${error}`);
        }
    }

    /**
     * Validates all nodes in the current graph
     */
    public async validateAllNodes(): Promise<Map<string, {
        isValid: boolean;
        confidence: string;
        message?: string;
    }>> {
        const results = new Map();

        try {
            const currentGraph = this.graphManager.getCurrentGraph();
            if (!currentGraph) {
                return results;
            }

            for (const [nodeId, node] of currentGraph.nodes) {
                const validation = await this.locationTracker.validateLocation(node);
                results.set(nodeId, {
                    isValid: validation.isValid,
                    confidence: validation.confidence,
                    message: validation.reason
                });
            }
        } catch (error) {
            console.warn(`Error validating all nodes: ${error}`);
        }

        return results;
    }

    /**
     * Gets the LocationTracker instance
     */
    public getLocationTracker(): LocationTracker {
        return this.locationTracker;
    }

    /**
     * Disposes of resources
     */
    public dispose(): void {
        this.locationTracker.dispose();
    }
}