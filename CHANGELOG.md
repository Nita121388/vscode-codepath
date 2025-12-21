# Changelog

All notable changes to the CodePath extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Code Context Basket productivity commands** – Added `🧺 Clear And Add` to reset the current basket before capturing a new snippet, plus a “Copy as Markdown” action in the basket sidebar for one-click sharing.

### Changed
- **Command menu readability** – Path-related commands now use the road-sign emoji (`🪧`) and backup operations use the archive emoji (`🗂️`) to make right-click menus easier to scan.
- **Unified toolbar styling** – The preview panel and Code Context Basket now share the same pill-style toolbar buttons, ensuring consistent visuals between the two webviews.

## [0.2.8] - 2025-12-11

### Added
- **File & Folder Backup Management** - Quick backup and restore functionality from explorer or status bar menu
  - Back up selected files/folders to `.codepath/file-backups` directory
  - Automatic latest backup retention per resource (only keeps most recent backup)
  - One-click restore from the latest backup with confirmation
  - Clear all backups functionality with safety confirmation
  - Status bar menu integration for quick backup operations
  - File explorer context menu support for direct file/folder backup

### Technical
- Added BackupManager for centralized backup operations
- Integrated backup operations into StatusBarManager quick menu
- Enhanced file explorer context menu with backup options
- Backup metadata stored alongside files for tracking

## [0.2.7] - 2025-11-23

### Added
- **📋 Copy Code Context in lightbulb menu** - The existing `codepath.copyCodeContext` command is now available directly from the editor lightbulb (Quick Fix) menu alongside the Line Content Popup Editor, making it easier to copy sharable code snippets with file path and line ranges

## [0.2.6] - 2025-11-20

### Added
- **Line Content Popup Editor** - New `codepath.showSelectionPopup` command with Code Action (lightbulb) integration
  - Select any code (single or multi-line) and access via lightbulb menu or Code Path context menu
  - Auto-wrapping editor popup displays original line numbers for easy reference
  - Ctrl+Enter saves changes instantly
  - Version conflict detection and document change handling
  - No need to rely on Ctrl+Click for quick edits

### Changed
- Status bar icon updated to road sign 🪧 for better visual discoverability of the quick menu

### Fixed
- Line break normalization in popup editor to prevent extra blank lines between edited content
- Consistent handling of Windows-style (\r\n) and Unix-style (\n) line breaks throughout edit/save cycle

### Technical
- Added LinePopupManager with webview-based per-line editing UI
- Enhanced vscode mock for better LinePopupManager testing support
- Improved extension lifecycle integration with LinePopupManager

## [0.2.5] - 2025-11-20

### Added
- AI integration features (currently hidden in UI, can be re-enabled)
  - `codepath.generateGraphFromBlueprint` command for importing AI generated JSON blueprints
  - GraphManager blueprint pipeline with validation to persist AI generated CodePath graphs
  - Optional local AI endpoint with start/stop commands and configuration for auto-start
  - AIEndpointManager provides HTTP server for external AI tools

### Changed
- Development documentation files excluded from VSIX package for cleaner distribution

## [0.2.3] - 2025-10-29

### Fixed
- Fixed Vitest mock configuration for VSCode module, resolving test failures
- Improved test stability and reliability with unified test setup
- Achieved 99.1% test pass rate (1265/1276 tests passing)
- Documented edge cases and skipped tests requiring functional design decisions

### Technical
- Added unified test setup in `src/__mocks__/testSetup.ts`
- Added missing mock files for fs and path modules
- Fixed export format compatibility in vscode.ts mock
- Removed duplicate vi.mock declarations from test files

## [0.2.2] - 2025-10-21

### Added
- `Code Path → Copy Code Context` menu command to capture the relative path, line range, and selected code into the clipboard, supporting multiple selections for quick sharing.

### Changed
- `Copy Code Context` now appears only when the editor has a non-empty selection to avoid accidental copies.

## [0.2.1] - 2025-10-19

### Added
- `codepath.autoOpenPreviewOnStartup` setting to control whether the preview panel auto-opens after loading the last graph.

### Changed
- Status bar quick menu refresh entry renamed to “👁️ Refresh & Preview” and now forces the preview panel to reveal when hidden.
- Preview webview quick menu adds a “⚙️ Open Settings” shortcut and clarifies the paste command icon for better discoverability.

### Fixed
- Manual refresh flows now reuse consistent visibility detection, ensuring forced updates render correctly for both panel and sidebar views.

## [0.2.0] - 2025-10-16

### Added
- Initial release preparation
- Comprehensive test suite with 575+ tests
- Performance monitoring and optimization
- Cross-platform compatibility testing
- Auto-open preview panel on startup when graph has nodes
- **Menu Structure Restructure** - Complete UI overhaul with unified menu structure
  - Plugin display name changed from "Code Path Wormhole" to "Code Path Marker"
  - All commands moved to unified "Code Path" submenu
  - Command titles updated: "New" → "Mark as" (e.g., "Mark as New Node")
  - Maintained all existing keyboard shortcuts and functionality
  - Enhanced menu organization with logical grouping
- **File/Folder Context Support** - Create nodes directly from file explorer
  - Right-click any file or folder in explorer to create nodes
  - Automatic file/folder name as node name
  - Automatic path resolution and line number handling
  - Seamless integration with existing node creation workflow
- **Node Copy/Paste/Cut Operations** - Advanced node manipulation features
  - Copy nodes with all children to clipboard
  - Cut nodes to move them to new locations
  - Paste node trees with automatic ID generation
  - Deep copy functionality preserves complete node structure
  - Cross-graph paste support
- **Node Order Management** - Adjust node positions within siblings
  - Move nodes up/down within same parent level
  - Smart boundary detection with user-friendly messages
  - Automatic preview refresh after reordering
  - Support for both root nodes and child nodes
- **Preview Interface Custom Menu** - Enhanced preview interaction
  - Custom right-click menu in preview panel
  - Context-sensitive menu options (Refresh, Export, Copy, Paste, Cut, Move Up, Move Down)
  - Replaces default browser context menu
  - Direct integration with command system
- **Create Bro Node feature** - Create sibling nodes at the same level as the current node
  - Right-click context menu integration with "Mark as Bro Node" option
  - Keyboard shortcut `Ctrl+Alt+B` for quick access
  - Command palette support with "Code Path Marker: Mark as Bro Node" command
  - Smart relationship handling: creates child of parent node or new root node
  - Automatic code capture from selected text
  - Seamless integration with existing node creation workflow
- **Status bar quick menu** - Click status bar to access all graph management features
  - Create new graph
  - Switch between graphs
  - Export/Import graphs
  - Delete graphs
  - Refresh preview
  - Switch nodes
  - Toggle view format
- Enhanced status bar tooltips with rich markdown formatting
- **Auto-switch to new graph** - Newly created graphs are automatically set as active with full UI update
- **Tree fork feature** - When adding a parent to a node that already has a parent, creates a tree fork to preserve both relationships
  - Original parent-child relationship is maintained
  - New parent creates a separate branch with a duplicated node
  - All descendants are transferred to the new branch
  - Supports tracking multiple execution paths for the same code location
- **Auto-update node location** - When code location changes, system prompts user to update node position
  - Intelligent code search with multiple strategies (exact match, nearby search, full-file search)
  - User confirmation dialog with "OK" and "Dismiss" options
  - Automatic update of node location, line number, and code snippet on confirmation
  - **Immediate preview refresh** - Preview updates instantly after clicking OK, no need to switch nodes
  - Confidence levels (exact, high, medium, low) to indicate match quality
  - Code fingerprinting using SHA-256 hash for precise tracking
  - Fuzzy matching using Levenshtein distance for modified code

### Fixed
- Preview not updating immediately after node location update - now refreshes instantly with latest data
- Menu structure inconsistencies across different contexts
- Command registration and context handling improvements
- Enhanced error handling for new clipboard and order operations

### Technical Implementation
- **New Manager Classes**
  - `ClipboardManager`: Handles node copy/paste/cut operations with deep tree copying
  - `NodeOrderManager`: Manages sibling node ordering with boundary detection
  - Enhanced `CommandManager`: Integrated new operations with existing workflow
  - Extended `WebviewManager`: Custom context menu implementation for preview
- **Data Model Extensions**
  - `ClipboardData` interface for clipboard operations
  - `NodeTreeData` interface for hierarchical node copying
  - Extended `Graph` interface with node ordering support
  - New error types for clipboard and order operations
- **Menu System Redesign**
  - Submenu structure with logical grouping
  - Context-sensitive menu item display
  - Enhanced command registration with proper categorization
  - File explorer integration with resource context detection
- **Enhanced Error Handling**
  - New error categories for clipboard and order operations
  - User-friendly error messages with recovery suggestions
  - Graceful degradation for edge cases
  - Comprehensive validation for all new operations

### Changed
- **Plugin Identity Update** - Complete rebranding for better clarity
  - Display name: "Code Path Wormhole" → "Code Path Marker"
  - Command category: "CodePath" → "Code Path Marker"
  - All user-facing text updated to reflect "marking" concept
  - Documentation updated with new naming conventions
- **Menu Structure Overhaul** - Unified and organized menu system
  - All CodePath commands now under "Code Path" submenu
  - Logical grouping: Create (1_create), Edit (2_edit), Order (3_order), File (4_file)
  - Conditional menu item display based on context
  - Enhanced menu item descriptions and organization
- **Command Naming Convention** - More intuitive command names
  - "New Node" → "Mark as New Node"
  - "New Child Node" → "Mark as Child Node"
  - "New Parent Node" → "Mark as Parent Node"
  - "New Bro Node" → "Mark as Bro Node"
  - All success messages updated to use "marked as" terminology
- **Enhanced User Feedback** - Improved messaging system
  - Success messages use "marked as" instead of "created"
  - Error messages reference updated command names
  - Consistent terminology throughout the extension
- Improved error handling and recovery mechanisms
- Optimized memory usage for large graphs
- Preview panel now automatically opens when loading a graph with existing nodes
- Simplified status bar to show only graph information (removed node and preview status items)
- **Simplified file path display** - Shows only filename instead of full path in preview (full path still used for navigation)

### Fixed
- Node creation synchronization issues
- Preview format toggle reliability
- Extension activation sequence
- Preview panel not auto-opening on VS Code startup when graph is loaded
- Preview panel showing empty content on startup (now properly displays loaded graph)
- Status bar not showing current graph info on startup (now updates automatically)

## [0.1.0] - 2025-10-01

### Added
- **Core Features**
  - Interactive code path node creation from selected text
  - Right-click context menu integration
  - Hierarchical parent-child node relationships
  - Smart node navigation with fuzzy matching
  - Position-based exact node matching

- **Visualization**
  - Text-based hierarchical graph representation
  - Real-time preview updates
  - Split-screen layout (code + preview)
  - Format switching between text and diagrams

- **Graph Management**
  - Multiple graph support with switching
  - Graph creation, loading, and saving
  - Markdown export/import functionality
  - Auto-save with configurable intervals
  - Backup and recovery system

- **User Interface**
  - Status bar integration showing current graph/node
  - Command palette integration for all operations
  - Keyboard shortcuts for common actions
  - Webview panel for preview display
  - Context-sensitive menu items

- **Configuration**
  - Default view format setting (text)
  - Auto-save enable/disable
  - Auto-load last graph on startup
  - Preview refresh interval configuration
  - Maximum nodes per graph limit

- **Developer Experience**
  - Comprehensive error handling with user-friendly messages
  - Graceful degradation on rendering failures
  - Performance monitoring for large graphs
  - Memory usage optimization
  - Cross-platform file path handling

- **Storage & Persistence**
  - Workspace-based storage in `.codepath/` directory
  - JSON-based graph file format
  - Automatic backup creation
  - Corrupted file recovery
  - Git-friendly storage structure

### Technical Implementation

- **Architecture**
  - Model-View-Controller (MVC) pattern
  - Dependency injection for manager classes
  - Event-driven updates between components
  - Proper resource disposal and memory management

- **Core Managers**
  - `GraphManager`: Graph lifecycle and operations
  - `NodeManager`: Node creation and relationship management
  - `PreviewManager`: Rendering and format management
  - `StorageManager`: File system operations and persistence
  - `ConfigurationManager`: Settings and preferences
  - `StatusBarManager`: Status bar integration
  - `WebviewManager`: Preview panel management
  - `CommandManager`: Command registration and handling
  - `IntegrationManager`: Component coordination

- **Data Models**
  - `Graph`: Graph data structure with validation
  - `Node`: Node model with relationship management
  - Type-safe interfaces for all data structures
  - Comprehensive input validation

- **Rendering System**
  - `TextRenderer`: Hierarchical text representation
  - Fallback mechanisms for rendering failures
  - Performance optimization for large graphs

- **Error Handling**
  - Custom `CodePathError` class with categorization
  - Recovery action suggestions
  - Graceful degradation strategies
  - User-friendly error messages

### Testing

- **Comprehensive Test Suite**
  - 575+ total tests with 91.2% pass rate
  - Unit tests for all core components
  - Integration tests for end-to-end workflows
  - Performance tests for scalability
  - Edge case testing for robustness
  - Cross-platform compatibility tests

- **Test Categories**
  - Requirements validation tests
  - Error handling and recovery tests
  - Performance and memory usage tests
  - Concurrency and race condition tests
  - File system and storage tests
  - UI integration tests

### Performance Characteristics

- **Scalability**
  - Recommended limit: 100 nodes per graph
  - Tested up to 200 nodes with acceptable performance
  - Segmented loading for large graphs
  - 5-second timeout for preview rendering

- **Memory Usage**
  - Base extension: ~10MB
  - 100-node graph: ~25MB
  - Growth rate: ~150KB per node
  - Automatic memory monitoring

- **Operation Performance**
  - Node creation: ~50ms average
  - Graph switching: ~100ms average
  - Preview update: ~200ms (text view)
  - Export/import: ~1s for medium graphs

### Known Issues

- Some child node creation edge cases may fail (race conditions)
- Extension activation sequence needs optimization
- Error recovery mechanisms need enhancement

### Development Tools

- **Build System**
  - TypeScript compilation with strict mode
  - ESLint for code quality
  - Vitest for testing framework
  - VS Code extension development tools

- **Development Workflow**
  - Hot reload during development
  - Comprehensive debugging support
  - Extension Development Host integration
  - Automated testing pipeline

### Documentation

- Comprehensive README with usage examples
- Contributing guidelines for developers
- API documentation for all public interfaces
- Troubleshooting guide for common issues
- Performance optimization recommendations

---

## Release Notes Format

### Added
- New features and capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that have been removed

### Fixed
- Bug fixes and corrections

### Security
- Security-related improvements

---

*For detailed technical information, see the [Technical Documentation](docs/) and [API Reference](docs/api/).*
