import { Graph, GraphMetadata } from '../types';

export interface IGraphManager {
    createGraph(name?: string): Promise<Graph>;
    loadGraph(graphId: string): Promise<Graph>;
    saveGraph(graph: Graph): Promise<void>;
    deleteGraph(graphId: string): Promise<void>;
    exportGraph(graph: Graph, format: 'md'): Promise<string>;
    importGraph(content: string): Promise<Graph>;
    listGraphs(): Promise<GraphMetadata[]>;
    getCurrentGraph(): Graph | null;
    setCurrentGraph(graph: Graph): void;
}