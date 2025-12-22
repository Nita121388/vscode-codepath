/**
 * @fileoverview Type definitions for Multiple Code Context Manager
 *
 * Defines data structures for managing multiple code snippets with notes,
 * including basket containers and context items.
 *
 * 多段代码上下文管理系统的类型定义，包括篮子容器和代码片段项。
 */

/**
 * Single code context item with code, location, and user notes
 * 单个代码上下文项，包含代码、位置和用户注释
 */
export interface CodeContextItem {
  /** Unique identifier for this item (UUID) */
  id: string;

  /** Code snippet content */
  code: string;

  /** Source file path */
  filePath: string;

  /** Starting line number (1-indexed) */
  lineNumber: number;

  /** Ending line number (optional, 1-indexed) */
  lineEndNumber?: number;

  /** Programming language for syntax highlighting */
  language?: string;

  /** User's note/comment about this code */
  note: string;

  /** Timestamp when this item was created */
  createdAt: Date;

  /** Order/position in the basket (used for custom sorting) */
  order: number;

  /** Optional: filename extracted from filepath for quick display */
  fileName?: string;
}

/**
 * Export format type for basket content
 */
export type ExportFormat = 'markdown' | 'plaintext' | 'json';

/**
 * Basket configuration and state
 */
export interface CodeContextBasket {
  /** Unique identifier for this basket (UUID) */
  id: string;

  /** User-defined name for this basket */
  name: string;

  /** Array of code context items in this basket */
  items: CodeContextItem[];

  /** Timestamp when basket was created */
  createdAt: Date;

  /** Timestamp when basket was last updated */
  updatedAt: Date;

  /** Default export format preference */
  exportFormat?: ExportFormat;

  /** Optional: description of what this basket contains */
  description?: string;

  /** Optional: tags for organizing baskets */
  tags?: string[];
}

/**
 * Metadata for basket collection
 * 篮子集合的元数据，用于快速查询
 */
export interface BasketMetadata {
  /** Total number of baskets */
  count: number;

  /** Array of basket summaries for quick listing */
  baskets: Array<{
    id: string;
    name: string;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

  /** Last accessed basket ID */
  lastAccessedBasketId?: string;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Configuration for basket operations
 * 篮子操作的配置
 */
export interface BasketOperationConfig {
  /** Maximum items per basket (default: 1000) */
  maxItemsPerBasket?: number;

  /** Maximum code snippet length (default: 50000 chars) */
  maxCodeSnippetLength?: number;

  /** Auto-save interval in milliseconds (default: 2000ms) */
  autoSaveInterval?: number;

  /** Enable basket snapshots */
  enableSnapshots?: boolean;

  /** Snapshot retention days */
  snapshotRetentionDays?: number;
}

/**
 * 历史快照记录来源
 */
export type BasketHistorySource = 'create' | 'save' | 'manual' | 'import' | 'restore';

/**
 * 历史记录条目
 * ç”¨äºŽè®°å½•æ¯æ¬¡ç¯®å­çš„å¿«ç…§ä¸Žå…ƒæ•°æ®
 */
export interface BasketHistoryEntry {
  historyId: string;
  basketId: string;
  name: string;
  description?: string;
  tags?: string[];
  source?: BasketHistorySource | string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt?: Date;
  itemCount: number;
  snapshot: CodeContextBasket;
}

/**
 * 历史记录列表项（无快照）
 */
export interface BasketHistorySummary {
  historyId: string;
  basketId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt?: Date;
  itemCount: number;
  tags?: string[];
  source?: BasketHistorySource | string;
}

/**
 * 历史索引文件结构
 */
export interface BasketHistoryIndex {
  version: number;
  updatedAt: Date;
  entries: Array<{
    historyId: string;
    basketId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    lastOpenedAt?: Date;
    itemCount: number;
    tags?: string[];
    source?: BasketHistorySource | string;
  }>;
}
