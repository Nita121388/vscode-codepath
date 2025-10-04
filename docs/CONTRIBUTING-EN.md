# Contributing to CodePath Extension

Thank you for your interest in contributing to CodePath! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 16 or higher
- **VS Code**: Latest stable version
- **Git**: For version control
- **TypeScript**: Basic knowledge recommended

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/codepath-extension.git
   cd codepath-extension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Launch Extension Development Host**
   - Press `F5` or use "Run Extension" from the Run and Debug panel
   - A new VS Code window opens with the extension loaded

## 🏗️ Project Structure

```
codepath-extension/
├── src/                          # Source code
│   ├── extension.ts             # Main extension entry point
│   ├── managers/                # Core business logic managers
│   ├── models/                  # Data models (Graph, Node)
│   ├── renderers/               # Preview rendering (Text, Mermaid)
│   ├── types/                   # TypeScript type definitions
│   ├── interfaces/              # Interface definitions
│   └── integration/             # Integration tests
├── package.json                 # Extension manifest and dependencies
├── tsconfig.json               # TypeScript configuration
├── vitest.config.js            # Test configuration
└── README.md                   # User documentation
```

### Key Components

- **Extension.ts**: Main activation and deactivation logic
- **Managers**: Business logic for graphs, nodes, preview, storage, etc.
- **Models**: Graph and Node data structures with validation
- **Renderers**: Text and Mermaid diagram generation
- **Integration Tests**: End-to-end workflow testing

## 🧪 Testing

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Run specific test file
npm run test:unit -- src/managers/GraphManager.test.ts

# Run integration tests
npm run test:unit -- src/integration/

# Run with coverage
npm run test:unit -- --coverage
```

### Test Structure

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test complete workflows and component interactions
- **Performance Tests**: Validate performance characteristics
- **Edge Case Tests**: Test error conditions and boundary cases

### Writing Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentName', () => {
    let component: ComponentName;

    beforeEach(() => {
        component = new ComponentName();
    });

    it('should perform expected behavior', () => {
        // Arrange
        const input = 'test input';
        
        // Act
        const result = component.method(input);
        
        // Assert
        expect(result).toBe('expected output');
    });
});
```

## 🎯 Development Guidelines

### Code Style

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the configured ESLint rules
- **Formatting**: Use consistent formatting (Prettier recommended)
- **Naming**: Use descriptive names for variables, functions, and classes

### Architecture Principles

1. **Separation of Concerns**: Each manager handles a specific domain
2. **Dependency Injection**: Pass dependencies through constructors
3. **Error Handling**: Use custom error types with recovery suggestions
4. **Async/Await**: Prefer async/await over promises for readability
5. **Immutability**: Avoid mutating objects when possible

### VS Code Extension Best Practices

- **Activation Events**: Use specific activation events, not `*`
- **Commands**: Register all commands in `package.json`
- **Configuration**: Use VS Code configuration API for settings
- **Disposables**: Properly dispose of resources to prevent memory leaks
- **Error Messages**: Provide helpful, actionable error messages

## 🐛 Bug Reports

### Before Submitting

1. **Search Existing Issues**: Check if the bug is already reported
2. **Reproduce**: Ensure the bug is reproducible
3. **Minimal Example**: Create a minimal reproduction case
4. **Environment**: Note VS Code version, OS, and extension version

### Bug Report Template

```markdown
**Bug Description**
A clear description of what the bug is.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- OS: [e.g. Windows 10, macOS 12.0]
- VS Code Version: [e.g. 1.74.0]
- Extension Version: [e.g. 0.1.0]

**Additional Context**
Any other context about the problem.
```

## ✨ Feature Requests

### Before Submitting

1. **Check Existing Requests**: Look for similar feature requests
2. **Use Case**: Clearly describe the use case and problem
3. **Alternatives**: Consider if existing features could solve the problem
4. **Scope**: Keep the scope focused and well-defined

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature you'd like to see.

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would you like this feature to work?

**Alternatives Considered**
What alternatives have you considered?

**Additional Context**
Any other context or screenshots about the feature request.
```

## 🔄 Pull Request Process

### Before Creating a PR

1. **Issue First**: Create or reference an existing issue
2. **Branch**: Create a feature branch from `main`
3. **Tests**: Add tests for new functionality
4. **Documentation**: Update documentation as needed
5. **Lint**: Ensure code passes linting

### PR Guidelines

1. **Title**: Use descriptive titles (e.g., "Add fuzzy node matching feature")
2. **Description**: Explain what changes were made and why
3. **Testing**: Describe how the changes were tested
4. **Breaking Changes**: Clearly mark any breaking changes
5. **Screenshots**: Include screenshots for UI changes

### PR Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or clearly documented)
```

## 📝 Code Review Process

### For Contributors

- **Be Responsive**: Respond to review comments promptly
- **Be Open**: Be open to feedback and suggestions
- **Explain**: Explain your reasoning for implementation choices
- **Test**: Ensure all tests pass before requesting review

### For Reviewers

- **Be Constructive**: Provide helpful, constructive feedback
- **Be Specific**: Point to specific lines and suggest improvements
- **Be Timely**: Review PRs in a reasonable timeframe
- **Be Thorough**: Check code quality, tests, and documentation

## 🏷️ Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Update Version**: Update version in `package.json`
2. **Update Changelog**: Document changes in `CHANGELOG.md`
3. **Test**: Run full test suite
4. **Build**: Create production build
5. **Tag**: Create git tag for release
6. **Publish**: Publish to VS Code Marketplace

## 🤝 Community Guidelines

### Code of Conduct

- **Be Respectful**: Treat all contributors with respect
- **Be Inclusive**: Welcome contributors from all backgrounds
- **Be Collaborative**: Work together to improve the project
- **Be Professional**: Maintain professional communication

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions and reviews

## 📚 Resources

### VS Code Extension Development

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Best Practices](https://typescript-eslint.io/docs/)

### Testing

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🙏 Recognition

Contributors will be recognized in:
- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graphs and statistics

Thank you for contributing to CodePath! Your efforts help make code visualization better for developers everywhere. 🚀