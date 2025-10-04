/**
 * Core data model interfaces for CodePath extension
 */

export interface Node {
    id: string;
    name: string;
    filePath: string;
    fileName?: string;
    lineNumber: number;
    codeSnippet?: string;
    codeHash?: string;
    createdAt: Date;
    parentId: string | null;
    childIds: string[];
    validationWarning?: string; // Warning message from location validation
    description?: string; // Optional description for the node
}

export interface Graph {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    nodes: Map<string, Node>;
    rootNodes: string[];
    currentNodeId: string | null;
}

export interface GraphMetadata {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    nodeCount: number;
}

export interface Configuration {
    defaultView: 'text' | 'mermaid';
    autoSave: boolean;
    autoLoadLastGraph: boolean;
    previewRefreshInterval: number;
    maxNodesPerGraph: number;
    enableBackup: boolean;
    backupInterval: number;
}

export interface StatusBarInfo {
    currentGraph: string | null;
    currentNode: string | null;
    nodeCount: number;
    previewStatus: 'updating' | 'ready' | 'error';
}

export type ViewFormat = 'text' | 'mermaid';
export type ErrorCategory = 'user' | 'filesystem' | 'validation' | 'rendering';