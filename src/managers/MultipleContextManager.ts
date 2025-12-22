/**
 * @fileoverview MultipleContextManager - Core orchestrator for code context baskets
 *
 * Manages basket lifecycle, item operations, and exports for the Multiple Code Context feature.
 *
 * 多段代码上下文管理器 - 支持篮子生命周期、项目操作和导出功能
 */

import { StorageManager } from './StorageManager';
import { BasketHistoryManager } from './BasketHistoryManager';
import { CodeContextBasketModel, CodeContextItemModel } from '../models/CodeContextBasket';
import {
  CodeContextItem,
  CodeContextBasket,
  BasketOperationConfig,
  BasketHistorySummary,
  BasketHistorySource,
  BasketHistoryEntry
} from '../types/codeContext';

/**
 * MultipleContextManager coordinates all operations for code context baskets
 *
 * Responsibilities:
 * - Basket lifecycle (create, load, save, delete, list)
 * - Item management (add, remove, update, move)
 * - Export functionality (markdown, json, plaintext)
 * - Event notifications for UI updates
 */
export class MultipleContextManager {
  private currentBasket: CodeContextBasket | null = null;
  private baskets: Map<string, CodeContextBasket> = new Map();
  private storageManager: StorageManager;
  private config: BasketOperationConfig;
  private historyManager: BasketHistoryManager | null = null;

  // Event callbacks
  private basketChangedCallback: ((basket: CodeContextBasket) => void) | null = null;
  private itemsChangedCallback: ((items: CodeContextItem[]) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor(storageManager: StorageManager, config?: BasketOperationConfig, historyManager?: BasketHistoryManager) {
    this.storageManager = storageManager;
    this.config = {
      maxItemsPerBasket: 1000,
      maxCodeSnippetLength: 50000,
      autoSaveInterval: 2000,
      enableSnapshots: false,
      snapshotRetentionDays: 30,
      ...config
    };
    this.historyManager = historyManager || null;
  }

  /**
   * è®¾ç½®æˆ–æ›´æ–°åŽ†å²ç®¡ç†å™¨
   */
  public setHistoryManager(historyManager: BasketHistoryManager): void {
    this.historyManager = historyManager;
  }

  /**
   * èŽ·å–åŽ†å²ç®¡ç†å™¨
   */
  public getHistoryManager(): BasketHistoryManager | null {
    return this.historyManager;
  }

  /**
   * åˆ—å‡ºåŽ†å²æ‹·è´
   */
  public async getHistorySummaries(): Promise<BasketHistorySummary[]> {
    if (!this.historyManager) {
      return [];
    }
    return this.historyManager.listHistory();
  }

  /**
   * èŽ·å–å•æ¡åŽ†å²
   */
  public async getHistoryEntry(historyId: string): Promise<BasketHistoryEntry | null> {
    if (!this.historyManager) {
      return null;
    }
    return this.historyManager.loadHistoryEntry(historyId);
  }

  /**
   * æ›´æ–°åŽ†å²æœ¬èº«çš„å…ƒæ•°æ®
   */
  public async updateHistoryEntry(
    historyId: string,
    updates: Partial<Pick<BasketHistoryEntry, 'name' | 'description' | 'tags' | 'source'>>
  ): Promise<void> {
    if (!this.historyManager) {
      throw new Error('History manager is not available.');
    }
    await this.historyManager.updateHistoryMetadata(historyId, updates);
  }

  /**
   * æ¢å¤æˆ–æ·»åŠ åŽ†å²ç¯®å­ä¸ºå½“å‰çŠ¶æ€?
   */
  public async restoreBasketFromHistory(
    historyId: string,
    options?: { asNew?: boolean; rename?: string; setActive?: boolean }
  ): Promise<CodeContextBasket | null> {
    if (!this.historyManager) {
      throw new Error('History manager is not available.');
    }

    const restored = await this.historyManager.restoreHistoryEntry(historyId, {
      asNew: options?.asNew,
      rename: options?.rename
    });

    if (!restored) {
      return null;
    }

    const normalizedItems = restored.items.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }));

    const basketModel = new CodeContextBasketModel(
      restored.name,
      normalizedItems,
      restored.id,
      restored.createdAt,
      new Date(),
      restored.exportFormat,
      restored.description,
      restored.tags
    );

    this.baskets.set(basketModel.id, basketModel);

    if (options?.setActive !== false) {
      this.setCurrentBasket(basketModel);
    }

    await this.storageManager.saveBasketToFile(basketModel);
    return basketModel;
  }

  /**
   * åˆ é™¤åŽ†å²æ¡ç›®
   */
  public async deleteHistoryEntry(historyId: string): Promise<void> {
    if (!this.historyManager) {
      throw new Error('History manager is not available.');
    }
    await this.historyManager.deleteHistoryEntry(historyId);
  }

  /**
   * Initializes the manager by loading existing baskets
   * 初始化管理器，加载现有篮子
   */
  public async initialize(): Promise<void> {
    try {
      const basketList = await this.storageManager.listBaskets();

      for (const basketSummary of basketList) {
        try {
          const basket = await this.storageManager.loadBasketFromFile(basketSummary.id);
          this.baskets.set(basketSummary.id, basket);
        } catch (error) {
          console.warn(`Failed to load basket ${basketSummary.id}:`, error);
        }
      }

      console.log(`[MultipleContextManager] Initialized with ${this.baskets.size} baskets`);
    } catch (error) {
      console.warn('[MultipleContextManager] Failed to initialize:', error);
    }
  }

  // ==================== Basket Lifecycle ====================

  /**
   * Creates a new basket
   */
  public async createBasket(name: string, description?: string): Promise<CodeContextBasket> {
    try {
      const basket = new CodeContextBasketModel(
        name,
        [],
        undefined,
        undefined,
        undefined,
        'markdown',
        description
      );

      this.baskets.set(basket.id, basket);
      await this.storageManager.saveBasketToFile(basket);
      await this.recordHistorySnapshot('create', basket);

      return basket;
    } catch (error) {
      const err = new Error(`Failed to create basket: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Loads a specific basket from storage
   */
  public async loadBasket(basketId: string): Promise<CodeContextBasket> {
    try {
      const basket = await this.storageManager.loadBasketFromFile(basketId);
      this.currentBasket = basket;
      this.notifyBasketChanged(basket);
      return basket;
    } catch (error) {
      const err = new Error(`Failed to load basket ${basketId}: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Saves the current basket
   */
  public async saveBasket(basket?: CodeContextBasket): Promise<void> {
    try {
      const targetBasket = basket || this.currentBasket;
      if (!targetBasket) {
        throw new Error('No basket to save');
      }

      await this.storageManager.saveBasketToFile(targetBasket);
      this.notifyBasketChanged(targetBasket);
      await this.recordHistorySnapshot('save', targetBasket);
    } catch (error) {
      const err = new Error(`Failed to save basket: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Deletes a basket from storage
   */
  public async deleteBasket(basketId: string): Promise<void> {
    try {
      await this.storageManager.deleteBasketFile(basketId);
      this.baskets.delete(basketId);

      if (this.currentBasket?.id === basketId) {
        this.currentBasket = null;
      }

      console.log(`[MultipleContextManager] Deleted basket ${basketId}`);
      await this.deleteBasketHistoryEntries(basketId);
    } catch (error) {
      const err = new Error(`Failed to delete basket ${basketId}: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Lists all available baskets
   */
  public async listBaskets(): Promise<CodeContextBasket[]> {
    try {
      const basketList = await this.storageManager.listBaskets();
      return basketList.map(summary => this.baskets.get(summary.id)).filter((b): b is CodeContextBasket => !!b);
    } catch (error) {
      console.warn('[MultipleContextManager] Failed to list baskets:', error);
      return [];
    }
  }

  /**
   * Gets the current active basket
   */
  public getCurrentBasket(): CodeContextBasket | null {
    return this.currentBasket;
  }

  /**
   * Sets the current active basket
   */
  public setCurrentBasket(basket: CodeContextBasket): void {
    this.currentBasket = basket;
    this.notifyBasketChanged(basket);
  }

  // ==================== Item Operations ====================

  /**
   * Adds a new item to the current basket
   */
  public async addItem(item: CodeContextItem): Promise<CodeContextItem> {
    try {
      if (!this.currentBasket) {
        throw new Error('No active basket. Create or load a basket first.');
      }

      if (this.currentBasket.items.length >= this.config.maxItemsPerBasket!) {
        throw new Error(`Basket is full (max: ${this.config.maxItemsPerBasket} items)`);
      }

      if (item.code.length > this.config.maxCodeSnippetLength!) {
        throw new Error(
          `Code snippet exceeds maximum length of ${this.config.maxCodeSnippetLength} characters`
        );
      }

      const newItem = new CodeContextItemModel(
        item.code,
        item.filePath,
        item.lineNumber,
        item.note,
        this.currentBasket.items.length,
        item.language,
        item.lineEndNumber,
        item.id
      );

      this.currentBasket.items.push(newItem);
      await this.saveBasket();
      this.notifyItemsChanged(this.currentBasket.items);

      return newItem;
    } catch (error) {
      const err = new Error(`Failed to add item: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Removes an item from the current basket
   */
  public async removeItem(itemId: string): Promise<boolean> {
    try {
      if (!this.currentBasket) {
        throw new Error('No active basket');
      }

      const result = this.currentBasket.items.some((item, index) => {
        if (item.id === itemId) {
          this.currentBasket!.items.splice(index, 1);
          return true;
        }
        return false;
      });

      if (!result) {
        return false;
      }

      // Reorder items
      this.currentBasket.items.forEach((item, index) => {
        item.order = index;
      });

      this.currentBasket.updatedAt = new Date();
      await this.saveBasket();
      this.notifyItemsChanged(this.currentBasket.items);

      return true;
    } catch (error) {
      const err = new Error(`Failed to remove item: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Updates an item in the current basket
   */
  public async updateItem(itemId: string, updates: Partial<CodeContextItem>): Promise<CodeContextItem | null> {
    try {
      if (!this.currentBasket) {
        throw new Error('No active basket');
      }

      const item = this.currentBasket.items.find(i => i.id === itemId);
      if (!item) {
        return null;
      }

      // Validate code length if updating code
      if (updates.code && updates.code.length > this.config.maxCodeSnippetLength!) {
        throw new Error(`Code snippet exceeds maximum length of ${this.config.maxCodeSnippetLength} characters`);
      }

      Object.assign(item, updates);
      this.currentBasket.updatedAt = new Date();

      await this.saveBasket();
      this.notifyItemsChanged(this.currentBasket.items);

      return item;
    } catch (error) {
      const err = new Error(`Failed to update item: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Moves an item to a new position
   */
  public async moveItem(itemId: string, toIndex: number): Promise<boolean> {
    try {
      if (!this.currentBasket) {
        throw new Error('No active basket');
      }

      const currentIndex = this.currentBasket.items.findIndex(item => item.id === itemId);
      if (currentIndex === -1 || toIndex < 0 || toIndex >= this.currentBasket.items.length) {
        return false;
      }

      const [item] = this.currentBasket.items.splice(currentIndex, 1);
      this.currentBasket.items.splice(toIndex, 0, item);

      // Reorder items
      this.currentBasket.items.forEach((item, index) => {
        item.order = index;
      });

      this.currentBasket.updatedAt = new Date();
      await this.saveBasket();
      this.notifyItemsChanged(this.currentBasket.items);

      return true;
    } catch (error) {
      const err = new Error(`Failed to move item: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * Gets a specific item by ID
   */
  public getItem(itemId: string): CodeContextItem | undefined {
    if (!this.currentBasket) {
      return undefined;
    }
    return this.currentBasket.items.find(item => item.id === itemId);
  }

  /**
   * Clears all items from the current basket
   */
  public async clearBasket(): Promise<void> {
    try {
      if (!this.currentBasket) {
        throw new Error('No active basket');
      }

      this.currentBasket.items = [];
      this.currentBasket.updatedAt = new Date();
      await this.saveBasket();
      this.notifyItemsChanged([]);
    } catch (error) {
      const err = new Error(`Failed to clear basket: ${error}`);
      this.notifyError(err);
      throw err;
    }
  }

  // ==================== Export Functions ====================

  /**
   * Exports basket to Markdown format
   */
  public exportToMarkdown(basket?: CodeContextBasket): string {
    const targetBasket = basket || this.currentBasket;
    if (!targetBasket) {
      throw new Error('No basket to export');
    }

    const lines: string[] = [];

    // Header
    lines.push(`# Code Context Basket: ${targetBasket.name}`);
    lines.push('');
    lines.push(`**Created:** ${targetBasket.createdAt.toLocaleString()}`);
    lines.push(`**Updated:** ${targetBasket.updatedAt.toLocaleString()}`);
    lines.push(`**Items:** ${targetBasket.items.length}`);
    if (targetBasket.description) {
      lines.push(`**Description:** ${targetBasket.description}`);
    }
    lines.push('');

    // Items
    lines.push('---');
    lines.push('');

    targetBasket.items.forEach((item, index) => {
      lines.push(`## ${index + 1}. ${item.fileName || item.filePath}`);
      lines.push(`**Location:** ${item.filePath}:${item.lineNumber}${item.lineEndNumber ? `-${item.lineEndNumber}` : ''}`);
      if (item.note) {
        lines.push(`**Note:** ${item.note}`);
      }
      lines.push('');
      lines.push('```' + (item.language || ''));
      lines.push(item.code);
      lines.push('```');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Exports basket to JSON format
   */
  public exportToJson(basket?: CodeContextBasket): string {
    const targetBasket = basket || this.currentBasket;
    if (!targetBasket) {
      throw new Error('No basket to export');
    }

    const exportData = {
      name: targetBasket.name,
      description: targetBasket.description,
      createdAt: targetBasket.createdAt.toISOString(),
      updatedAt: targetBasket.updatedAt.toISOString(),
      itemCount: targetBasket.items.length,
      items: targetBasket.items.map(item => ({
        id: item.id,
        code: item.code,
        filePath: item.filePath,
        lineNumber: item.lineNumber,
        lineEndNumber: item.lineEndNumber,
        language: item.language,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
        order: item.order
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Exports basket to plain text format
   */
  public exportToPlaintext(basket?: CodeContextBasket): string {
    const targetBasket = basket || this.currentBasket;
    if (!targetBasket) {
      throw new Error('No basket to export');
    }

    const lines: string[] = [];

    // Header
    lines.push(`=== Code Context Basket: ${targetBasket.name} ===`);
    lines.push('');
    lines.push(`Created: ${targetBasket.createdAt.toLocaleString()}`);
    lines.push(`Updated: ${targetBasket.updatedAt.toLocaleString()}`);
    lines.push(`Total Items: ${targetBasket.items.length}`);
    if (targetBasket.description) {
      lines.push(`Description: ${targetBasket.description}`);
    }
    lines.push('');
    lines.push(''.repeat(80));
    lines.push('');

    // Items
    targetBasket.items.forEach((item, index) => {
      lines.push(`[${index + 1}] ${item.fileName || item.filePath}`);
      lines.push(`Location: ${item.filePath}:${item.lineNumber}${item.lineEndNumber ? `-${item.lineEndNumber}` : ''}`);
      if (item.note) {
        lines.push(`Note: ${item.note}`);
      }
      lines.push('');
      lines.push(item.code);
      lines.push('');
      lines.push(''.repeat(80));
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Exports basket in the specified format
   */
  public export(format: 'markdown' | 'json' | 'plaintext' = 'markdown', basket?: CodeContextBasket): string {
    switch (format) {
      case 'json':
        return this.exportToJson(basket);
      case 'plaintext':
        return this.exportToPlaintext(basket);
      case 'markdown':
      default:
        return this.exportToMarkdown(basket);
    }
  }

  // ==================== Event Handlers ====================

  /**
   * Registers a callback for basket changes
   */
  public registerBasketChangedCallback(callback: (basket: CodeContextBasket) => void): void {
    this.basketChangedCallback = callback;
  }

  /**
   * Registers a callback for item changes
   */
  public registerItemsChangedCallback(callback: (items: CodeContextItem[]) => void): void {
    this.itemsChangedCallback = callback;
  }

  /**
   * Registers a callback for errors
   */
  public registerErrorCallback(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Notifies basket change
   */
  private notifyBasketChanged(basket: CodeContextBasket): void {
    if (this.basketChangedCallback) {
      try {
        this.basketChangedCallback(basket);
      } catch (error) {
        console.warn('[MultipleContextManager] Error in basketChangedCallback:', error);
      }
    }
  }

  /**
   * Notifies items change
   */
  private notifyItemsChanged(items: CodeContextItem[]): void {
    if (this.itemsChangedCallback) {
      try {
        this.itemsChangedCallback(items);
      } catch (error) {
        console.warn('[MultipleContextManager] Error in itemsChangedCallback:', error);
      }
    }
  }

  /**
   * Notifies error
   */
  private notifyError(error: Error): void {
    if (this.errorCallback) {
      try {
        this.errorCallback(error);
      } catch (err) {
        console.warn('[MultipleContextManager] Error in errorCallback:', err);
      }
    }
  }

  /**
   * 记录历史
   */
  private async recordHistorySnapshot(
    source: BasketHistorySource | string,
    basket?: CodeContextBasket
  ): Promise<void> {
    if (!this.historyManager) {
      return;
    }

    const targetBasket = basket || this.currentBasket;
    if (!targetBasket) {
      return;
    }

    try {
      await this.historyManager.recordSnapshot(targetBasket, { source });
    } catch (error) {
      console.warn('[MultipleContextManager] Failed to record history snapshot:', error);
    }
  }

  /**
   * 删除与篮子相关的历史记录（永久删除）
   */
  private async deleteBasketHistoryEntries(basketId: string): Promise<void> {
    if (!this.historyManager) {
      return;
    }

    try {
      const summaries = await this.historyManager.listHistory();
      const related = summaries.filter(summary => summary.basketId === basketId);
      for (const summary of related) {
        await this.historyManager.deleteHistoryEntry(summary.historyId);
      }
    } catch (error) {
      console.warn('[MultipleContextManager] Failed to delete history entries:', error);
    }
  }
}
