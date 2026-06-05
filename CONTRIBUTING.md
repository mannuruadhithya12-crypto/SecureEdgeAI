# Contributing to SecureEdgeMobile

Thank you for your interest in contributing! This document provides guidelines for contributing to the SecureEdgeMobile platform.

## Project Setup

1. **Fork and Clone**
   Fork the repository and clone it locally.
   ```bash
   git clone https://github.com/<your-username>/SecureEdgeMobile.git
   cd SecureEdgeMobile
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Android Build Environment**
   Ensure you have Android Studio installed along with JDK 17.
   ```bash
   npm run android
   ```

## Coding Standards
- **TypeScript:** Strict typing is enforced. Avoid `any`.
- **Linting & Formatting:** We use ESLint and Prettier. Run `npm run lint` before committing.
- **Commit Messages:** Follow Conventional Commits format (e.g., `feat: add blink detection`, `fix: SQLite offline issue`).

## Folder Structure
- `src/ai/`: TFLite inference logic, MobileFaceNet, BlazeFace.
- `src/camera/`: Camera processing and frame extraction.
- `src/components/`: Reusable React Native UI components.
- `src/database/`: SQLite local storage management.
- `src/security/`: Anti-tamper, anti-spoof, and liveness checks.

## Testing
- Add unit tests for all utility functions and pure logic.
- Run tests via `npm test`.

## Pull Request Guidelines
1. Ensure your branch is up-to-date with `main`.
2. Ensure all tests and linting checks pass.
3. Keep PRs small and focused on a single issue/feature.
4. Provide a clear description and testing instructions.
