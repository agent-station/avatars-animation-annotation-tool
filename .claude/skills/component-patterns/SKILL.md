---
name: component-patterns
description: React component patterns and conventions used in this project. Use when implementing new components, understanding existing patterns, or refactoring components.
allowed-tools: Read, Glob, Grep
---

# Component Patterns Skill

React component patterns and conventions for the Animation Evaluator.

## Project Component Structure

```
src/components/
├── AvatarViewer.tsx      # 3D animation viewer canvas
├── AnnotationPanel.tsx   # Quality/tag input panel
├── AnimationList.tsx     # Filterable animation sidebar
└── ProgressBar.tsx       # Progress indicator
```

## Component Conventions

### 1. Functional Components Only
```tsx
// Good
function ComponentName({ prop1, prop2 }: Props) {
  return <div>...</div>;
}

// Also good (named export)
export function ComponentName({ prop1 }: Props) {
  return <div>...</div>;
}
```

### 2. Props Interface Pattern
```tsx
interface ComponentNameProps {
  // Required props
  requiredProp: string;

  // Optional props with defaults
  optionalProp?: boolean;

  // Callbacks
  onAction: (value: string) => void;

  // Children (if needed)
  children?: React.ReactNode;
}

export function ComponentName({
  requiredProp,
  optionalProp = false,
  onAction,
}: ComponentNameProps) {
  // ...
}
```

### 3. Custom Hooks Pattern
```tsx
// src/hooks/useFeatureName.ts
export function useFeatureName(initialValue: T) {
  const [state, setState] = useState<T>(initialValue);

  const action = useCallback(() => {
    // logic
  }, [dependencies]);

  return {
    state,
    action,
  };
}
```

### 4. Tailwind Styling Pattern
```tsx
// Use utility classes directly
<div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg">

// Conditional classes
<button className={`
  px-3 py-1.5 rounded transition-colors
  ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}
`}>

// Dark theme base colors
// bg-gray-900 - main background
// bg-gray-800 - card/panel background
// bg-gray-700 - interactive elements
// text-white - primary text
// text-gray-300 - secondary text
// text-gray-500 - muted text
```

## Key Component Patterns

### AvatarViewer
- Receives animation path as prop
- Uses `key` prop for replay functionality
- Handles loading and error states
- Canvas-based 3D rendering

### AnnotationPanel
- Controlled component pattern
- Receives current annotation as prop
- Calls `onAnnotationChange` on updates
- Navigation buttons (prev/next/replay)

### AnimationList
- Virtualized list for performance
- Filter state managed by parent
- Highlights current selection
- Shows annotation status indicators

### ProgressBar
- Simple presentational component
- Receives current/total/annotated counts
- No internal state

## State Management Pattern

### Local State (useState)
- UI-only state (current index, replay key)
- Temporary state (loading, error)

### Persisted State (localStorage via custom hook)
- Annotations data
- Last reviewed index
- User preferences

### Derived State (useMemo)
- Filtered animation lists
- Annotation counts
- Category lists

## Event Handler Naming
```tsx
// Component-level handlers
const handleClick = () => { ... };
const handleSubmit = () => { ... };

// Prop callbacks
onSelect: (index: number) => void;
onFilterChange: (filter: Filter) => void;
onAnnotationChange: (path: string, annotation: Annotation) => void;
```

## Type Patterns

```tsx
// Use union types for fixed options
type Quality = 'approved' | 'rejected' | 'maybe';

// Use interfaces for objects
interface Annotation {
  quality: Quality;
  tags: string[];
}

// Use Record for dictionaries
type Annotations = Record<string, Annotation>;
```
