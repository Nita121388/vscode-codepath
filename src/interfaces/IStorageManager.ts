import { Graph } from '../models/Graph';
import { Configuration } from '../types';

export interface IStorageManager {
    saveGraphToFile(graph: Graph): Promise<void>;
    loadGraphFromFile(graphId: string): Promise<Graph>;
    deleteGraphFile(graphId: string): Promise<void>;
    ensureWorkspaceDirectory(): Promise<void>;
    getGraphsDirectory(): string;
    backupGraph(graph: Graph): Promise<void>;
    restoreFromBackup(graphId: string): Promise<Graph>;
    saveConfiguration(config: Configuration): Promise<void>;
    loadConfiguration(): Promise<Configuration>;
    getCurrentGraphId(): Promise<string | null>;
    listGraphs(): Promise<Array<{ id: string; name: string; createdAt: Date; updatedAt: Date; nodeCount: number }>>;
    exportGraphToMarkdown(graph: Graph, fileName?: string): Promise<string>;
    isWorkspaceAccessible(): Promise<boolean>;
    getStorageStats(): Promise<{ graphCount: number; totalSize: number; backupCount: number }>;
}