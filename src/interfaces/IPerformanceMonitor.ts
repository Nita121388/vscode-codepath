/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
    maxNodes: number;
    warningThreshold: number;
    maxRenderTime: number;
    maxMemoryUsage: number;
    enableMonitoring: boolean;
}

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
    nodeCount: number;
    renderTime: number;
    memoryUsage: number;
    lastUpdate: Date;
    warnings: string[];
}

/**
 * Interface for performance monitoring in the CodePath extension
 */
export interface IPerformanceMonitor {
    /**
     * Check if the current graph size is within limits
     */
    checkNodeLimit(nodeCount: number): { allowed: boolean; warning?: string };

    /**
     * Monitor rendering performance
     */
    startRenderTimer(): string;
    endRenderTimer(timerId: string): number;

    /**
     * Check memory usage
     */
    checkMemoryUsage(): Promise<number>;

    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics;

    /**
     * Check if performance limits are exceeded
     */
    checkPerformanceLimits(nodeCount: number): Promise<string[]>;

    /**
     * Reset performance metrics
     */
    resetMetrics(): void;

    /**
     * Configure performance limits
     */
    configure(config: Partial<PerformanceConfig>): void;
}