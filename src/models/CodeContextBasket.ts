/**
 * @fileoverview CodeContextBasket model class
 *
 * Represents a collection of code context items with validation and utility methods.
 * 代表代码上下文项目的集合，支持验证和实用方法。
 */

import { randomUUID } from 'crypto';
import { CodeContextItem, CodeContextBasket, ExportFormat } from '../types/codeContext';

/**
 * CodeContextItem class with validation
 * 带有验证的代码上下文项目类
 */
export class CodeContextItemModel implements CodeContextItem {
  public readonly id: string;
  public code: string;
  public filePath: string;
  public lineNumber: number;
  public lineEndNumber?: number;
  public language?: string;
  public note: string;
  public readonly createdAt: Date;
  public order: number;
  public fileName?: string;

  constructor(
    code: string,
    filePath: string,
    lineNumber: number,
    note: string,
    order: number = 0,
    language?: string,
    lineEndNumber?: number,
    id?: string,
    createdAt?: Date,
    fileName?: string
  ) {
    this.validateCode(code);
    this.validateFilePath(filePath);
    this.validateLineNumber(lineNumber);
    if (lineEndNumber !== undefined) {
      this.validateLineEndNumber(lineEndNumber, lineNumber);
    }

    this.id = id || randomUUID();
    this.code = code;
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.lineEndNumber = lineEndNumber;
    this.language = language;
    this.note = note;
    this.order = order;
    this.createdAt = createdAt || new Date();
    this.fileName = fileName || this.extractFileName(filePath);
  }

  /**
   * Validates code snippet is not empty
   */
  private validateCode(code: string): void {
    if (!code || typeof code !== 'string') {
      throw new Error('Code snippet must be a non-empty string');
    }
    if (code.trim().length === 0) {
      throw new Error('Code snippet cannot be empty or whitespace-only');
    }
  }

  /**
   * Validates file path format
   */
  private validateFilePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }
    if (filePath.trim().length === 0) {
      throw new Error('File path cannot be empty or whitespace-only');
    }
  }

  /**
   * Validates line number is positive
   */
  private validateLineNumber(lineNumber: number): void {
    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      throw new Error('Line number must be a positive integer');
    }
  }

  /**
   * Validates line end number is greater than start line
   */
  private validateLineEndNumber(lineEndNumber: number, lineNumber: number): void {
    if (!Number.isInteger(lineEndNumber) || lineEndNumber < lineNumber) {
      throw new Error('Line end number must be >= start line number');
    }
  }

  /**
   * Extracts filename from full path
   */
  private extractFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Returns a plain object representation for serialization
   */
  public toJSON(): CodeContextItem {
    return {
      id: this.id,
      code: this.code,
      filePath: this.filePath,
      lineNumber: this.lineNumber,
      lineEndNumber: this.lineEndNumber,
      language: this.language,
      note: this.note,
      createdAt: this.createdAt,
      order: this.order,
      fileName: this.fileName
    };
  }
}

/**
 * CodeContextBasket class with validation and utility methods
 * 带有验证和实用方法的代码上下文篮子类
 */
export class CodeContextBasketModel implements CodeContextBasket {
  public readonly id: string;
  public name: string;
  public items: CodeContextItem[];
  public readonly createdAt: Date;
  public updatedAt: Date;
  public exportFormat?: ExportFormat;
  public description?: string;
  public tags?: string[];

  private readonly maxItemsPerBasket: number = 1000;
  private readonly maxCodeSnippetLength: number = 50000;

  constructor(
    name: string,
    items: CodeContextItem[] = [],
    id?: string,
    createdAt?: Date,
    updatedAt?: Date,
    exportFormat?: ExportFormat,
    description?: string,
    tags?: string[]
  ) {
    this.validateName(name);

    this.id = id || randomUUID();
    this.name = name;
    this.items = items;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.exportFormat = exportFormat || 'markdown';
    this.description = description;
    this.tags = tags || [];

    // Validate items on initialization
    this.validateItems();
  }

  /**
   * Validates basket name
   */
  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Basket name must be a non-empty string');
    }
    if (name.trim().length === 0) {
      throw new Error('Basket name cannot be empty or whitespace-only');
    }
    if (name.length > 100) {
      throw new Error('Basket name must not exceed 100 characters');
    }
  }

  /**
   * Validates items array and item count
   */
  private validateItems(): void {
    if (!Array.isArray(this.items)) {
      throw new Error('Items must be an array');
    }

    if (this.items.length > this.maxItemsPerBasket) {
      throw new Error(
        `Too many items in basket. Maximum: ${this.maxItemsPerBasket}, Got: ${this.items.length}`
      );
    }

    // Validate each item's code length
    this.items.forEach((item, index) => {
      if (item.code.length > this.maxCodeSnippetLength) {
        throw new Error(
          `Item ${index}: Code snippet exceeds maximum length of ${this.maxCodeSnippetLength} characters`
        );
      }
    });
  }

  /**
   * Adds an item to the basket
   */
  public addItem(item: CodeContextItem): void {
    if (this.items.length >= this.maxItemsPerBasket) {
      throw new Error(`Basket is full (max: ${this.maxItemsPerBasket} items)`);
    }

    if (item.code.length > this.maxCodeSnippetLength) {
      throw new Error(`Code snippet exceeds maximum length of ${this.maxCodeSnippetLength} characters`);
    }

    // Set order based on current items count
    item.order = this.items.length;

    this.items.push(item);
    this.updatedAt = new Date();
  }

  /**
   * Removes an item by ID
   */
  public removeItem(itemId: string): boolean {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index === -1) {
      return false;
    }

    this.items.splice(index, 1);
    this.reorderItems();
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Updates an item by ID
   */
  public updateItem(itemId: string, updates: Partial<CodeContextItem>): boolean {
    const item = this.items.find(i => i.id === itemId);
    if (!item) {
      return false;
    }

    // Validate updates if code is being changed
    if (updates.code && updates.code.length > this.maxCodeSnippetLength) {
      throw new Error(`Code snippet exceeds maximum length of ${this.maxCodeSnippetLength} characters`);
    }

    // Apply updates
    Object.assign(item, updates);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Finds an item by ID
   */
  public getItem(itemId: string): CodeContextItem | undefined {
    return this.items.find(item => item.id === itemId);
  }

  /**
   * Moves an item to a new position
   */
  public moveItem(itemId: string, toIndex: number): boolean {
    const currentIndex = this.items.findIndex(item => item.id === itemId);
    if (currentIndex === -1 || toIndex < 0 || toIndex >= this.items.length) {
      return false;
    }

    const [item] = this.items.splice(currentIndex, 1);
    this.items.splice(toIndex, 0, item);
    this.reorderItems();
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Re-assigns order numbers to all items based on their current position
   */
  private reorderItems(): void {
    this.items.forEach((item, index) => {
      item.order = index;
    });
  }

  /**
   * Clears all items from the basket
   */
  public clear(): void {
    this.items = [];
    this.updatedAt = new Date();
  }

  /**
   * Returns the number of items in this basket
   */
  public getItemCount(): number {
    return this.items.length;
  }

  /**
   * Returns a plain object representation for serialization
   */
  public toJSON(): CodeContextBasket {
    return {
      id: this.id,
      name: this.name,
      items: this.items,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      exportFormat: this.exportFormat,
      description: this.description,
      tags: this.tags
    };
  }

  /**
   * Creates a deep copy of this basket
   */
  public clone(): CodeContextBasketModel {
    return new CodeContextBasketModel(
      this.name,
      this.items.map(item => ({ ...item })),
      this.id,
      new Date(this.createdAt),
      new Date(this.updatedAt),
      this.exportFormat,
      this.description,
      this.tags ? [...this.tags] : undefined
    );
  }
}
