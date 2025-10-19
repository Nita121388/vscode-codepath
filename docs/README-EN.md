# Code Path Marker - Visual Code Execution Path Marker

> Visualize and document execution paths with interactive node graphs to accelerate debugging, code reviews, and knowledge transfer.
>
> [Heads-up] The extension is still under active testing. Interfaces and data formats may change frequently. Please avoid production reliance for now and share feedback to help stabilize the release.

## Overview

Code Path Marker is a VS Code extension that lets you capture execution paths while reading or debugging source code. Each execution point is stored as a navigable node, and the extension provides a structured text tree so you can explore complex logic without getting lost.

## Capability Map

| Area | Highlights |
| --- | --- |
| Path Marking | Unified "Code Path" context menu, root/parent/child/sibling nodes, file and folder marking, node copy/paste/cut/reorder |
| Smart Tracking | Multi-strategy location matching (exact/near/full-text/fuzzy), SHA-256 code fingerprinting, confidence scoring, automatic node updates |
| Visualization | Text tree preview, real-time refresh, split view layouts, customizable preview menu, status bar hints |
| Graph Management | Multiple Code Paths, auto-save with scheduled backups, auto-load last graph, quick preview from graph files |
| Collaboration | One-click export/import of `.codepath/*.json`, auto-switch and focus after import, clipboard sharing on Windows/macOS |
| Developer Experience | Command palette and shortcuts, actionable error hints, configurable defaults for layout, performance, and persistence |

## Typical Use Cases

- **Debug complex logic**: Map function call chains step-by-step and keep node locations in sync as code moves.
- **Review or handover**: Export graphs for teammates to review critical paths and reduce explanation time.
- **Document and teach**: Capture execution flows in structured text to support onboarding or workshops.
- **Refactor safely**: Combine auto-update confidence scores with manual checks to ensure important nodes remain valid.

## Requirements

- VS Code 1.74.0 or newer
- Node.js latest LTS (for extension development and testing)
- An open workspace or folder

## Quick Start

### Install the Extension
1. Open VS Code and go to the Extensions view (`Ctrl+Shift+X`).
2. Search for **Code Path Marker**.
3. Click Install and reload VS Code when prompted.

### Build Your First Execution Path
1. Select any code snippet and choose `Code Path → Mark as New Node` to create a root.
2. Keep selecting code and use `Mark as Child Node`, `Mark as Parent Node`, or `Mark as Bro Node` to build hierarchy.
3. Click nodes inside the Code Path preview panel to navigate to the file and view the live tree.
4. When code shifts, press Refresh and follow the guidance to update node locations.

### Keyboard Shortcuts

| Action | Shortcut | Description |
| --- | --- | --- |
| Toggle preview panel | `Ctrl+Shift+C` | Show or hide the Code Path preview panel |
| Mark new node | `Ctrl+Alt+N` | Create a new root node from the current selection |
| Mark child node | `Ctrl+Alt+C` | Add a child node under the current node |
| Mark parent node | `Ctrl+Alt+P` | Add a parent node above the current node |
| Mark sibling node | `Ctrl+Alt+B` | Add a sibling node at the same level |
| Switch node | `Ctrl+Alt+S` | Fuzzy search and select a different node |
| Switch Code Path | `Ctrl+Shift+G` | Jump between different graphs |
| Toggle view format | `Ctrl+Shift+T` | Reserved for future diagram formats (currently text-only) |
| Refresh preview | `Ctrl+Shift+R` | Refresh the preview and rerun location checks |

Use `Ctrl+Shift+P` and search for "Code Path Marker" to discover the full command set.

## Workflow Guide

### Building and Organizing Nodes
- The first node automatically creates a new graph; subsequent nodes follow the hierarchy of the current Code Path.
- Node names default to function or file information. Edit nodes to add multi-line descriptions and lightweight Markdown formatting.
- Context menu and shortcuts support copy, paste, cut, move up, and move down so you can keep the execution tree tidy.

### Intelligent Location Tracking
- Location Tracker blends exact positioning, proximity search, full-text search, and fuzzy matching to recover nodes after code changes.
- Refresh results include `exact`, `high`, `medium`, or `low` confidence labels to guide whether manual review is needed.
- Accepting an update syncs file path, line range, and snippet while the preview refreshes immediately.
- If a lookup fails, keep the original location or use "Navigate to Original" to inspect the previous spot.

### Graph Management and Visualization
- The status bar menu surfaces the active Code Path, node count, and auto-save state at a glance.
- Maintain multiple graphs within one workspace and switch seamlessly; the preview and status bar stay in sync.
- Text view provides a minimal hierarchical tree with instant refresh. Diagram formats are under development.
- The preview context menu offers refresh, export, copy, paste, cut, and reorder options, replacing the default browser menu.

### Collaboration and Sharing
- Graph data lives in `.codepath/` using JSON, making it easy to version control and review diffs.
- Export the current graph from the preview or command palette. You can copy the graph file to the clipboard (Windows/macOS) or share the path (Linux).
- Importing a `.codepath/*.json` file auto-switches to that graph and focuses the current node so everyone stays aligned.

## Advanced Capabilities

- **Tree Forks**: Adding a second parent to a node automatically forms a fork, enabling parallel execution paths for the same code.
- **Batch Maintenance**: Validation rules help prevent structural breaks when updating many nodes at once.
- **File/Folder Nodes**: Mark files or directories from the explorer to highlight entry points or module boundaries.
- **Split-screen Workflows**: Use VS Code split layout to display source and preview side by side when presenting or teaching.
- **Automatic Backups**: Configure auto-save intervals; background backups guard against data loss on unexpected exits.

## Configuration

Tune settings via VS Code Preferences (`Ctrl+,`) and search for "Code Path Marker". Key options include:

| Setting | Default | Description |
| --- | --- | --- |
| (Internal) default preview mode | `"text"` | Currently locked to text view and not user configurable |
| `codepath.autoSave` | `true` | Enable automatic graph saving |
| `codepath.autoLoadLastGraph` | `true` | Load the most recent graph on startup |
| `codepath.autoOpenPreviewOnStartup` | `true` | Automatically reveal the preview after loading the last graph |
| `codepath.previewRefreshInterval` | `1000` | Preview refresh interval in milliseconds |
| `codepath.maxNodesPerGraph` | `100` | Soft limit per graph; exceeding may trigger performance notices |

See `docs/CONFIGURATION-EN.md` for the full option list.

## Data Footprint

- Graph files: `.codepath/*.json` (recommended for version control to track history)
- Backups: `.codepath/backups/` (timestamped snapshots for manual recovery)
- Temporary files: `.codepath/tmp/` (staging area for import/export operations)

## Troubleshooting Cheatsheet

- **"Please select code text first"**: Highlight code before marking a node; `Ctrl+L` selects the current line quickly.
- **Location update failed**: Check whether the file was moved or renamed. Use "Navigate to Original" to review and re-mark.
- **Move node not working**: Ensure the node has siblings and is not already at the boundary.
- **Preview not refreshing**: Trigger `Ctrl+Shift+R` for a hard refresh; inspect the Output panel if issues persist.
- **Import has no effect**: Confirm the file resides in the workspace and that the JSON format was not manually altered.

More detailed guides live in `docs/LEARNING-GUIDE-EN.md` and `docs/QUICK_REFERENCE_AUTO_UPDATE.md`.

## FAQ

1. **Can I share graphs with teammates?** Yes. Export `.codepath` files and commit them alongside source. Git history makes collaboration transparent.
2. **Can I render diagrams today?** Diagram formatting is still under development; the preview currently focuses on text visualization.
3. **How do I keep large graphs responsive?** Split logic into multiple Code Paths and lower the refresh interval. The extension warns as you approach the node limit.

## Further Reading

- `docs/API-EN.md`: Command and internal module reference.
- `docs/AUTO_UPDATE_LOCATION_GUIDE.md`: Deep dive into the auto-update algorithm.
- `docs/STATUS_BAR_MENU.md`: Status bar features and shortcuts.
- `docs/change-log/`: Chronological Order notes; cross-reference `CHANGELOG.md` for release summaries.

## Contributing

- Review `docs/CONTRIBUTING-EN.md` for coding standards and workflow.
- Explore testing artifacts in `TEST_REPORT.md` and `FINAL_TEST_SUMMARY.md`.
- Submit ideas via Issues or Discussions, or open a Pull Request to collaborate.

## License

This project is licensed under MIT. See `LICENSE` in the repository root.

## Support

- Issues: <https://github.com/your-org/codepath-extension/issues>
- Discussions: <https://github.com/your-org/codepath-extension/discussions>
- Interactive docs: `docs/index.html`

---

**Enjoy the boost of visualizing your execution paths!**
