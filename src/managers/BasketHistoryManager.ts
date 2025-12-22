/**
 * @fileoverview BasketHistoryManager - 负责 Code Context Basket 历史记录的采集与恢复
 */

import { randomUUID } from 'crypto';
import { StorageManager } from './StorageManager';
import {
  BasketHistoryEntry,
  BasketHistorySummary,
  BasketHistorySource,
  CodeContextBasket
} from '../types/codeContext';
import { CodeContextBasketModel } from '../models/CodeContextBasket';

type HistoryChangedCallback = (entries: BasketHistorySummary[]) => void;
type HistoryErrorCallback = (error: Error) => void;

interface RecordSnapshotOptions {
  source?: BasketHistorySource | string;
  nameOverride?: string;
  descriptionOverride?: string;
  tagsOverride?: string[];
}

interface RestoreOptions {
  asNew?: boolean;
  rename?: string;
}

/**
 * BasketHistoryManager 封装了历史快照的增删改查
 */
export class BasketHistoryManager {
  private storageManager: StorageManager;
  private historyChangedCallback: HistoryChangedCallback | null = null;
  private errorCallback: HistoryErrorCallback | null = null;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * 记录当前篮子的快照
   */
  public async recordSnapshot(
    basket: CodeContextBasket,
    options?: RecordSnapshotOptions
  ): Promise<BasketHistoryEntry> {
    try {
      const timestamp = new Date();
      const existingEntry = await this.findActiveEntryForBasket(basket.id);
      const description =
        options?.descriptionOverride !== undefined ? options.descriptionOverride : basket.description;
      const resolvedTags =
        options?.tagsOverride !== undefined
          ? options.tagsOverride
          : basket.tags
          ? [...basket.tags]
          : existingEntry?.tags;
      const tags = resolvedTags ? [...resolvedTags] : undefined;

      let entry: BasketHistoryEntry;
      if (existingEntry) {
        entry = existingEntry;
        entry.name = options?.nameOverride || basket.name;
        entry.description = description;
        entry.tags = tags;
        entry.source = options?.source || entry.source || 'save';
        entry.updatedAt = timestamp;
        entry.itemCount = basket.items.length;
        entry.snapshot = this.cloneBasket(basket);
      } else {
        entry = {
          historyId: randomUUID(),
          basketId: basket.id,
          name: options?.nameOverride || basket.name,
          description,
          tags,
          source: options?.source || 'save',
          createdAt: timestamp,
          updatedAt: timestamp,
          lastOpenedAt: undefined,
          itemCount: basket.items.length,
          snapshot: this.cloneBasket(basket)
        };
      }

      await this.storageManager.saveBasketHistoryEntry(entry);
      this.notifyHistoryChanged();
      return entry;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyError(err);
      throw err;
    }
  }

  /**
   * 获取历史摘要列表
   */
  public async listHistory(): Promise<BasketHistorySummary[]> {
    return this.storageManager.listBasketHistorySummaries();
  }

  /**
   * 加载单个历史条目
   */
  public async loadHistoryEntry(historyId: string): Promise<BasketHistoryEntry | null> {
    const entry = await this.storageManager.loadBasketHistoryEntry(historyId);
    if (!entry) {
      return null;
    }

    entry.lastOpenedAt = new Date();
    entry.updatedAt = new Date();
    await this.storageManager.saveBasketHistoryEntry(entry);
    this.notifyHistoryChanged();
    return entry;
  }

  /**
   * 根据历史快照恢复篮子
   */
  public async restoreHistoryEntry(
    historyId: string,
    options?: RestoreOptions
  ): Promise<CodeContextBasket | null> {
    const entry = await this.storageManager.loadBasketHistoryEntry(historyId);
    if (!entry) {
      return null;
    }

    const snapshot = entry.snapshot;
    const restored = new CodeContextBasketModel(
      options?.rename || snapshot.name,
      snapshot.items.map(item => ({ ...item, createdAt: new Date(item.createdAt) })),
      options?.asNew ? undefined : snapshot.id,
      options?.asNew ? undefined : new Date(snapshot.createdAt),
      new Date(),
      snapshot.exportFormat,
      snapshot.description,
      snapshot.tags ? [...snapshot.tags] : undefined
    );

    return restored.toJSON();
  }

  /**
   * 更新历史条目信息（重命名、标签等）
   */
  public async updateHistoryMetadata(
    historyId: string,
    updates: Partial<Pick<BasketHistoryEntry, 'name' | 'description' | 'tags' | 'source'>>
  ): Promise<BasketHistoryEntry | null> {
    const entry = await this.storageManager.loadBasketHistoryEntry(historyId);
    if (!entry) {
      return null;
    }

    if (typeof updates.name === 'string' && updates.name.trim().length > 0) {
      entry.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      entry.description = updates.description;
    }
    if (updates.tags) {
      entry.tags = [...updates.tags];
    }
    if (updates.source) {
      entry.source = updates.source;
    }

    entry.updatedAt = new Date();
    await this.storageManager.saveBasketHistoryEntry(entry);
    this.notifyHistoryChanged();
    return entry;
  }

  /**
   * 删除历史条目（永久删除）
   */
  public async deleteHistoryEntry(historyId: string): Promise<void> {
    await this.storageManager.deleteBasketHistoryEntry(historyId);
    this.notifyHistoryChanged();
  }

  /**
   * 注册历史变化回调
   */
  public registerHistoryChangedCallback(callback: HistoryChangedCallback): void {
    this.historyChangedCallback = callback;
  }

  /**
   * 注册错误回调
   */
  public registerErrorCallback(callback: HistoryErrorCallback): void {
    this.errorCallback = callback;
  }

  private cloneBasket(basket: CodeContextBasket): CodeContextBasket {
    return {
      id: basket.id,
      name: basket.name,
      items: basket.items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt)
      })),
      createdAt: new Date(basket.createdAt),
      updatedAt: new Date(basket.updatedAt),
      exportFormat: basket.exportFormat,
      description: basket.description,
      tags: basket.tags ? [...basket.tags] : undefined
    };
  }

  private async findActiveEntryForBasket(basketId: string): Promise<BasketHistoryEntry | null> {
    try {
      const summaries = await this.storageManager.listBasketHistorySummaries();
      const summary = summaries.find(entry => entry.basketId === basketId);
      if (!summary) {
        return null;
      }
      return this.storageManager.loadBasketHistoryEntry(summary.historyId);
    } catch (error) {
      console.warn('[BasketHistoryManager] Failed to locate history entry for basket:', error);
      return null;
    }
  }

  private notifyHistoryChanged(): void {
    if (!this.historyChangedCallback) {
      return;
    }

    this.listHistory()
      .then(entries => this.historyChangedCallback?.(entries))
      .catch(error => this.notifyError(error as Error));
  }

  private notifyError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}
