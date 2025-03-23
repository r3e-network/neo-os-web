# Contributing to Neo N3 Service Layer

We love your input! We want to make contributing to Neo N3 Service Layer as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

### Documentation-First Development

We follow a documentation-first approach to development:

1. **Start with Documentation First**
   - Create documentation files before writing implementation code
   - Document intent, requirements, and expected behavior before coding

2. **Documentation/Implementation Pairing**
   - For each feature, maintain paired documentation and implementation files
   - Update documentation immediately before or after modifying code

3. **Documentation-Based Navigation**
   - Navigate to documentation files first, then to related implementation
   - Use documentation as a map to understand where code changes should occur

4. **Documentation Completeness**
   - Track documentation coverage percentage as a team metric
   - Require minimum documentation thresholds before features are considered "done"

### Code Style

* We use Go modules for dependency management
* Follow the [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
* Run `go fmt` before committing
* Ensure all tests pass with `make test`
* Maintain backward compatibility unless explicitly breaking changes

## Reporting Bugs

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/R3E-Network/service_layer/issues/new); it's that easy!

### Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Feature Requests

We love feature requests! To submit a feature request, please:

1. Check if the feature already exists or has been requested
2. Use the feature request template when opening an issue
3. Clearly describe the problem the feature would solve
4. Explain the solution you'd like to see implemented
5. Discuss alternatives you've considered

## Community

Join our community channels to discuss the project:
- Discord: [Join our Discord server](https://discord.gg/r3e-network)
- Telegram: [Join our Telegram group](https://t.me/r3enetwork)

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.