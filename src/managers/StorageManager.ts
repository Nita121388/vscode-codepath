import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Configuration, RootSymbolPreferences } from '../types';
import { Graph } from '../models/Graph';
import { IStorageManager } from '../interfaces/IStorageManager';
import { Graph as GraphModel } from '../models/Graph';

/**
 * StorageManager handles file system operations for graph persistence,
 * workspace directory management, and backup/recovery mechanisms
 */
export class StorageManager implements IStorageManager {
    private readonly workspaceRoot: string;
    private readonly codepathDir: string;
    private readonly graphsDir: string;
    private readonly backupDir: string;
    private readonly configFile: string;
    private readonly exportsDir: string;

    constructor(workspaceRoot?: string) {
        // Use provided workspace root or get from VS Code
        this.workspaceRoot = workspaceRoot || this.getWorkspaceRoot();
        this.codepathDir = path.join(this.workspaceRoot, '.codepath');
        this.graphsDir = path.join(this.codepathDir, 'graphs');
        this.backupDir = path.join(this.codepathDir, 'backup');
        this.exportsDir = path.join(this.codepathDir, 'exports');
        this.configFile = path.join(this.codepathDir, 'config.json');
    }

    /**
     * 获取当前工作区根目录
     */
    public getWorkspaceRootPath(): string {
        return this.workspaceRoot;
    }

    /**
     * 检查指定路径在磁盘上是否存在
     */
    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath);
            return true;
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError && nodeError.code && nodeError.code !== 'ENOENT') {
                throw nodeError;
            }
            return false;
        }
    }

    /**
     * 判断工作区的 .codepath 目录是否已经存在
     */
    public async workspaceDirectoryExists(): Promise<boolean> {
        return this.pathExists(this.codepathDir);
    }

    /**
     * Gets the workspace root directory from VS Code
     */
    private getWorkspaceRoot(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder is open');
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Ensures the workspace .codepath directory structure exists
     */
    public async ensureWorkspaceDirectory(): Promise<void> {
        try {
            // Create main .codepath directory
            await this.ensureDirectoryExists(this.codepathDir);
            
            // Create subdirectories
            await this.ensureDirectoryExists(this.graphsDir);
            await this.ensureDirectoryExists(this.backupDir);
            await this.ensureDirectoryExists(this.exportsDir);

            // Create default config if it doesn't exist
            await this.ensureDefaultConfig();
        } catch (error) {
            throw new Error(`Failed to create workspace directory structure: ${error}`);
        }
    }

    /**
     * Ensures a directory exists, creating it if necessary
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * 获取根节点符号的默认配置
     */
    private getDefaultRootSymbolPreferences(): RootSymbolPreferences {
        return {
            enableHolidayThemes: true,
            enableSeasonalThemes: true,
            customSymbolMode: 'fallback',
            customSymbols: [],
            customSelectionStrategy: 'daily'
        };
    }

    /**
     * 构建默认配置对象
     */
    private buildDefaultConfiguration(): Configuration {
        return {
            defaultView: 'text',
            autoSave: true,
            autoLoadLastGraph: true,
            autoOpenPreviewOnStartup: true,
            previewRefreshInterval: 1000,
            maxNodesPerGraph: 100,
            enableBackup: true,
            backupInterval: 300000,
            rootSymbolPreferences: this.getDefaultRootSymbolPreferences(),
            aiEndpointAutoStart: false,
            aiEndpointPort: 4783
        };
    }

    /**
     * Creates default configuration file if it doesn't exist
     */
    private async ensureDefaultConfig(): Promise<void> {
        try {
            await fs.access(this.configFile);
        } catch {
            const defaultConfig = this.buildDefaultConfiguration();
            // Write directly to avoid circular call to ensureWorkspaceDirectory
            await fs.writeFile(this.configFile, JSON.stringify(defaultConfig, null, 2), 'utf8');
        }
    }

    /**
     * Gets the graphs directory path
     */
    public getGraphsDirectory(): string {
        return this.graphsDir;
    }

    /**
     * Saves a graph to file
     */
    public async saveGraphToFile(graph: Graph): Promise<void> {
        try {
            await this.ensureWorkspaceDirectory();
            
            const graphFile = path.join(this.graphsDir, `${graph.id}.json`);
            const graphData = this.serializeGraph(graph);
            
            await fs.writeFile(graphFile, JSON.stringify(graphData, null, 2), 'utf8');
            
            // Update current graph reference
            await this.updateCurrentGraphReference(graph.id);
            
        } catch (error) {
            throw new Error(`Failed to save graph ${graph.id}: ${error}`);
        }
    }

    /**
     * Loads a graph from file
     */
    public async loadGraphFromFile(graphId: string): Promise<Graph> {
        try {
            const graphFile = path.join(this.graphsDir, `${graphId}.json`);
            
            // Check if file exists
            await fs.access(graphFile);
            
            const fileContent = await fs.readFile(graphFile, 'utf8');
            const graphData = JSON.parse(fileContent);
            
            return this.deserializeGraph(graphData);
            
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                throw new Error(`Graph file not found: ${graphId}`);
            }
            throw new Error(`Failed to load graph ${graphId}: ${error}`);
        }
    }

    /**
     * Deletes a graph file
     */
    public async deleteGraphFile(graphId: string): Promise<void> {
        try {
            const graphFile = path.join(this.graphsDir, `${graphId}.json`);
            
            // Check if file exists before attempting to delete
            await fs.access(graphFile);
            await fs.unlink(graphFile);
            
            // Clean up backup files for this graph
            await this.cleanupBackupFiles(graphId);
            
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                throw new Error(`Graph file not found: ${graphId}`);
            }
            throw new Error(`Failed to delete graph ${graphId}: ${error}`);
        }
    }

    /**
     * Creates a backup of a graph
     */
    public async backupGraph(graph: Graph): Promise<void> {
        try {
            await this.ensureWorkspaceDirectory();
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `${graph.id}-${timestamp}.json`);
            
            const graphData = this.serializeGraph(graph);
            await fs.writeFile(backupFile, JSON.stringify(graphData, null, 2), 'utf8');
            
            // Clean up old backups to prevent disk space issues
            await this.cleanupOldBackups(graph.id);
            
        } catch (error) {
            throw new Error(`Failed to backup graph ${graph.id}: ${error}`);
        }
    }

    /**
     * Restores a graph from backup
     */
    public async restoreFromBackup(graphId: string): Promise<Graph> {
        try {
            // Find the most recent backup file for this graph
            const backupFiles = await this.getBackupFiles(graphId);
            
            if (backupFiles.length === 0) {
                throw new Error(`No backup files found for graph ${graphId}`);
            }
            
            // Sort by modification time (most recent first)
            backupFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            
            const latestBackup = backupFiles[0];
            const fileContent = await fs.readFile(latestBackup.path, 'utf8');
            const graphData = JSON.parse(fileContent);
            
            return this.deserializeGraph(graphData);
            
        } catch (error) {
            throw new Error(`Failed to restore graph ${graphId} from backup: ${error}`);
        }
    }

    /**
     * Gets list of backup files for a specific graph
     */
    private async getBackupFiles(graphId: string): Promise<Array<{ path: string; mtime: Date }>> {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles: Array<{ path: string; mtime: Date }> = [];
            
            for (const file of files) {
                if (file.startsWith(`${graphId}-`) && file.endsWith('.json')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    backupFiles.push({
                        path: filePath,
                        mtime: stats.mtime
                    });
                }
            }
            
            return backupFiles;
        } catch (error) {
            return [];
        }
    }

    /**
     * Cleans up old backup files, keeping only the 10 most recent
     */
    private async cleanupOldBackups(graphId: string): Promise<void> {
        try {
            const backupFiles = await this.getBackupFiles(graphId);
            
            if (backupFiles.length <= 10) {
                return; // Keep all if 10 or fewer
            }
            
            // Sort by modification time (newest first)
            backupFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            
            // Delete files beyond the 10 most recent
            const filesToDelete = backupFiles.slice(10);
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                } catch (error) {
                    // Continue cleanup even if individual file deletion fails
                    console.warn(`Failed to delete backup file ${file.path}: ${error}`);
                }
            }
        } catch (error) {
            // Don't throw error for cleanup failures
            console.warn(`Failed to cleanup old backups for graph ${graphId}: ${error}`);
        }
    }

    /**
     * Cleans up all backup files for a specific graph
     */
    private async cleanupBackupFiles(graphId: string): Promise<void> {
        try {
            const backupFiles = await this.getBackupFiles(graphId);
            
            for (const file of backupFiles) {
                try {
                    await fs.unlink(file.path);
                } catch (error) {
                    console.warn(`Failed to delete backup file ${file.path}: ${error}`);
                }
            }
        } catch (error) {
            console.warn(`Failed to cleanup backup files for graph ${graphId}: ${error}`);
        }
    }

    /**
     * Updates the current graph reference file
     */
    private async updateCurrentGraphReference(graphId: string): Promise<void> {
        try {
            const currentGraphFile = path.join(this.graphsDir, 'current-graph.json');
            const currentGraphData = { currentGraphId: graphId, lastUpdated: new Date().toISOString() };
            
            await fs.writeFile(currentGraphFile, JSON.stringify(currentGraphData, null, 2), 'utf8');
        } catch (error) {
            // Don't throw error for current graph reference update failures
            console.warn(`Failed to update current graph reference: ${error}`);
        }
    }

    /**
     * Gets the current graph ID from reference file
     */
    public async getCurrentGraphId(): Promise<string | null> {
        try {
            const currentGraphFile = path.join(this.graphsDir, 'current-graph.json');
            const fileContent = await fs.readFile(currentGraphFile, 'utf8');
            const data = JSON.parse(fileContent);
            return data.currentGraphId || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Lists all available graphs
     */
    public async listGraphs(): Promise<Array<{ id: string; name: string; createdAt: Date; updatedAt: Date; nodeCount: number }>> {
        try {
            const hasWorkspaceDirectory = await this.workspaceDirectoryExists();
            if (!hasWorkspaceDirectory) {
                return [];
            }

            const hasGraphsDirectory = await this.pathExists(this.graphsDir);
            if (!hasGraphsDirectory) {
                return [];
            }
            
            const files = await fs.readdir(this.graphsDir);
            const graphFiles = files.filter(file => file.endsWith('.json') && file !== 'current-graph.json');
            
            const graphs = [];
            
            for (const file of graphFiles) {
                try {
                    const graphId = path.basename(file, '.json');
                    const filePath = path.join(this.graphsDir, file);
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const graphData = JSON.parse(fileContent);
                    
                    graphs.push({
                        id: graphId,
                        name: graphData.name,
                        createdAt: new Date(graphData.createdAt),
                        updatedAt: new Date(graphData.updatedAt),
                        nodeCount: Object.keys(graphData.nodes || {}).length
                    });
                } catch (error) {
                    console.warn(`Failed to read graph file ${file}: ${error}`);
                }
            }
            
            return graphs;
        } catch (error) {
            throw new Error(`Failed to list graphs: ${error}`);
        }
    }

    /**
     * Saves configuration to file
     */
    public async saveConfiguration(config: Configuration): Promise<void> {
        try {
            await this.ensureWorkspaceDirectory();
            await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf8');
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error}`);
        }
    }

    /**
     * Loads configuration from file
     */
    public async loadConfiguration(): Promise<Configuration> {
        try {
            const fileContent = await fs.readFile(this.configFile, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            // Return default configuration if file doesn't exist or is corrupted
            return this.buildDefaultConfiguration();
        }
    }

    /**
     * Exports a graph to markdown format
     */
    public async exportGraphToMarkdown(graph: Graph, fileName?: string): Promise<string> {
        try {
            await this.ensureWorkspaceDirectory();
            
            const exportFileName = fileName || `${graph.name.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
            const exportPath = path.join(this.exportsDir, exportFileName);
            
            const markdownContent = this.generateMarkdownContent(graph);
            await fs.writeFile(exportPath, markdownContent, 'utf8');
            
            return exportPath;
        } catch (error) {
            throw new Error(`Failed to export graph to markdown: ${error}`);
        }
    }

    /**
     * Generates markdown content from graph data
     */
    private generateMarkdownContent(graph: Graph): string {
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
                this.renderNodeMarkdown(rootNode, graph, lines, 0);
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
    private serializeGraphForExport(graph: Graph): any {
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
    private renderNodeMarkdown(node: any, graph: Graph, lines: string[], depth: number): void {
        const indent = '  '.repeat(depth);
        const nodeInfo = `${indent}- **${node.name}** (${path.basename(node.filePath)}:${node.lineNumber})`;
        lines.push(nodeInfo);
        
        if (node.codeSnippet) {
            lines.push(`${indent}  \`\`\`${this.getFileExtension(node.filePath)}`);
            lines.push(`${indent}  ${node.codeSnippet}`);
            lines.push(`${indent}  \`\`\``);
        }
        
        // Render children
        for (const childId of node.childIds) {
            const childNode = graph.nodes.get(childId);
            if (childNode) {
                this.renderNodeMarkdown(childNode, graph, lines, depth + 1);
            }
        }
    }

    /**
     * Gets file extension for syntax highlighting
     */
    private getFileExtension(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const extensionMap: Record<string, string> = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala'
        };
        
        return extensionMap[ext] || 'text';
    }

    /**
     * Serializes a graph for storage
     */
    private serializeGraph(graph: Graph): any {
        const nodesObject: { [key: string]: any } = {};
        
        // Convert Map to plain object for JSON serialization
        for (const [id, node] of graph.nodes) {
            nodesObject[id] = {
                id: node.id,
                name: node.name,
                filePath: node.filePath,
                lineNumber: node.lineNumber,
                codeSnippet: node.codeSnippet,
                createdAt: node.createdAt.toISOString(),
                parentId: node.parentId,
                childIds: [...node.childIds],
                validationWarning: node.validationWarning,
                description: node.description
            };
        }
        
        return {
            id: graph.id,
            name: graph.name,
            createdAt: graph.createdAt.toISOString(),
            updatedAt: graph.updatedAt.toISOString(),
            nodes: nodesObject,
            rootNodes: [...graph.rootNodes],
            currentNodeId: graph.currentNodeId
        };
    }

    /**
     * Deserializes a graph from storage
     */
    private deserializeGraph(data: any): Graph {
        return GraphModel.fromJSON({
            id: data.id,
            name: data.name,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            nodes: new Map(Object.entries(data.nodes).map(([id, nodeData]: [string, any]) => [
                id,
                {
                    id: nodeData.id,
                    name: nodeData.name,
                    filePath: nodeData.filePath,
                    lineNumber: nodeData.lineNumber,
                    codeSnippet: nodeData.codeSnippet,
                    createdAt: new Date(nodeData.createdAt),
                    parentId: nodeData.parentId,
                    childIds: [...nodeData.childIds],
                    validationWarning: nodeData.validationWarning,
                    description: nodeData.description
                }
            ])),
            rootNodes: [...data.rootNodes],
            currentNodeId: data.currentNodeId
        });
    }

    /**
     * Checks if workspace directory exists and is accessible
     */
    public async isWorkspaceAccessible(): Promise<boolean> {
        try {
            await fs.access(this.workspaceRoot);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Gets storage statistics
     */
    public async getStorageStats(): Promise<{ graphCount: number; totalSize: number; backupCount: number }> {
        try {
            const graphs = await this.listGraphs();
            const graphCount = graphs.length;
            
            // Calculate total size of graph files
            let totalSize = 0;
            const files = await fs.readdir(this.graphsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.graphsDir, file);
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                }
            }
            
            // Count backup files
            let backupCount = 0;
            try {
                const backupFiles = await fs.readdir(this.backupDir);
                backupCount = backupFiles.filter(file => file.endsWith('.json')).length;
            } catch {
                backupCount = 0;
            }
            
            return { graphCount, totalSize, backupCount };
        } catch (error) {
            return { graphCount: 0, totalSize: 0, backupCount: 0 };
        }
    }
}
