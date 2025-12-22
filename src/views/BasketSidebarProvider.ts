/**
 * @fileoverview BasketSidebarProvider - WebView for Code Context Basket
 *
 * Provides a sidebar panel for viewing, editing, and managing code context baskets.
 * 提供侧边栏面板用于查看、编辑和管理代码上下文篮子。
 */

import * as vscode from 'vscode';
import { MultipleContextManager } from '../managers/MultipleContextManager';
import { CodeContextBasket, CodeContextItem, BasketHistorySummary } from '../types/codeContext';

export class BasketSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'codepath.basketView';

  private webviewView: vscode.WebviewView | undefined;
  private manager: MultipleContextManager;

  constructor(manager: MultipleContextManager) {
    this.manager = manager;

    // Register event callbacks
    this.manager.registerBasketChangedCallback(() => {
      void this.refresh();
    });

    this.manager.registerItemsChangedCallback(() => {
      void this.refresh();
    });

    this.manager.registerErrorCallback((error) => {
      this.showError(error.message);
    });
  }

  /**
   * Called when the webview panel needs to be resolved
   * 当需要解析 WebView 面板时调用
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.webviewView = webviewView;

    // Enable JavaScript in webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: []
    };

    // Set initial HTML content
    webviewView.webview.html = await this.getHtmlContent();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        this.handleWebviewMessage(message);
      },
      undefined
    );

    // Initial refresh
    void this.refresh();
  }

  /**
   * Refreshes the webview content
   * 刷新 WebView 内容
   */
  public async refresh(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    this.webviewView.webview.html = await this.getHtmlContent();
  }

  /**
   * Generates the HTML content for the webview
   * 生成 WebView 的 HTML 内容
   */
  private async getHtmlContent(): Promise<string> {
    const basket = this.manager.getCurrentBasket();
    const items = basket?.items || [];
    const historyEntries = await this.manager.getHistorySummaries();
    const recentHistory = historyEntries.slice(0, 8);

    const itemsHtml = items
      .map(
        (item, index) => `
      <div class="basket-item" data-item-id="${item.id}" draggable="true">
        <div class="item-drag-handle">⋮⋮</div>
        <div class="item-content">
          <div class="item-header">
            <span class="item-number">${index + 1}</span>
            <span class="item-file">${item.fileName || item.filePath}</span>
            <span class="item-location">${item.filePath}:${item.lineNumber}${
              item.lineEndNumber ? `-${item.lineEndNumber}` : ''
            }</span>
          </div>
          <div class="item-note-wrapper">
            <div class="item-note" data-item-id="${item.id}" data-editable="true" title="Click to edit note">${this.escapeHtml(item.note) || '<em>No note</em>'}</div>
            <span class="item-note-edit-icon">✏️</span>
          </div>
          <div class="item-code-preview">
            <pre><code>${this.escapeHtml(item.code.substring(0, 100))}${
              item.code.length > 100 ? '...' : ''
            }</code></pre>
          </div>
          <div class="item-actions">
            <button class="action-btn" data-action="delete" data-item-id="${item.id}" title="Delete item">Delete</button>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    const historyHtml =
      recentHistory.length > 0
        ? recentHistory.map(entry => this.renderHistoryEntry(entry)).join('')
        : '<div class="history-empty">暂无历史记录</div>';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Context Basket</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 8px;
            font-size: 12px;
            line-height: 1.4;
          }

          .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            gap: 8px;
          }

          .cp-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 10px 14px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border: 1px solid var(--vscode-editorGroup-border);
            border-radius: 4px;
          }

          .cp-toolbar-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
          }

          .cp-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 4px;
            border: 1px solid var(--vscode-editorGroup-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 6px 12px;
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
          }

          .cp-btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: transparent;
          }

          .cp-btn.danger {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border-color: var(--vscode-inputValidation-errorBorder);
          }

          .cp-btn:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-focusBorder);
          }

          .cp-btn.danger:hover:not(:disabled) {
            background: var(--vscode-inputValidation-errorBackground);
            filter: brightness(1.05);
          }

          .cp-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .history-panel {
            border: 1px solid var(--vscode-editorGroup-border);
            border-radius: 4px;
            padding: 12px;
            background: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .history-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }

          .history-title {
            font-weight: 600;
            font-size: 12px;
          }

          .history-subtitle {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .history-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 240px;
            overflow-y: auto;
          }

          .history-entry {
            border: 1px solid var(--vscode-editorGroup-border);
            border-radius: 4px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .history-entry-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }

          .history-entry-name {
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .history-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .history-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            font-size: 10px;
          }

          .history-tag {
            padding: 2px 6px;
            border-radius: 10px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
          }

          .history-entry-actions {
            display: flex;
            gap: 6px;
          }

          .history-btn {
            flex: 1;
            border: 1px solid var(--vscode-editorGroup-border);
            border-radius: 3px;
            padding: 4px 6px;
            background: var(--vscode-sideBar-background);
            color: var(--vscode-foreground);
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s ease;
          }

          .history-btn:hover {
            background: var(--vscode-editorGroupHeader-tabsBackground);
          }

          .history-btn.danger {
            border-color: var(--vscode-errorForeground);
            color: var(--vscode-errorForeground);
          }

          .history-empty {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .history-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            border: 1px solid var(--vscode-editorGroup-border);
          }

          .history-badge.danger {
            border-color: var(--vscode-errorForeground);
            color: var(--vscode-errorForeground);
          }

          .basket-header {
            width: 100%;
          }

          .basket-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .basket-name {
            font-weight: 600;
            font-size: 13px;
          }

          .basket-stats {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .basket-stat {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .basket-actions {
            flex: 1;
          }

          .action-btn {
            padding: 4px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            flex: 1;
            min-width: 60px;
            transition: background 0.2s;
          }

          .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
          }

          .action-btn.secondary {
            background: var(--vscode-editorGroup-border);
            color: var(--vscode-foreground);
          }

          .action-btn.secondary:hover {
            background: var(--vscode-editorGroupHeader-tabsBackground);
          }

          .basket-items-container {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 4px;
          }

          .basket-items-container::-webkit-scrollbar {
            width: 8px;
          }

          .basket-items-container::-webkit-scrollbar-track {
            background: transparent;
          }

          .basket-items-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
          }

          .basket-items-container::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
            text-align: center;
          }

          .empty-state-icon {
            font-size: 32px;
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .empty-state-text {
            font-size: 12px;
          }

          .basket-item {
            display: flex;
            gap: 8px;
            padding: 8px;
            background: var(--vscode-editorGroup-border);
            border-radius: 4px;
            cursor: move;
            transition: background 0.2s, opacity 0.2s;
            user-select: none;
          }

          .basket-item:hover {
            background: var(--vscode-editorGroupHeader-tabsBackground);
          }

          .basket-item.drag-over {
            opacity: 0.5;
            border: 2px dashed var(--vscode-focusBorder);
          }

          .item-drag-handle {
            display: flex;
            align-items: center;
            color: var(--vscode-descriptionForeground);
            cursor: grab;
            user-select: none;
            font-size: 10px;
            min-width: 16px;
          }

          .item-drag-handle:active {
            cursor: grabbing;
          }

          .item-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
          }

          .item-header {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
          }

          .item-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            flex-shrink: 0;
          }

          .item-file {
            font-weight: 500;
            color: var(--vscode-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .item-location {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
          }

          .item-note-wrapper {
            display: flex;
            gap: 4px;
            align-items: flex-start;
          }

          .item-note {
            flex: 1;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            word-break: break-word;
            max-height: 40px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 2px;
            transition: background 0.2s;
          }

          .item-note:hover {
            background: var(--vscode-editor-lineHighlightBackground);
          }

          .item-note-edit-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 11px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
            flex-shrink: 0;
            margin-top: 1px;
          }

          .item-note-wrapper:hover .item-note-edit-icon {
            opacity: 1;
          }

          .item-note.editing {
            max-height: none;
            overflow: visible;
            display: block;
            -webkit-line-clamp: unset;
            padding: 4px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
          }

          .item-note.editing textarea {
            width: 100%;
            min-height: 40px;
            padding: 4px;
            font-size: 11px;
            font-family: inherit;
            border: none;
            background: transparent;
            color: var(--vscode-input-foreground);
            resize: vertical;
            outline: none;
          }

          .item-code-preview {
            background: var(--vscode-editor-background);
            border-radius: 2px;
            padding: 4px;
            overflow: hidden;
          }

          .item-code-preview pre {
            margin: 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 10px;
            color: var(--vscode-editorLineNumber-foreground);
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 60px;
            overflow-y: hidden;
          }

          .item-actions {
            display: flex;
            gap: 4px;
          }

          .item-actions .action-btn {
            flex: none;
            padding: 3px 6px;
            font-size: 10px;
            min-width: 50px;
          }

          .status-bar {
            padding: 4px 8px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-editorGroup-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .status-left, .status-right {
            display: flex;
            gap: 8px;
          }

          em {
            opacity: 0.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="basket-header cp-toolbar">
            <div class="basket-info">
              <div class="basket-name">${basket ? this.escapeHtml(basket.name) : 'No Basket'}</div>
              <div class="basket-stats">
                ${
                  basket
                    ? `
                  <div class="basket-stat">
                    <span>📦</span>
                    <span>${basket.items.length} items</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
            <div class="basket-actions cp-toolbar-buttons">
              <button class="cp-btn primary" data-action="new-basket" title="Create new basket">🆕 New Basket</button>
              <button class="cp-btn" data-action="export" title="Export basket" ${!basket || basket.items.length === 0 ? 'disabled' : ''}>📤 Export</button>
              <button class="cp-btn" data-action="copy-markdown" title="Copy basket as Markdown" ${!basket || basket.items.length === 0 ? 'disabled' : ''}>📋 Copy</button>
              <button class="cp-btn danger" data-action="clear" title="Clear basket" ${!basket || basket.items.length === 0 ? 'disabled' : ''}>🧹 Clear</button>
            </div>
          </div>

          <div class="basket-items-container">
            ${
              basket && basket.items.length > 0
                ? itemsHtml
                : `
              <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">
                  ${basket ? 'No items in basket.<br/>Use "Add to Basket" to collect code snippets.' : 'Create or load a basket to get started.'}
                </div>
              </div>
            `
            }
          </div>

          <div class="history-panel">
              <div class="history-header">
              <div>
                <div class="history-title">历史记录</div>
                <div class="history-subtitle">最近保存的篮子快照</div>
              </div>
            </div>
            <div class="history-list">
              ${historyHtml}
            </div>
          </div>

          <div class="status-bar">
            <div class="status-left">
              <span>${basket ? `Basket: ${this.escapeHtml(basket.name)}` : 'No basket loaded'}</span>
            </div>
            <div class="status-right">
              <span>${basket ? `${basket.items.length} items` : ''}</span>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          // Track currently editing note
          let editingNoteId = null;

          // Item dragging
          let draggedItem = null;

          document.querySelectorAll('[data-command]').forEach((button) => {
            button.addEventListener('click', (event) => {
              const targetButton = event.currentTarget;
              if (!(targetButton instanceof HTMLElement)) {
                return;
              }
              const command = targetButton.getAttribute('data-command');
              if (!command) {
                return;
              }

              vscode.postMessage({ command });
            });
          });

          const historyList = document.querySelector('.history-list');
          if (historyList) {
            historyList.addEventListener('click', (event) => {
              const target = event.target;
              if (!(target instanceof HTMLElement)) {
                return;
              }

              const action = target.getAttribute('data-history-action');
              const historyId = target.getAttribute('data-history-id');
              if (!action || !historyId) {
                return;
              }

              vscode.postMessage({ command: 'historyAction', action, historyId });
              event.stopPropagation();
            });
          }
          let draggedOverItem = null;

          document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.basket-item');
            if (item) {
              draggedItem = item;
              item.style.opacity = '0.5';
            }
          });

          document.addEventListener('dragend', (e) => {
            const items = document.querySelectorAll('.basket-item');
            items.forEach(item => {
              item.classList.remove('drag-over');
              item.style.opacity = '1';
            });
            draggedItem = null;
            draggedOverItem = null;
          });

          document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const item = e.target.closest('.basket-item');
            if (item && item !== draggedItem) {
              draggedOverItem = item;
              item.classList.add('drag-over');
            }
          });

          document.addEventListener('dragleave', (e) => {
            const item = e.target.closest('.basket-item');
            if (item) {
              item.classList.remove('drag-over');
            }
          });

          document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem && draggedOverItem && draggedItem !== draggedOverItem) {
              const itemId = draggedItem.dataset.itemId;
              const targetIndex = Array.from(document.querySelectorAll('.basket-item')).indexOf(draggedOverItem);
              vscode.postMessage({
                command: 'moveItem',
                itemId: itemId,
                toIndex: targetIndex
              });
            }
          });

          // Inline note editing
          document.addEventListener('click', (e) => {
            // Handle note editing icon click
            const editIcon = e.target.closest('.item-note-edit-icon');
            if (editIcon) {
              const noteWrapper = editIcon.closest('.item-note-wrapper');
              const noteDiv = noteWrapper.querySelector('.item-note');
              if (noteDiv && !noteDiv.classList.contains('editing')) {
                startEditingNote(noteDiv);
              }
              return;
            }

            // Handle note editing
            const noteDiv = e.target.closest('.item-note[data-editable="true"]');
            if (noteDiv && !noteDiv.classList.contains('editing')) {
              startEditingNote(noteDiv);
              return;
            }

            // Handle button actions
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const itemId = btn.dataset.itemId;

            switch (action) {
              case 'new-basket':
                vscode.postMessage({ command: 'createNewBasket' });
                break;
              case 'load-basket':
                vscode.postMessage({ command: 'loadBasket' });
                break;
              case 'export':
                vscode.postMessage({ command: 'exportBasket' });
                break;
              case 'copy-markdown':
                vscode.postMessage({ command: 'copyBasketAsMarkdown' });
                break;
              case 'clear':
                vscode.postMessage({ command: 'clearBasket' });
                break;
              case 'delete':
                vscode.postMessage({ command: 'deleteItem', itemId: itemId });
                break;
            }
          });

          function startEditingNote(noteDiv) {
            const itemId = noteDiv.dataset.itemId;
            if (editingNoteId) {
              finishEditingNote();
            }

            editingNoteId = itemId;
            const currentNote = noteDiv.textContent.trim();
            const isPlaceholder = noteDiv.innerHTML.includes('<em>No note</em>');
            const noteText = isPlaceholder ? '' : currentNote;

            noteDiv.classList.add('editing');
            noteDiv.innerHTML = '<textarea>' + escapeHtml(noteText) + '</textarea>';

            const textarea = noteDiv.querySelector('textarea');
            textarea.focus();
            textarea.select();

            const saveNote = () => {
              const newNote = textarea.value.trim();
              finishEditingNote();

              if (newNote !== noteText) {
                vscode.postMessage({
                  command: 'updateNote',
                  itemId: itemId,
                  note: newNote
                });
              }
            };

            textarea.addEventListener('blur', saveNote);
            textarea.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                saveNote();
              } else if (e.key === 'Escape') {
                finishEditingNote();
              }
            });
          }

          function finishEditingNote() {
            if (!editingNoteId) return;

            const noteDiv = document.querySelector(
              '.item-note[data-item-id="' + editingNoteId + '"]'
            );
            if (noteDiv) {
              noteDiv.classList.remove('editing');
            }
            editingNoteId = null;
          }

          function escapeHtml(text) {
            const htmlEscapeMap = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;'
            };
            return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Handles messages from the webview
   * 处理来自 WebView 的消息
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'createNewBasket':
        await this.handleCreateNewBasket();
        break;
      case 'loadBasket':
        await this.handleLoadBasket();
        break;
      case 'refreshHistory':
        await this.refresh();
        break;
      case 'openHistoryPalette':
        await vscode.commands.executeCommand('codepath.showBasketHistory');
        break;
      case 'historyAction':
        await this.handleHistoryAction(message.action, message.historyId);
        break;
      case 'exportBasket':
        await this.handleExportBasket();
        break;
      case 'copyBasketAsMarkdown':
        await this.handleCopyBasketAsMarkdown();
        break;
      case 'clearBasket':
        await this.handleClearBasket();
        break;
      case 'updateNote':
        await this.handleUpdateNote(message.itemId, message.note);
        break;
      case 'deleteItem':
        await this.handleDeleteItem(message.itemId);
        break;
      case 'moveItem':
        await this.handleMoveItem(message.itemId, message.toIndex);
        break;
    }
  }

  /**
   * Handles creating a new basket
   */
  private async handleCreateNewBasket(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter basket name',
      placeHolder: 'My Code Snippets'
    });

    if (!name) {
      return;
    }

    try {
      const basket = await this.manager.createBasket(name);
      this.manager.setCurrentBasket(basket);
      vscode.window.showInformationMessage(`Created basket: ${name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create basket: ${error}`);
    }
  }

  /**
   * Handles loading a basket
   */
  private async handleLoadBasket(): Promise<void> {
    try {
      const baskets = await this.manager.listBaskets();

      if (baskets.length === 0) {
        vscode.window.showInformationMessage('No baskets found. Create a new basket first.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        baskets.map((b) => ({
          label: b.name,
          description: `${b.items.length} items`,
          basket: b
        })),
        {
          placeHolder: 'Select a basket to load'
        }
      );

      if (selected) {
        this.manager.setCurrentBasket(selected.basket);
        vscode.window.showInformationMessage(`Loaded basket: ${selected.label}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load basket: ${error}`);
    }
  }

  /**
   * Handles history actions dispatched from webview
   */
  private async handleHistoryAction(action: string, historyId: string): Promise<void> {
    if (!historyId) {
      return;
    }

    try {
      switch (action) {
        case 'open': {
          const restored = await this.manager.restoreBasketFromHistory(historyId, {
            asNew: false,
            setActive: true
          });

          if (!restored) {
            vscode.window.showWarningMessage('无法恢复该历史记录，可能已被删除。');
            return;
          }

          vscode.window.showInformationMessage(`已打开历史篮子 "${restored.name}"`);
          break;
        }
        case 'delete': {
          const confirmed = await vscode.window.showWarningMessage(
            '确定要删除该历史记录吗？删除后无法恢复。',
            { modal: true },
            '删除'
          );
          if (confirmed !== '删除') {
            return;
          }

          await this.manager.deleteHistoryEntry(historyId);
          vscode.window.showInformationMessage('历史记录已删除');
          break;
        }
        case 'edit': {
          const entry = await this.manager.getHistoryEntry(historyId);
          if (!entry) {
            vscode.window.showWarningMessage('无法加载该历史记录，可能已被删除。');
            return;
          }

          const newName = await vscode.window.showInputBox({
            prompt: '更新历史记录名称',
            value: entry.name
          });

          if (!newName || newName.trim().length === 0) {
            return;
          }

          const newDescription = await vscode.window.showInputBox({
            prompt: '更新描述（可选）',
            value: entry.description || ''
          });

          const newTags = await vscode.window.showInputBox({
            prompt: '更新标签（用逗号分隔，可选）',
            value: entry.tags?.join(', ') || ''
          });

          const tags = newTags
            ? newTags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
            : entry.tags;

          await this.manager.updateHistoryEntry(historyId, {
            name: newName.trim(),
            description: newDescription ? newDescription.trim() || undefined : undefined,
            tags
          });

          vscode.window.showInformationMessage('历史记录信息已更新');
          break;
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `处理历史记录操作失败: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await this.refresh();
    }
  }

  /**
   * Handles exporting a basket
   */
  private async handleExportBasket(): Promise<void> {
    const basket = this.manager.getCurrentBasket();
    if (!basket) {
      vscode.window.showWarningMessage('No basket to export');
      return;
    }

    const format = await vscode.window.showQuickPick(
      [
        {
          label: 'Markdown',
          description: 'Best for documentation',
          format: 'markdown'
        },
        {
          label: 'JSON',
          description: 'Structured data',
          format: 'json'
        },
        {
          label: 'Plain Text',
          description: 'Maximum compatibility',
          format: 'plaintext'
        }
      ],
      {
        placeHolder: 'Select export format'
      }
    );

    if (!format) {
      return;
    }

    try {
      const content = this.manager.export(format.format as any);
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(`✅ Basket exported to clipboard (${format.label})`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export basket: ${error}`);
    }
  }

  /**
   * Handles copying basket content as Markdown
   */
  private async handleCopyBasketAsMarkdown(): Promise<void> {
    const basket = this.manager.getCurrentBasket();
    if (!basket || basket.items.length === 0) {
      vscode.window.showInformationMessage('No basket items to copy.');
      return;
    }

    try {
      const content = this.manager.export('markdown', basket);
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage('✅ Basket copied as Markdown');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy basket: ${error}`);
    }
  }

  /**
   * Handles clearing a basket
   */
  private async handleClearBasket(): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      'Clear all items from this basket?',
      { modal: true },
      'Clear'
    );

    if (confirmed === 'Clear') {
      try {
        await this.manager.clearBasket();
        vscode.window.showInformationMessage('Basket cleared');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to clear basket: ${error}`);
      }
    }
  }

  /**
   * Handles updating a note via inline editing
   */
  private async handleUpdateNote(itemId: string, note: string): Promise<void> {
    try {
      await this.manager.updateItem(itemId, { note });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update note: ${error}`);
    }
  }

  /**
   * Handles deleting an item
   */
  private async handleDeleteItem(itemId: string): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      'Delete this item?',
      { modal: true },
      'Delete'
    );

    if (confirmed === 'Delete') {
      try {
        await this.manager.removeItem(itemId);
        vscode.window.showInformationMessage('Item deleted');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete item: ${error}`);
      }
    }
  }

  /**
   * Handles moving an item
   */
  private async handleMoveItem(itemId: string, toIndex: number): Promise<void> {
    try {
      await this.manager.moveItem(itemId, toIndex);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to move item: ${error}`);
    }
  }

  /**
   * Renders a single history entry row
   */
  private renderHistoryEntry(entry: BasketHistorySummary): string {
    const tags =
      entry.tags && entry.tags.length > 0
        ? `<div class="history-tags">${entry.tags
            .map(tag => `<span class="history-tag">${this.escapeHtml(tag)}</span>`)
            .join('')}</div>`
        : '';

    return `
      <div class="history-entry">
        <div class="history-entry-header">
          <div class="history-entry-name">
            ${this.escapeHtml(entry.name)}
          </div>
          <div class="history-meta">
            <span>${entry.itemCount} items</span>
            <span>${this.formatHistoryTimestamp(entry.updatedAt)}</span>
            ${entry.source ? `<span>${this.escapeHtml(String(entry.source))}</span>` : ''}
          </div>
        </div>
        ${tags}
        <div class="history-entry-actions">
          <button class="history-btn" data-history-action="open" data-history-id="${entry.historyId}">打开</button>
          <button class="history-btn" data-history-action="edit" data-history-id="${entry.historyId}">编辑</button>
          <button class="history-btn danger" data-history-action="delete" data-history-id="${entry.historyId}">删除</button>
        </div>
      </div>
    `;
  }

  private formatHistoryTimestamp(date: Date | undefined): string {
    if (!date) {
      return '-';
    }

    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  /**
   * Shows an error message
   */
  private showError(message: string): void {
    vscode.window.showErrorMessage(`Code Context Basket: ${message}`);
  }

  /**
   * Escapes HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapeMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
  }
}
