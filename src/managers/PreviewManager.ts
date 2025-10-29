import { Graph } from '../models/Graph';
import { TextRenderer } from '../renderers/TextRenderer';
import { MermaidRenderer } from '../renderers/MermaidRenderer';
import { ViewFormat } from '../types';
import { RootSymbolService } from '../services/RootSymbolService';
import { CodePathError } from '../types/errors';

/**
 * Preview manager for handling graph visualization and real-time updates
 * Manages rendering format switching and preview panel updates
 *
 * 负责图结构在文本与 Mermaid 两种格式间的渲染调度，统一管理预览内容的刷新节奏与错误上报。
 */
export class PreviewManager {
    private textRenderer: TextRenderer;
    private mermaidRenderer: MermaidRenderer;
    private currentFormat: ViewFormat;
    private currentGraph: Graph | null;
    private updateCallbacks: Array<(content: string, format: ViewFormat) => void>;
    private errorCallbacks: Array<(error: Error) => void>;
    private isUpdating: boolean;
    private updateTimeout: NodeJS.Timeout | null;
    private readonly debounceDelay: number;
    private lastRenderedContent: string = '';
    private lastRenderedFormat: ViewFormat = 'text';

    constructor(
        defaultFormat: ViewFormat = 'text',
        debounceDelay: number = 300,
        rootSymbolService?: RootSymbolService
    ) {
        this.textRenderer = new TextRenderer(rootSymbolService);
        this.mermaidRenderer = new MermaidRenderer();
        this.currentFormat = defaultFormat;
        this.currentGraph = null;
        this.updateCallbacks = [];
        this.errorCallbacks = [];
        this.isUpdating = false;
        this.updateTimeout = null;
        this.debounceDelay = debounceDelay;
    }

    /**
     * Sets the current graph and triggers preview update
     *
     * 当图数据发生变化时安排一次预览刷新，并尽量避免重复渲染未变更的图。
     */
    public setGraph(graph: Graph | null): void {
        // Check if graph actually changed to avoid unnecessary updates
        if (graph && this.currentGraph) {
            // Compare by ID and update timestamp
            if (this.currentGraph.id === graph.id &&
                this.currentGraph.updatedAt.getTime() === graph.updatedAt.getTime() &&
                this.currentGraph.getNodeCount() === graph.getNodeCount()) {
                // ID、更新时间和节点数量都未变化时视为同一版本，跳过渲染以节省资源
                // Graph hasn't changed, skip update
                return;
            }
        } else if (!graph && !this.currentGraph) {
            // Both null, no change
            return;
        }

        this.currentGraph = graph;
        this.scheduleUpdate();
    }

    /**
     * Gets the current graph
     */
    public getGraph(): Graph | null {
        return this.currentGraph;
    }

    /**
     * Sets the preview format and triggers update
     */
    public setFormat(format: ViewFormat): void {
        if (this.currentFormat !== format) {
            this.currentFormat = format;
            this.scheduleUpdate();
        }
    }

    /**
     * Gets the current preview format
     */
    public getFormat(): ViewFormat {
        return this.currentFormat;
    }

    /**
     * Toggles between text and mermaid formats
     */
    public toggleFormat(): ViewFormat {
        const newFormat: ViewFormat = this.currentFormat === 'text' ? 'mermaid' : 'text';
        this.setFormat(newFormat);
        return newFormat;
    }

    /**
     * Renders the current graph with the current format
     *
     * 根据当前格式选择对应渲染器，将最新的图结构转化为文本或 Mermaid 并推送到订阅者。
     */
    public async renderPreview(): Promise<string> {
        if (!this.currentGraph) {
            const emptyContent = this.renderEmptyPreview();
            // Only notify if content changed
            if (emptyContent !== this.lastRenderedContent || this.currentFormat !== this.lastRenderedFormat) {
                this.lastRenderedContent = emptyContent;
                this.lastRenderedFormat = this.currentFormat;
                this.notifyUpdateCallbacks(emptyContent, this.currentFormat);
            }
            return emptyContent;
        }

        try {
            this.isUpdating = true;

            let content: string;

            if (this.currentFormat === 'mermaid') {
                content = await this.renderMermaidPreview(this.currentGraph);
            } else {
                content = this.renderTextPreview(this.currentGraph);
            }

            // Only notify callbacks if content or format actually changed
            const contentChanged = content !== this.lastRenderedContent;
            const formatChanged = this.currentFormat !== this.lastRenderedFormat;
            console.log('[PreviewManager] Content changed:', contentChanged, 'Format changed:', formatChanged);
            
            if (contentChanged || formatChanged) {
                // 仅当渲染结果或展示格式确实发生变化时才广播通知，降低前端无效刷新概率
                this.lastRenderedContent = content;
                this.lastRenderedFormat = this.currentFormat;
                console.log('[PreviewManager] Notifying callbacks');
                this.notifyUpdateCallbacks(content, this.currentFormat);
            } else {
                console.log('[PreviewManager] No change, skipping callbacks');
            }

            return content;
        } catch (error) {
            const fallbackContent = await this.handleRenderError(error as Error);
            return fallbackContent;
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Renders text preview
     */
    private renderTextPreview(graph: Graph): string {
        return this.textRenderer.render(graph);
    }

    /**
     * Renders Mermaid preview with error handling
     *
     * 调用 Mermaid 渲染器，并在语法校验失败时返回可读性更好的错误信息。
     */
    private async renderMermaidPreview(graph: Graph): Promise<string> {
        try {
            const mermaidContent = this.mermaidRenderer.render(graph);

            // Validate Mermaid syntax
            const validationErrors = this.mermaidRenderer.validateSyntax(mermaidContent);
            if (validationErrors.length > 0) {
                throw CodePathError.renderingError(
                    `Mermaid validation errors: ${validationErrors.join(', ')}`,
                    new Error(validationErrors.join('; '))
                );
            }

            return mermaidContent;
        } catch (error) {
            // For large graphs, try simplified rendering
            if (graph.getNodeCount() > 50) {
                try {
                    return this.mermaidRenderer.renderSimplified(graph, 20);
                } catch (simplifiedError) {
                    throw error; // Throw original error if simplified also fails
                }
            }

            if (error instanceof CodePathError) {
                throw error;
            }

            throw CodePathError.renderingError(
                'Failed to render Mermaid preview',
                error as Error
            );
        }
    }

    /**
     * Renders empty preview message
     */
    private renderEmptyPreview(): string {
        if (this.currentFormat === 'mermaid') {
            return `\`\`\`mermaid
flowchart TD
    empty["No CodePath Selected\\nCreate or load a CodePath to see preview"]
    
    classDef emptyStyle fill:#f9f9f9,stroke:#ddd,stroke-width:2px,color:#666
    class empty emptyStyle
\`\`\``;
        } else {
            return 'No CodePath selected.\n\nCreate or load a CodePath to see the preview.';
        }
    }

    /**
     * Handles rendering errors with fallback to text format
     *
     * 捕获渲染异常，优先退回文本渲染并将错误信息透出给前端供调试。
     */
    private async handleRenderError(error: Error): Promise<string> {
        // Convert to CodePathError if not already
        const codePathError = error instanceof CodePathError
            ? error
            : CodePathError.renderingError('Preview rendering failed', error);

        this.notifyErrorCallbacks(codePathError);

        // If Mermaid rendering failed, fallback to text
        if (this.currentFormat === 'mermaid' && this.currentGraph) {
            try {
                const textContent = this.renderTextPreview(this.currentGraph);
                const fallbackMessage = `<!-- Mermaid rendering failed: ${codePathError.message} -->\n<!-- Showing text fallback -->\n\n${textContent}`;
                this.notifyUpdateCallbacks(fallbackMessage, 'text');
                return fallbackMessage;
            } catch (textError) {
                const textErrorMessage = textError instanceof Error ? textError.message : String(textError);
                const errorMessage = `Error rendering preview: ${codePathError.message}\nText fallback also failed: ${textErrorMessage}`;
                this.notifyUpdateCallbacks(errorMessage, this.currentFormat);
                return errorMessage;
            }
        }

        const errorMessage = `Error rendering preview: ${codePathError.userMessage}`;
        this.notifyUpdateCallbacks(errorMessage, this.currentFormat);
        return errorMessage;
    }

    /**
     * Schedules a debounced update
     *
     * 通过延迟调用 renderPreview，实现对频繁状态变更的抖动合并。
     */
    private scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            // 延迟期结束后再次确认渲染，避免在图数据连续变更时创建多余 Promise
            this.renderPreview().catch(error => {
                console.error('Preview update failed:', error);
            });
        }, this.debounceDelay);
    }

    /**
     * Forces immediate update without debouncing
     */
    public async forceUpdate(): Promise<string> {
        console.log('[PreviewManager] forceUpdate called');
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        // Clear cache to force re-render
        this.lastRenderedContent = '';
        this.lastRenderedFormat = this.currentFormat === 'text' ? 'mermaid' : 'text';
        
        console.log('[PreviewManager] Calling renderPreview');
        const result = await this.renderPreview();
        console.log('[PreviewManager] renderPreview completed, length:', result.length);
        return result;
    }

    /**
     * Registers a callback for preview updates
     */
    public onUpdate(callback: (content: string, format: ViewFormat) => void): void {
        this.updateCallbacks.push(callback);
    }

    /**
     * Registers a callback for rendering errors
     */
    public onError(callback: (error: Error) => void): void {
        this.errorCallbacks.push(callback);
    }

    /**
     * Removes an update callback
     */
    public removeUpdateCallback(callback: (content: string, format: ViewFormat) => void): void {
        const index = this.updateCallbacks.indexOf(callback);
        if (index !== -1) {
            this.updateCallbacks.splice(index, 1);
        }
    }

    /**
     * Removes an error callback
     */
    public removeErrorCallback(callback: (error: Error) => void): void {
        const index = this.errorCallbacks.indexOf(callback);
        if (index !== -1) {
            this.errorCallbacks.splice(index, 1);
        }
    }

    /**
     * Notifies all update callbacks
     */
    private notifyUpdateCallbacks(content: string, format: ViewFormat): void {
        for (const callback of this.updateCallbacks) {
            try {
                callback(content, format);
            } catch (error) {
                console.error('Update callback failed:', error);
            }
        }
    }

    /**
     * Notifies all error callbacks
     */
    private notifyErrorCallbacks(error: Error): void {
        for (const callback of this.errorCallbacks) {
            try {
                callback(error);
            } catch (callbackError) {
                console.error('Error callback failed:', callbackError);
            }
        }
    }

    /**
     * Checks if preview is currently updating
     */
    public isPreviewUpdating(): boolean {
        return this.isUpdating;
    }

    /**
     * Gets preview status information
     */
    public getStatus(): {
        isUpdating: boolean;
        format: ViewFormat;
        hasGraph: boolean;
        nodeCount: number;
    } {
        return {
            isUpdating: this.isUpdating,
            format: this.currentFormat,
            hasGraph: this.currentGraph !== null,
            nodeCount: this.currentGraph?.getNodeCount() || 0
        };
    }

    /**
     * Renders a path visualization for a specific node
     */
    public async renderNodePath(nodeId: string): Promise<string> {
        if (!this.currentGraph) {
            throw new Error('No graph available for path rendering');
        }

        if (this.currentFormat === 'mermaid') {
            return this.mermaidRenderer.renderSubgraph(this.currentGraph, nodeId, 2);
        } else {
            return this.textRenderer.renderPath(this.currentGraph, nodeId);
        }
    }

    /**
     * Renders a summary view of the current graph
     */
    public renderSummary(): string {
        if (!this.currentGraph) {
            return 'No graph loaded';
        }

        return this.textRenderer.renderSummary(this.currentGraph);
    }

    /**
     * Renders nodes grouped by file
     */
    public renderByFile(): string {
        if (!this.currentGraph) {
            return 'No graph loaded';
        }

        return this.textRenderer.renderByFile(this.currentGraph);
    }

    /**
     * Exports the current preview content
     */
    public async exportPreview(): Promise<{ content: string; format: ViewFormat; filename: string }> {
        const content = await this.renderPreview();
        const graphName = this.currentGraph?.name || 'untitled';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = this.currentFormat === 'mermaid' ? 'md' : 'txt';
        const filename = `${graphName}-preview-${timestamp}.${extension}`;

        return {
            content,
            format: this.currentFormat,
            filename
        };
    }

    /**
     * Clears all callbacks and timeouts
     */
    public dispose(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        this.updateCallbacks = [];
        this.errorCallbacks = [];
        this.currentGraph = null;
        this.isUpdating = false;
    }

    /**
     * Gets renderer-specific options for advanced rendering
     */
    public getRendererOptions(): {
        textRenderer: {
            renderPath: (nodeId: string) => string;
            renderSummary: () => string;
            renderByFile: () => string;
        };
        mermaidRenderer: {
            renderSimplified: (maxNodes?: number) => string;
            renderSubgraph: (nodeId: string, depth?: number) => string;
            validateSyntax: (content: string) => string[];
        };
    } {
        return {
            textRenderer: {
                renderPath: (nodeId: string) => {
                    if (!this.currentGraph) {
                        throw new Error('No graph available');
                    }
                    return this.textRenderer.renderPath(this.currentGraph, nodeId);
                },
                renderSummary: () => {
                    if (!this.currentGraph) {
                        throw new Error('No graph available');
                    }
                    return this.textRenderer.renderSummary(this.currentGraph);
                },
                renderByFile: () => {
                    if (!this.currentGraph) {
                        throw new Error('No graph available');
                    }
                    return this.textRenderer.renderByFile(this.currentGraph);
                }
            },
            mermaidRenderer: {
                renderSimplified: (maxNodes = 20) => {
                    if (!this.currentGraph) {
                        throw new Error('No graph available');
                    }
                    return this.mermaidRenderer.renderSimplified(this.currentGraph, maxNodes);
                },
                renderSubgraph: (nodeId: string, depth = 2) => {
                    if (!this.currentGraph) {
                        throw new Error('No graph available');
                    }
                    return this.mermaidRenderer.renderSubgraph(this.currentGraph, nodeId, depth);
                },
                validateSyntax: (content: string) => {
                    return this.mermaidRenderer.validateSyntax(content);
                }
            }
        };
    }
}
