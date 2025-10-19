# CodePath Extension API Documentation

This document provides comprehensive API documentation for the CodePath VS Code extension.

## Table of Contents

- [Core Managers](#core-managers)
- [Data Models](#data-models)
- [Renderers](#renderers)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Events](#events)

## Core Managers

### GraphManager

Manages graph lifecycle operations including creation, loading, saving, and deletion.

#### Constructor

```typescript
constructor(
    storageManager: IStorageManager,
    configManager: IConfigurationManager
)
```

#### Methods

##### `createGraph(name?: string): Promise<Graph>`

Creates a new graph with optional name.

**Parameters:**
- `name` (optional): Graph name. If not provided, generates default name.

**Returns:** Promise resolving to the created Graph object.

**Example:**
```typescript
const graph = await graphManager.createGraph('User Authentication Flow');
```

##### `loadGraph(graphId: string): Promise<Graph>`

Loads an existing graph by ID.

**Parameters:**
- `graphId`: Unique identifier of the graph to load.

**Returns:** Promise resolving to the loaded Graph object.

**Throws:** `CodePathError` if graph not found or corrupted.

##### `saveGraph(graph: Graph): Promise<void>`

Saves a graph to persistent storage.

**Parameters:**
- `graph`: Graph object to save.

**Returns:** Promise that resolves when save is complete.

##### `exportGraph(graph: Graph, format: 'md'): Promise<string>`

Exports a graph to specified format.

**Parameters:**
- `graph`: Graph object to export.
- `format`: Export format (currently only 'md' supported).

**Returns:** Promise resolving to exported content string.

##### `importGraph(content: string): Promise<Graph>`

Imports a graph from exported content.

**Parameters:**
- `content`: Exported graph content string.

**Returns:** Promise resolving to imported Graph object.

### NodeManager

Manages node creation, relationships, and navigation.

#### Constructor

```typescript
constructor(
    graphManager: IGraphManager,
    configManager: IConfigurationManager
)
```

#### Methods

##### `createNode(name: string, filePath: string, lineNumber: number, codeSnippet?: string): Promise<Node>`

Creates a new root node.

**Parameters:**
- `name`: Node display name.
- `filePath`: Absolute path to the source file.
- `lineNumber`: Line number in the source file.
- `codeSnippet` (optional): Code snippet associated with the node.

**Returns:** Promise resolving to the created Node object.

**Example:**
```typescript
const node = await nodeManager.createNode(
    'validateInput',
    '/src/auth.ts',
    15,
    'function validateInput(data: any) {'
);
```

##### `createChildNode(parentId: string, name: string, filePath: string, lineNumber: number): Promise<Node>`

Creates a child node under the specified parent.

**Parameters:**
- `parentId`: ID of the parent node.
- `name`: Child node display name.
- `filePath`: Absolute path to the source file.
- `lineNumber`: Line number in the source file.

**Returns:** Promise resolving to the created child Node object.

##### `setCurrentNode(nodeId: string): void`

Sets the current active node.

**Parameters:**
- `nodeId`: ID of the node to set as current.

**Throws:** `CodePathError` if node not found.

##### `getCurrentNode(): Node | null`

Gets the currently active node.

**Returns:** Current Node object or null if none selected.

### PreviewManager

Manages preview rendering and format switching.

#### Constructor

```typescript
constructor(configManager: IConfigurationManager)
```

#### Methods

##### `renderPreview(): Promise<string>`

Renders the current graph in the selected format.

**Returns:** Promise resolving to rendered content string.

##### `setFormat(format: ViewFormat): void`

Sets the preview format.

**Parameters:**
- `format`: Preview format. Diagram mode is reserved; current release supports text view.

##### `getFormat(): ViewFormat`

Gets the current preview format.

**Returns:** Current preview format.

##### `updatePreview(): Promise<void>`

Triggers a preview update.

**Returns:** Promise that resolves when update is complete.

### StorageManager

Manages file system operations and persistence.

#### Constructor

```typescript
constructor(
    context: vscode.ExtensionContext,
    workspaceRoot?: string
)
```

#### Methods

##### `saveGraphToFile(graph: Graph): Promise<void>`

Saves a graph to the file system.

**Parameters:**
- `graph`: Graph object to save.

**Returns:** Promise that resolves when save is complete.

##### `loadGraphFromFile(graphId: string): Promise<Graph>`

Loads a graph from the file system.

**Parameters:**
- `graphId`: ID of the graph to load.

**Returns:** Promise resolving to the loaded Graph object.

##### `ensureWorkspaceDirectory(): Promise<void>`

Ensures the workspace directory structure exists.

**Returns:** Promise that resolves when directory is ready.

## Data Models

### Graph

Represents a code path graph containing nodes and their relationships.

#### Properties

```typescript
interface Graph {
    /** Unique graph identifier */
    id: string;
    /** Human-readable graph name */
    name: string;
    /** Graph creation timestamp */
    createdAt: Date;
    /** Last modification timestamp */
    updatedAt: Date;
    /** Map of node ID to Node objects */
    nodes: Map<string, Node>;
    /** Array of root node IDs */
    rootNodes: string[];
    /** Currently selected node ID */
    currentNodeId: string | null;
}
```

#### Methods

##### `addNode(node: Node): void`

Adds a node to the graph.

##### `removeNode(nodeId: string): void`

Removes a node and updates relationships.

##### `getNode(nodeId: string): Node | undefined`

Gets a node by ID.

##### `toJSON(): object`

Serializes the graph to JSON-compatible object.

### Node

Represents a single node in the code path graph.

#### Properties

```typescript
interface Node {
    /** Unique node identifier */
    id: string;
    /** Node display name */
    name: string;
    /** Source file path */
    filePath: string;
    /** Line number in source file */
    lineNumber: number;
    /** Optional code snippet */
    codeSnippet?: string;
    /** Node creation timestamp */
    createdAt: Date;
    /** Parent node ID (null for root nodes) */
    parentId: string | null;
    /** Array of child node IDs */
    childIds: string[];
}
```

#### Methods

##### `addChild(childId: string): void`

Adds a child node ID to this node.

##### `removeChild(childId: string): void`

Removes a child node ID from this node.

##### `toJSON(): object`

Serializes the node to JSON-compatible object.

## Renderers

### TextRenderer

Renders graphs as hierarchical text representations.

#### Methods

##### `render(graph: Graph): string`

Renders the entire graph as text.

**Parameters:**
- `graph`: Graph object to render.

**Returns:** Text representation of the graph.

**Example Output:**
```
📁 My Code Path Graph (3 nodes)
├── 🔵 validateInput (/src/auth.ts:15) [CURRENT]
│   └── 🔵 checkPermissions (/src/auth.ts:25)
└── 🔵 processRequest (/src/api.ts:10)
```

##### `renderPath(graph: Graph, targetNodeId: string): string`

Renders the path from root to a specific node.

##### `renderSummary(graph: Graph): string`

Renders a summary of the graph statistics.

### DiagramRenderer (Planned)

Diagram rendering will be introduced in a future release. The current version focuses on text-based previews.
## Error Handling

### CodePathError

Custom error class for CodePath-specific errors.

#### Constructor

```typescript
constructor(
    message: string,
    category: ErrorCategory,
    options?: {
        originalError?: Error;
        userMessage?: string;
        suggestedAction?: string;
        recoverable?: boolean;
    }
)
```

#### Properties

- `category`: Error category ('user', 'filesystem', 'validation', 'rendering')
- `userMessage`: User-friendly error message
- `suggestedAction`: Suggested recovery action
- `recoverable`: Whether the error is recoverable

#### Static Methods

##### `userError(message: string, suggestedAction?: string): CodePathError`

Creates a user input error.

##### `filesystemError(message: string, originalError?: Error): CodePathError`

Creates a file system error.

##### `validationError(message: string): CodePathError`

Creates a validation error.

##### `renderingError(message: string, originalError?: Error): CodePathError`

Creates a rendering error.

## Configuration

### Configuration Options

The extension supports the following configuration options:

```typescript
interface Configuration {
    /** Default preview format */
    defaultView: ViewFormat;
    /** Enable automatic graph saving */
    autoSave: boolean;
    /** Auto-load last used graph on startup */
    autoLoadLastGraph: boolean;
    /** Preview refresh interval in milliseconds */
    previewRefreshInterval: number;
    /** Maximum nodes per graph */
    maxNodesPerGraph: number;
    /** Enable backup functionality */
    enableBackup: boolean;
    /** Backup interval in milliseconds */
    backupInterval: number;
}
```

### ConfigurationManager

#### Methods

##### `getConfiguration(): Configuration`

Gets the current configuration.

##### `updateConfiguration<K extends keyof Configuration>(key: K, value: Configuration[K]): Promise<void>`

Updates a configuration value.

## Events

### Event System

The extension uses an event-driven architecture for component communication.

#### PreviewManager Events

##### `onUpdate(callback: (content: string, format: ViewFormat) => void): vscode.Disposable`

Fired when preview content is updated.

##### `onFormatChange(callback: (format: ViewFormat) => void): vscode.Disposable`

Fired when preview format changes.

#### GraphManager Events

##### `onGraphChange(callback: (graph: Graph | null) => void): vscode.Disposable`

Fired when the current graph changes.

##### `onGraphSave(callback: (graph: Graph) => void): vscode.Disposable`

Fired when a graph is saved.

#### NodeManager Events

##### `onCurrentNodeChange(callback: (node: Node | null) => void): vscode.Disposable`

Fired when the current node changes.

##### `onNodeCreate(callback: (node: Node) => void): vscode.Disposable`

Fired when a new node is created.

## Usage Examples

### Basic Node Creation Workflow

```typescript
// Initialize managers
const storageManager = new StorageManager(context);
const configManager = new ConfigurationManager();
const graphManager = new GraphManager(storageManager, configManager);
const nodeManager = new NodeManager(graphManager, configManager);

// Create a graph
const graph = await graphManager.createGraph('Authentication Flow');

// Create root node
const rootNode = await nodeManager.createNode(
    'validateCredentials',
    '/src/auth.ts',
    10,
    'function validateCredentials(username: string, password: string) {'
);

// Create child node
const childNode = await nodeManager.createChildNode(
    rootNode.id,
    'checkDatabase',
    '/src/auth.ts',
    25
);

// Switch current node
nodeManager.setCurrentNode(childNode.id);
```

### Preview Rendering

```typescript
const previewManager = new PreviewManager(configManager);

// Render text preview (diagram mode pending)
previewManager.setFormat('text');
const textContent = await previewManager.renderPreview();
```

### Error Handling

```typescript
try {
    await nodeManager.createNode('', '/invalid/path', -1);
} catch (error) {
    if (error instanceof CodePathError) {
        console.log('Category:', error.category);
        console.log('User Message:', error.userMessage);
        console.log('Suggested Action:', error.suggestedAction);
        
        if (error.recoverable) {
            // Attempt recovery
        }
    }
}
```

## Best Practices

### Memory Management

- Always dispose of event listeners when components are destroyed
- Use the `dispose()` method on managers to clean up resources
- Avoid holding references to large objects unnecessarily

### Error Handling

- Use `CodePathError` for all extension-specific errors
- Provide helpful user messages and recovery suggestions
- Log detailed error information for debugging

### Performance

- Use debouncing for frequent operations like preview updates
- Implement lazy loading for large graphs
- Monitor memory usage in production

### Testing

- Write unit tests for all public methods
- Use integration tests for complex workflows
- Mock external dependencies in tests

---

*This API documentation is automatically generated from TypeScript interfaces and JSDoc comments. For the most up-to-date information, refer to the source code.*
