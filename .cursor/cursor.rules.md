# LLM Agent Template Cursor Rules

This document outlines the coding standards and best practices for the project. These rules are designed to ensure consistency, maintainability, and high-quality code across the codebase.

## Table of Contents

- [TypeScript Guidelines](#typescript-guidelines)
- [React Best Practices](#react-best-practices)
- [Code Style](#code-style)
- [Project Structure](#project-structure)
- [Import Guidelines](#import-guidelines)
- [Testing Standards](#testing-standards)
- [Documentation Requirements](#documentation-requirements)
- [Performance Considerations](#performance-considerations)
- [Accessibility Standards](#accessibility-standards)
- [Security Best Practices](#security-best-practices)

## TypeScript Guidelines

### Explicit Types

Always use explicit types for function parameters and return types to improve code readability and type safety.

```typescript
// Good
function calculateTotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}

// Avoid
function calculateTotal(items) {
  return items.reduce((total, item) => total + item.price, 0);
}
```

### Import Style

Use named imports for better clarity and to enable tree-shaking.

```typescript
// Good
import { useState, useEffect } from 'react';

// Avoid
import * as React from 'react';
```

### Interfaces vs Types

Prefer interfaces over types for object definitions as they are more extensible and provide better error messages.

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

// Avoid
type User = {
  id: string;
  name: string;
  email: string;
};
```

### Optional Chaining and Nullish Coalescing

Use optional chaining (`?.`) and nullish coalescing (`??`) operators to handle potentially undefined or null values.

```typescript
// Good
const userName = user?.name ?? 'Guest';

// Avoid
const userName = user && user.name ? user.name : 'Guest';
```

### Const Assertions

Use const assertions for literal values to ensure type safety.

```typescript
// Good
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const;

// Avoid
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};
```

## React Best Practices

### Functional Components

Use functional components with hooks instead of class components.

```typescript
// Good
const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  return <div>{user.name}</div>;
};

// Avoid
class UserProfile extends React.Component<UserProfileProps> {
  render() {
    return <div>{this.props.user.name}</div>;
  }
}
```

### React Hooks

Use React hooks for state management and side effects.

```typescript
// Good
const [isLoading, setIsLoading] = useState(false);
useEffect(() => {
  // Effect logic
}, [dependencies]);

// Avoid
this.setState({ isLoading: false });
componentDidUpdate(prevProps) {
  // Update logic
}
```

### Effect Dependencies

Always specify the correct dependency array for useEffect to prevent unnecessary re-renders and infinite loops.

```typescript
// Good
useEffect(() => {
  fetchData(userId);
}, [userId]);

// Avoid
useEffect(() => {
  fetchData(userId);
}, []); // Missing dependency
```

### Props Destructuring

Destructure props for cleaner code and better readability.

```typescript
// Good
const UserCard: React.FC<UserCardProps> = ({ name, email, avatar }) => {
  return (
    <div>
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
};

// Avoid
const UserCard: React.FC<UserCardProps> = (props) => {
  return (
    <div>
      <img src={props.avatar} alt={props.name} />
      <h3>{props.name}</h3>
      <p>{props.email}</p>
    </div>
  );
};
```

### Key Usage in Lists

Always use unique keys when rendering lists to help React identify which items have changed.

```typescript
// Good
{items.map((item) => (
  <ListItem key={item.id} item={item} />
))}

// Avoid
{items.map((item, index) => (
  <ListItem key={index} item={item} />
))}
```

## Code Style

### String Quotes

Use single quotes for strings.

```typescript
// Good
const name = 'John Doe';

// Avoid
const name = "John Doe";
```

### Trailing Commas

Use trailing commas in multiline objects and arrays for cleaner diffs.

```typescript
// Good
const user = {
  name: 'John',
  email: 'john@example.com',
  role: 'admin',
};

// Avoid
const user = {
  name: 'John',
  email: 'john@example.com',
  role: 'admin'
};
```

### Line Length

Keep lines under 120 characters for better readability.

### Indentation

Use 2 spaces for indentation.

### Semicolons

Always use semicolons at the end of statements.

### Naming Conventions

- Use PascalCase for components, interfaces, and types
- Use camelCase for variables, functions, and methods
- Use UPPER_CASE for constants

```typescript
// Components, interfaces, types
interface UserProfile {}
type UserRole = 'admin' | 'user';
const UserCard: React.FC = () => {};

// Variables, functions, methods
const userName = 'John';
function getUserData() {}
const calculateTotal = () => {};

// Constants
const API_URL = 'https://api.example.com';
const MAX_RETRIES = 3;
```

## Project Structure

### Directory Organization

- Web components: `packages/web/components`
- Web app pages: `packages/web/app`
- Server source code: `packages/server/src`
- Utility functions: `packages/utils/src`

### File Naming

Use kebab-case for file names.

```
user-profile.tsx
auth-service.ts
api-client.ts
```

### Directory Structure

Follow the established directory structure for consistency.

## Import Guidelines

### Grouping Imports

Group and sort imports in the following order:
1. External libraries
2. Internal modules
3. Relative imports
4. CSS/SCSS imports

```typescript
// External libraries
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// Internal modules
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

// Relative imports
import { UserCard } from './user-card';
import { UserAvatar } from './user-avatar';

// CSS/SCSS imports
import './styles.css';
```

### Absolute Imports

Use absolute imports for project modules to avoid deep nesting issues.

```typescript
// Good
import { Button } from '@/components/ui/button';

// Avoid
import { Button } from '../../../../components/ui/button';
```

### Circular Dependencies

Avoid circular dependencies as they can lead to unexpected behavior and make the codebase harder to understand.

## Testing Standards

### Test File Naming

Name test files with the `.test.ts` or `.test.tsx` suffix.

```
user-service.test.ts
user-profile.test.tsx
```

### Coverage Thresholds

Aim for at least 80% test coverage for critical code paths.

## Documentation Requirements

### JSDoc for Public APIs

Use JSDoc comments for public APIs to provide clear documentation.

```typescript
/**
 * Authenticates a user with the provided credentials
 * @param email - The user's email address
 * @param password - The user's password
 * @returns A promise that resolves to the authenticated user or rejects with an error
 */
async function authenticateUser(email: string, password: string): Promise<User> {
  // Implementation
}
```

### Comment Style

Use `//` for single-line comments and `/* */` for multi-line comments.

## Performance Considerations

### Unnecessary Re-renders

Avoid unnecessary re-renders by using React.memo, useMemo, and useCallback where appropriate.

```typescript
// Memoize expensive component
const MemoizedComponent = React.memo(ExpensiveComponent);

// Memoize expensive calculation
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);

// Memoize callback
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### Memoization

Use memoization for expensive computations to avoid redundant calculations.

## Accessibility Standards

### ARIA Attributes

Use appropriate ARIA attributes to improve accessibility.

```typescript
// Good
<button aria-label="Close dialog" onClick={closeDialog}>
  <span className="icon-close" />
</button>

// Avoid
<button onClick={closeDialog}>
  <span className="icon-close" />
</button>
```

## Security Best Practices

### Avoid dangerouslySetInnerHTML

Avoid using dangerouslySetInnerHTML as it can lead to XSS vulnerabilities.

```typescript
// Avoid
<div dangerouslySetInnerHTML={{ __html: userProvidedContent }} />

// Prefer
<div>{sanitizedContent}</div>
```

### User Input Sanitization

Always sanitize user input to prevent security vulnerabilities.

```typescript
// Good
const sanitizedInput = sanitizeInput(userInput);

// Avoid
const query = `SELECT * FROM users WHERE name = '${userInput}'`;
``` 
