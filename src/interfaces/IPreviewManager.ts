import { Graph, ViewFormat } from '../types';

export interface IPreviewManager {
    renderPreview(graph: Graph, format: ViewFormat): Promise<string>;
    updatePreview(): Promise<void>;
    setPreviewFormat(format: ViewFormat): void;
    getPreviewFormat(): ViewFormat;
    showPreview(): void;
    hidePreview(): void;
}

export interface IRenderer {
    render(graph: Graph): string;
}