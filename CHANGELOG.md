# Changelog

All notable changes to the CodePath extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release preparation
- Comprehensive test suite with 575+ tests
- Performance monitoring and optimization
- Cross-platform compatibility testing
- Auto-open preview panel on startup when graph has nodes
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

### Changed
- Improved error handling and recovery mechanisms
- Enhanced Mermaid rendering with better sanitization
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
- **Mermaid syntax validation** - Fixed false positive errors for node definitions with complex bracket patterns

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
  - Mermaid diagram visualization with flowcharts
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
  - Default view format setting (text/mermaid)
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
  - `MermaidRenderer`: Diagram generation with syntax validation
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
  - Preview update: ~200ms (text), ~500ms (mermaid)
  - Export/import: ~1s for medium graphs

### Known Issues

- Some child node creation edge cases may fail (race conditions)
- Mermaid rendering may be overly strict with special characters
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