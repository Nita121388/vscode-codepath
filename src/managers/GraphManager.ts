import { Graph as GraphModel } from '../models/Graph';
import { Node } from '../models/Node';
import { Graph, GraphMetadata } from '../types';
import { IGraphManager } from '../interfaces/IGraphManager';
import { IStorageManager } from '../interfaces/IStorageManager';
import { StorageManager } from './StorageManager';

/**
 * GraphManager handles graph lifecycle and operations for CodePath extension
 * Manages graph creation, loading, saving, and current graph state
 */
export class GraphManager implements IGraphManager {
    private currentGraph: GraphModel | null = null;
    private storageManager: IStorageManager;

    constructor(storageManager?: IStorageManager) {
        this.storageManager = storageManager || new StorageManager();
    }

    /**
     * Creates a new graph with optional name
     */
    public async createGraph(name?: string): Promise<Graph> {
        try {
            const graphId = GraphModel.generateId();
            const graphName = name || `Graph ${new Date().toLocaleDateString()}`;
            
            const graph = new GraphModel(graphId, graphName);
            
            // Save the new graph，若持久化失败则记录警告但继续使用内存状态
            try {
                await this.storageManager.saveGraphToFile(graph);
            } catch (error) {
                console.warn('[GraphManager] 保存新图到存储失败，将继续使用内存图形：', error);
            }
            
            // Set as current graph
            this.currentGraph = graph;
            
            return graph.toJSON();
        } catch (error) {
            throw new Error(`Failed to create graph: ${error}`);
        }
    }

    /**
     * Loads a graph by ID
     */
    public async loadGraph(graphId: string): Promise<Graph> {
        try {
            if (!graphId || typeof graphId !== 'string') {
                throw new Error('Graph ID must be a non-empty string');
            }

            const graph = await this.storageManager.loadGraphFromFile(graphId);
            
            // Validate node locations after loading
            await this.validateNodeLocations(graph);
            
            // Set as current graph
            this.currentGraph = graph;
            
            return graph.toJSON();
        } catch (error) {
            throw new Error(`Failed to load graph ${graphId}: ${error}`);
        }
    }

    /**
     * Validates all node locations in a graph and marks invalid ones with warnings
     */
    private async validateNodeLocations(graph: GraphModel): Promise<void> {
        try {
            // Dynamically import to avoid circular dependencies
            const { LocationTracker } = await import('./LocationTracker');
            const locationTracker = new LocationTracker();
            
            let warningCount = 0;
            const nodes = Array.from(graph.nodes.values());
            
            for (const node of nodes) {
                // Skip validation if node has no code snippet
                if (!node.codeSnippet) {
                    continue;
                }
                
                try {
                    const validation = await locationTracker.validateLocation(node);
                    
                    if (!validation.isValid && validation.confidence === 'failed') {
                        // Mark node with warning
                        node.validationWarning = validation.reason || 'Code snippet not found in file';
                        warningCount++;
                        
                        console.log(`[GraphManager] Node "${node.name}" validation failed: ${node.validationWarning}`);
                    } else {
                        // Clear any existing warning
                        node.validationWarning = undefined;
                    }
                } catch (error) {
                    // If validation throws an error, mark the node with a warning
                    node.validationWarning = error instanceof Error ? error.message : 'Validation error';
                    warningCount++;
                    console.error(`[GraphManager] Error validating node "${node.name}":`, error);
                }
            }
            
            if (warningCount > 0) {
                console.log(`[GraphManager] Graph loaded with ${warningCount} validation warning(s)`);
            }
            
            locationTracker.dispose();
        } catch (error) {
            console.error('[GraphManager] Failed to validate node locations:', error);
            // Don't throw - validation is optional and shouldn't prevent graph loading
        }
    }

    /**
     * Saves a graph
     */
    public async saveGraph(graph: Graph): Promise<void> {
        try {
            if (!graph) {
                throw new Error('Invalid graph data');
            }
            
            if (!graph.id) {
                throw new Error('Invalid graph data');
            }

            // Convert from interface to model if needed
            let graphModel: GraphModel;
            if (graph instanceof GraphModel) {
                graphModel = graph;
            } else {
                try {
                    graphModel = GraphModel.fromJSON(graph);
                } catch (error) {
                    throw new Error('Invalid graph data');
                }
            }

            // Update the updatedAt timestamp
            graphModel.updatedAt = new Date();

            try {
                await this.storageManager.saveGraphToFile(graphModel);
            } catch (error) {
                console.warn(`[GraphManager] 保存图 ${graphModel.id} 到存储失败，将继续使用内存状态:`, error);
            }
            
            // Update current graph if it's the same one or当前暂无活跃图
            if (!this.currentGraph || (graph && this.currentGraph.id === graph.id)) {
                this.currentGraph = graphModel;
            }
        } catch (error) {
            throw new Error(`Failed to save graph ${graph?.id || 'unknown'}: ${error}`);
        }
    }

    /**
     * Deletes a graph by ID
     */
    public async deleteGraph(graphId: string): Promise<void> {
        try {
            if (!graphId || typeof graphId !== 'string') {
                throw new Error('Graph ID must be a non-empty string');
            }

            await this.storageManager.deleteGraphFile(graphId);
            
            // Clear current graph if it's the one being deleted
            if (this.currentGraph && this.currentGraph.id === graphId) {
                this.currentGraph = null;
            }
        } catch (error) {
            throw new Error(`Failed to delete graph ${graphId}: ${error}`);
        }
    }

    /**
     * Exports a graph to markdown format
     * Returns the markdown content as a string
     */
    public async exportGraph(graph: Graph, format: 'md'): Promise<string> {
        try {
            if (!graph) {
                throw new Error('Invalid graph data');
            }
            
            if (!graph.id) {
                throw new Error('Invalid graph data');
            }

            // Validate export format
            this.validateExportFormat(format);
            
            // Validate graph data
            this.validateGraphData(graph);

            // Convert from interface to model if needed
            let graphModel: GraphModel;
            if (graph instanceof GraphModel) {
                graphModel = graph;
            } else {
                try {
                    graphModel = GraphModel.fromJSON(graph);
                } catch (error) {
                    throw new Error('Invalid graph data');
                }
            }

            // Generate markdown content directly instead of writing to file
            return this.generateMarkdownForExport(graphModel);
        } catch (error) {
            throw new Error(`Failed to export graph ${graph?.id || 'unknown'}: ${error}`);
        }
    }

    /**
     * Generates markdown content for export
     */
    private generateMarkdownForExport(graph: GraphModel): string {
        const lines: string[] = [];
        
        lines.push(`# ${graph.name}`);
        lines.push('');
        lines.push(`**Created:** ${graph.createdAt.toISOString()}`);
        lines.push(`**Updated:** ${graph.updatedAt.toISOString()}`);
        lines.push(`**Nodes:** ${graph.nodes.size}`);
        lines.push('');
        
        // Convert Map to array for processing
        const nodesArray = Array.from(graph.nodes.values());
        
        // Find root nodes
        const rootNodes = nodesArray.filter(node => node.parentId === null);
        
        if (rootNodes.length === 0) {
            lines.push('*No nodes in this graph*');
        } else {
            lines.push('## Graph Structure');
            lines.push('');
            
            // Render each root node and its descendants
            for (const rootNode of rootNodes) {
                this.renderNodeForExport(rootNode, graph, lines, 0);
            }
        }
        
        // Add embedded JSON data for import functionality
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('<!-- CodePath Graph Data - DO NOT EDIT BELOW THIS LINE -->');
        lines.push('```json');
        lines.push(JSON.stringify(this.serializeGraphForExport(graph), null, 2));
        lines.push('```');
        
        return lines.join('\n');
    }

    /**
     * Serializes graph data for export
     */
    private serializeGraphForExport(graph: GraphModel): any {
        return {
            id: graph.id,
            name: graph.name,
            createdAt: graph.createdAt.toISOString(),
            updatedAt: graph.updatedAt.toISOString(),
            currentNodeId: graph.currentNodeId,
            nodes: Array.from(graph.nodes.values()).map(node => ({
                id: node.id,
                name: node.name,
                filePath: node.filePath,
                lineNumber: node.lineNumber,
                codeSnippet: node.codeSnippet,
                createdAt: node.createdAt.toISOString(),
                parentId: node.parentId,
                childIds: node.childIds
            })),
            rootNodes: graph.rootNodes
        };
    }

    /**
     * Renders a node and its children in markdown format
     */
    private renderNodeForExport(node: any, graph: GraphModel, lines: string[], depth: number): void {
        const indent = '  '.repeat(depth);
        const fileName = node.filePath.split('/').pop() || node.filePath.split('\\').pop() || node.filePath;
        const nodeInfo = `${indent}- **${node.name}** (${fileName}:${node.lineNumber})`;
        lines.push(nodeInfo);
        
        if (node.codeSnippet) {
            const ext = node.filePath.split('.').pop()?.toLowerCase() || 'text';
            lines.push(`${indent}  \`\`\`${ext}`);
            const snippetLines = node.codeSnippet.split('\n');
            for (const snippetLine of snippetLines) {
                lines.push(`${indent}  ${snippetLine}`);
            }
            lines.push(`${indent}  \`\`\``);
        }
        
        // Render children
        for (const childId of node.childIds) {
            const childNode = graph.nodes.get(childId);
            if (childNode) {
                this.renderNodeForExport(childNode, graph, lines, depth + 1);
            }
        }
    }

    /**
     * Imports a graph from markdown content
     */
    public async importGraph(content: string): Promise<Graph> {
        try {
            if (!content || typeof content !== 'string') {
                throw new Error('Content must be a non-empty string');
            }

            // Validate markdown content
            this.validateMarkdownContent(content);

            // Parse markdown content and create graph
            const graph = this.parseMarkdownContent(content);
            
            // Validate the imported graph
            this.validateImportedGraph(graph);
            
            // Save the imported graph
            await this.storageManager.saveGraphToFile(graph);
            
            return graph.toJSON();
        } catch (error) {
            throw new Error(`Failed to import graph: ${error}`);
        }
    }

    /**
     * Lists all available graphs
     */
    public async listGraphs(): Promise<GraphMetadata[]> {
        try {
            const graphList = await this.storageManager.listGraphs();
            
            // Convert to GraphMetadata format
            return graphList.map(graph => ({
                id: graph.id,
                name: graph.name,
                createdAt: graph.createdAt,
                updatedAt: graph.updatedAt,
                nodeCount: graph.nodeCount
            }));
        } catch (error) {
            throw new Error(`Failed to list graphs: ${error}`);
        }
    }

    /**
     * Gets the current graph
     */
    public getCurrentGraph(): Graph | null {
        if (!this.currentGraph) {
            return null;
        }
        
        return this.currentGraph.toJSON();
    }

    /**
     * Sets the current graph
     */
    public setCurrentGraph(graph: Graph | null): void {
        try {
            if (!graph) {
                this.currentGraph = null;
                return;
            }
            
            if (!graph.id) {
                throw new Error('Invalid graph data');
            }

            // Convert from interface to model if needed
            if (graph instanceof GraphModel) {
                this.currentGraph = graph;
            } else {
                try {
                    this.currentGraph = GraphModel.fromJSON(graph);
                } catch (error) {
                    throw new Error('Invalid graph data');
                }
            }
        } catch (error) {
            throw new Error(`Failed to set current graph: ${error}`);
        }
    }

    /**
     * Loads the last used graph on startup
     */
    public async loadLastUsedGraph(): Promise<Graph | null> {
        try {
            const currentGraphId = await this.storageManager.getCurrentGraphId();
            
            if (!currentGraphId) {
                return null;
            }

            return await this.loadGraph(currentGraphId);
        } catch (error) {
            // Don't throw error for loading last used graph - just return null
            console.warn(`Failed to load last used graph: ${error}`);
            return null;
        }
    }

    /**
     * Creates a backup of the current graph
     */
    public async backupCurrentGraph(): Promise<void> {
        if (!this.currentGraph) {
            throw new Error('No current graph to backup');
        }

        try {
            await this.storageManager.backupGraph(this.currentGraph);
        } catch (error) {
            throw new Error(`Failed to backup current graph: ${error}`);
        }
    }

    /**
     * Restores a graph from backup
     */
    public async restoreGraphFromBackup(graphId: string): Promise<Graph> {
        try {
            if (!graphId || typeof graphId !== 'string') {
                throw new Error('Graph ID must be a non-empty string');
            }

            const graph = await this.storageManager.restoreFromBackup(graphId);
            
            // Save the restored graph
            await this.storageManager.saveGraphToFile(graph);
            
            // Set as current graph
            this.currentGraph = graph;
            
            return graph.toJSON();
        } catch (error) {
            throw new Error(`Failed to restore graph ${graphId} from backup: ${error}`);
        }
    }

    /**
     * Parses markdown content to create a graph
     */
    private parseMarkdownContent(content: string): GraphModel {
        // Try to extract embedded JSON data first (new format)
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        
        if (jsonMatch) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                return this.deserializeGraphFromJSON(jsonData);
            } catch (error) {
                console.warn('Failed to parse embedded JSON, falling back to markdown parsing:', error);
            }
        }
        
        // Fallback to legacy markdown parsing
        return this.parseMarkdownStructure(content);
    }

    /**
     * Deserializes graph from JSON data
     */
    private deserializeGraphFromJSON(jsonData: any): GraphModel {
        // Generate new ID for imported graph to avoid conflicts
        const graphId = GraphModel.generateId();
        const graph = new GraphModel(graphId, jsonData.name || 'Imported Graph');
        
        // Create a map to track old ID to new ID mapping
        const idMap = new Map<string, string>();
        
        // First pass: create all nodes with new IDs
        for (const nodeData of jsonData.nodes || []) {
            const newNodeId = Node.generateId();
            idMap.set(nodeData.id, newNodeId);
            
            const node = new Node(
                newNodeId,
                nodeData.name,
                nodeData.filePath,
                nodeData.lineNumber,
                nodeData.codeSnippet
            );
            
            graph.addNode(node);
        }
        
        // Second pass: establish relationships using new IDs
        for (const nodeData of jsonData.nodes || []) {
            const newNodeId = idMap.get(nodeData.id);
            if (!newNodeId) {continue;}
            
            const node = graph.getNode(newNodeId);
            if (!node) {continue;}
            
            // Set parent if exists
            if (nodeData.parentId) {
                const newParentId = idMap.get(nodeData.parentId);
                if (newParentId) {
                    const parentNode = graph.getNode(newParentId);
                    if (parentNode) {
                        node.setParent(newParentId);
                        // Also update parent's childIds array
                        if (!parentNode.childIds.includes(newNodeId)) {
                            parentNode.childIds.push(newNodeId);
                        }
                    }
                }
            }
        }
        
        // Rebuild root nodes to ensure consistency
        const allNodes = Array.from(graph.nodes.values());
        const rootNodeIds = allNodes
            .filter(node => !node.parentId)
            .map(node => node.id);
        
        // Update graph's rootNodes array
        (graph as any).rootNodes = rootNodeIds;
        
        // Set current node if specified
        if (jsonData.currentNodeId) {
            const newCurrentNodeId = idMap.get(jsonData.currentNodeId);
            if (newCurrentNodeId && graph.getNode(newCurrentNodeId)) {
                graph.setCurrentNode(newCurrentNodeId);
            }
        }
        
        return graph;
    }

    /**
     * Parses markdown structure (legacy format)
     */
    private parseMarkdownStructure(content: string): GraphModel {
        // Extract graph name from first heading
        const nameMatch = content.match(/^#\s+(.+)$/m);
        const graphName = nameMatch ? nameMatch[1].trim() : 'Imported Graph';
        
        // Generate new ID for imported graph
        const graphId = GraphModel.generateId();
        const graph = new GraphModel(graphId, graphName);
        
        // Parse the markdown structure to recreate nodes and relationships
        const lines = content.split('\n');
        const nodeStack: Array<{ node: any; depth: number }> = [];
        let currentNodeId = 1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip non-node lines
            if (!line.trim().startsWith('- **')) {
                continue;
            }
            
            // Calculate depth based on indentation
            const depth = (line.match(/^(\s*)/)?.[1]?.length || 0) / 2;
            
            // Extract node information
            const nodeMatch = line.match(/- \*\*(.+?)\*\* \((.+?):(\d+)\)/);
            if (!nodeMatch) {
                continue;
            }
            
            const [, nodeName, fileName, lineNumber] = nodeMatch;
            const filePath = fileName.includes('/') ? fileName : `./${fileName}`;
            
            // Extract code snippet if present
            let codeSnippet: string | undefined;
            if (i + 1 < lines.length && lines[i + 1].trim().startsWith('```')) {
                const codeStart = i + 1;
                let codeEnd = codeStart + 1;
                while (codeEnd < lines.length && !lines[codeEnd].trim().startsWith('```')) {
                    codeEnd++;
                }
                if (codeEnd < lines.length) {
                    codeSnippet = lines.slice(codeStart + 1, codeEnd).join('\n').trim();
                    i = codeEnd; // Skip processed lines
                }
            }
            
            // Create node
            const nodeId = `imported_node_${currentNodeId++}`;
            
            // Find parent based on depth
            let parentNode: any = null;
            while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].depth >= depth) {
                nodeStack.pop();
            }
            
            if (nodeStack.length > 0) {
                parentNode = nodeStack[nodeStack.length - 1].node;
            }
            
            // Create node
            const graphNode = new Node(
                nodeId,
                nodeName,
                filePath,
                parseInt(lineNumber, 10),
                codeSnippet
            );
            
            // Set parent-child relationship BEFORE adding to graph
            if (parentNode) {
                graphNode.setParent(parentNode.id);
                // Also add this node to parent's children list
                if (!parentNode.childIds.includes(nodeId)) {
                    parentNode.childIds.push(nodeId);
                }
            }
            
            // Add node to graph (will automatically handle rootNodes)
            graph.addNode(graphNode);
            
            // Add to stack for potential children
            nodeStack.push({ node: graphNode, depth });
        }
        
        return graph;
    }

    /**
     * Validates graph data before operations
     */
    private validateGraphData(graph: Graph): void {
        if (!graph) {
            throw new Error('Graph data is required');
        }
        
        if (!graph.id || typeof graph.id !== 'string') {
            throw new Error('Graph must have a valid ID');
        }
        
        if (!graph.name || typeof graph.name !== 'string') {
            throw new Error('Graph must have a valid name');
        }
        
        if (!graph.nodes) {
            throw new Error('Graph must have a nodes collection');
        }
        
        if (!Array.isArray(graph.rootNodes)) {
            throw new Error('Graph must have a rootNodes array');
        }
    }

    /**
     * Validates markdown content for import
     */
    private validateMarkdownContent(content: string): void {
        if (!content || typeof content !== 'string') {
            throw new Error('Markdown content must be a non-empty string');
        }

        if (content.trim().length === 0) {
            throw new Error('Markdown content cannot be empty');
        }

        // Check for basic markdown structure or JSON data
        const hasHeading = content.includes('#');
        const hasJSON = content.includes('```json');
        
        if (!hasHeading && !hasJSON) {
            throw new Error('Markdown content must contain at least one heading or embedded JSON data');
        }
    }

    /**
     * Validates export format
     */
    private validateExportFormat(format: string): void {
        const supportedFormats = ['md'];
        
        if (!format || typeof format !== 'string') {
            throw new Error('Export format must be specified');
        }

        if (!supportedFormats.includes(format)) {
            throw new Error(`Unsupported export format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
        }
    }

    /**
     * Validates imported graph structure
     */
    private validateImportedGraph(graph: GraphModel): void {
        try {
            graph.validate();
        } catch (error) {
            throw new Error(`Imported graph validation failed: ${error}`);
        }

        // Additional import-specific validations
        if (graph.getNodeCount() === 0) {
            console.warn('Imported graph contains no nodes');
        }

        // Check for reasonable limits
        const maxNodes = 1000; // Configurable limit
        if (graph.getNodeCount() > maxNodes) {
            throw new Error(`Imported graph exceeds maximum node limit of ${maxNodes}`);
        }
    }

    /**
     * Gets storage statistics
     */
    public async getStorageStats(): Promise<{ graphCount: number; totalSize: number; backupCount: number }> {
        try {
            return await this.storageManager.getStorageStats();
        } catch (error) {
            throw new Error(`Failed to get storage statistics: ${error}`);
        }
    }

    /**
     * Checks if workspace is accessible
     */
    public async isWorkspaceAccessible(): Promise<boolean> {
        try {
            return await this.storageManager.isWorkspaceAccessible();
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensures workspace directory structure exists
     */
    public async ensureWorkspaceSetup(): Promise<void> {
        try {
            await this.storageManager.ensureWorkspaceDirectory();
        } catch (error) {
            throw new Error(`Failed to setup workspace: ${error}`);
        }
    }

    /**
     * Exports multiple graphs to a single markdown file
     */
    public async exportMultipleGraphs(graphIds: string[], fileName?: string): Promise<string> {
        try {
            if (!Array.isArray(graphIds) || graphIds.length === 0) {
                throw new Error('Graph IDs array must be non-empty');
            }

            const graphs: GraphModel[] = [];
            
            // Load all graphs
            for (const graphId of graphIds) {
                const graph = await this.storageManager.loadGraphFromFile(graphId);
                graphs.push(graph);
            }

            // Generate combined markdown content
            const combinedContent = this.generateCombinedMarkdown(graphs);
            
            // Save to file
            const exportFileName = fileName || `combined_graphs_${Date.now()}.md`;
            const exportPath = await this.storageManager.exportGraphToMarkdown(
                graphs[0], // Use first graph for directory structure
                exportFileName
            );

            // Write the combined content
            const fs = require('fs/promises');
            await fs.writeFile(exportPath, combinedContent, 'utf8');

            return exportPath;
        } catch (error) {
            throw new Error(`Failed to export multiple graphs: ${error}`);
        }
    }

    /**
     * Imports a graph from a file path
     */
    public async importGraphFromFile(filePath: string): Promise<Graph> {
        try {
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('File path must be a non-empty string');
            }

            const fs = require('fs/promises');
            const content = await fs.readFile(filePath, 'utf8');
            
            return await this.importGraph(content);
        } catch (error) {
            throw new Error(`Failed to import graph from file ${filePath}: ${error}`);
        }
    }

    /**
     * Validates if a file contains valid graph markdown
     */
    public async validateGraphFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            if (!filePath || typeof filePath !== 'string') {
                errors.push('File path must be a non-empty string');
                return { valid: false, errors };
            }

            const fs = require('fs/promises');
            const content = await fs.readFile(filePath, 'utf8');
            
            this.validateMarkdownContent(content);
            
            // Try to parse the content
            const graph = this.parseMarkdownContent(content);
            this.validateImportedGraph(graph);
            
            return { valid: true, errors: [] };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            return { valid: false, errors };
        }
    }

    /**
     * Gets export statistics for a graph
     */
    public getExportStats(graph: Graph): { nodeCount: number; maxDepth: number; fileTypes: string[] } {
        if (!graph || !graph.nodes) {
            return { nodeCount: 0, maxDepth: 0, fileTypes: [] };
        }

        const nodes = Array.from(graph.nodes.values());
        const nodeCount = nodes.length;
        
        // Calculate max depth
        let maxDepth = 0;
        const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
            if (visited.has(nodeId)) {return 0;}
            visited.add(nodeId);
            
            const node = graph.nodes.get(nodeId);
            if (!node || !node.childIds || node.childIds.length === 0) {
                return 1;
            }
            
            let maxChildDepth = 0;
            for (const childId of node.childIds) {
                maxChildDepth = Math.max(maxChildDepth, calculateDepth(childId, new Set(visited)));
            }
            
            return 1 + maxChildDepth;
        };

        for (const rootNodeId of graph.rootNodes) {
            maxDepth = Math.max(maxDepth, calculateDepth(rootNodeId));
        }

        // Get unique file types
        const fileTypes = [...new Set(nodes.map(node => {
            const ext = node.filePath.split('.').pop()?.toLowerCase();
            return ext || 'unknown';
        }))];

        return { nodeCount, maxDepth, fileTypes };
    }

    /**
     * Generates combined markdown content for multiple graphs
     */
    private generateCombinedMarkdown(graphs: GraphModel[]): string {
        const lines: string[] = [];
        
        lines.push('# Combined Graphs Export');
        lines.push('');
        lines.push(`**Exported:** ${new Date().toISOString()}`);
        lines.push(`**Graphs:** ${graphs.length}`);
        lines.push('');
        
        for (let i = 0; i < graphs.length; i++) {
            const graph = graphs[i];
            lines.push(`## ${i + 1}. ${graph.name}`);
            lines.push('');
            lines.push(`**Created:** ${graph.createdAt.toISOString()}`);
            lines.push(`**Updated:** ${graph.updatedAt.toISOString()}`);
            lines.push(`**Nodes:** ${graph.nodes.size}`);
            lines.push('');
            
            // Add graph structure
            const rootNodes = Array.from(graph.nodes.values()).filter(node => node.parentId === null);
            
            if (rootNodes.length === 0) {
                lines.push('*No nodes in this graph*');
            } else {
                for (const rootNode of rootNodes) {
                    this.renderNodeMarkdownForCombined(rootNode, graph, lines, 0);
                }
            }
            
            lines.push('');
            lines.push('---');
            lines.push('');
        }
        
        return lines.join('\n');
    }

    /**
     * Renders a node and its children in markdown format for combined export
     */
    private renderNodeMarkdownForCombined(node: any, graph: GraphModel, lines: string[], depth: number): void {
        const indent = '  '.repeat(depth);
        const nodeInfo = `${indent}- **${node.name}** (${node.filePath.split('/').pop()}:${node.lineNumber})`;
        lines.push(nodeInfo);
        
        if (node.codeSnippet) {
            const ext = node.filePath.split('.').pop()?.toLowerCase() || 'text';
            lines.push(`${indent}  \`\`\`${ext}`);
            lines.push(`${indent}  ${node.codeSnippet}`);
            lines.push(`${indent}  \`\`\``);
        }
        
        // Render children
        for (const childId of node.childIds) {
            const childNode = graph.nodes.get(childId);
            if (childNode) {
                this.renderNodeMarkdownForCombined(childNode, graph, lines, depth + 1);
            }
        }
    }
}
