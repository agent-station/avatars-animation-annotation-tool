---
name: annotation-workflow
description: Annotation data management, localStorage persistence, and import/export workflows. Use when working with annotation data, debugging persistence issues, or implementing data features.
allowed-tools: Read, Glob, Grep, Bash
---

# Annotation Workflow Skill

Managing annotation data in the Animation Evaluator.

## Data Structures

### Annotation (per animation)
```typescript
interface Annotation {
  quality: 'approved' | 'rejected' | 'maybe';
  character: 'sarang' | 'yeona' | 'other' | 'none';
  tags: ('idle' | 'greeting' | 'reaction' | 'conversation' | 'locomotion' | 'combat')[];
  annotatedAt: string; // ISO timestamp
}
```

### AnnotationData (full dataset)
```typescript
interface AnnotationData {
  version: number;
  characters: string[];
  tags: string[];
  lastReviewedIndex: number;
  annotations: Record<string, Annotation>;
}
```

## Storage Key
```
localStorage key: 'animation-annotations'
```

## Data Flow

```
User Action
    ↓
setAnnotation(path, annotation)
    ↓
Update React state
    ↓
Persist to localStorage
    ↓
UI re-renders with new state
```

## useAnnotations Hook API

```typescript
const {
  data,                   // AnnotationData object
  isLoading,              // boolean
  getAnnotation,          // (path: string) => Annotation | undefined
  setAnnotation,          // (path: string, annotation: Annotation) => void
  setLastReviewedIndex,   // (index: number) => void
  getAnnotationCount,     // () => number
  exportAnnotations,      // () => void (downloads JSON)
  importAnnotations,      // (file: File) => void
} = useAnnotations();
```

## Export Format

Exported JSON file structure:
```json
{
  "version": 1,
  "characters": ["sarang", "yeona", "other", "none"],
  "tags": ["idle", "greeting", "reaction", "conversation", "locomotion", "combat"],
  "lastReviewedIndex": 42,
  "annotations": {
    "animations/kawaii-animations-100/idle/ka-idle01-breathing.vrma": {
      "quality": "approved",
      "character": "sarang",
      "tags": ["idle"],
      "annotatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## Common Operations

### Check if Animation is Annotated
```typescript
const isAnnotated = annotationData.annotations.hasOwnProperty(animationPath);
// or
const annotation = getAnnotation(animationPath);
const isAnnotated = annotation !== undefined;
```

### Count Annotations by Quality
```typescript
const approved = Object.values(annotations).filter(a => a.quality === 'approved').length;
const rejected = Object.values(annotations).filter(a => a.quality === 'rejected').length;
const maybe = Object.values(annotations).filter(a => a.quality === 'maybe').length;
```

### Filter by Character
```typescript
const sarangAnimations = Object.entries(annotations)
  .filter(([_, a]) => a.character === 'sarang')
  .map(([path]) => path);
```

### Get Annotations by Tag
```typescript
const idleAnimations = Object.entries(annotations)
  .filter(([_, a]) => a.tags.includes('idle'))
  .map(([path]) => path);
```

## Debug Commands

### View Current localStorage Data
```javascript
// In browser console
JSON.parse(localStorage.getItem('animation-annotations'))
```

### Clear All Annotations
```javascript
// In browser console
localStorage.removeItem('animation-annotations')
```

### Export to Console
```javascript
// In browser console
console.log(JSON.stringify(JSON.parse(localStorage.getItem('animation-annotations')), null, 2))
```

## Import Workflow

1. User clicks "Import" button
2. File picker opens for .json files
3. File is read as text
4. JSON is parsed and validated
5. Data is merged with existing annotations
6. localStorage is updated
7. UI refreshes

## Export Workflow

1. User clicks "Export" button
2. Current annotationData is serialized to JSON
3. Blob is created with JSON content
4. Download link is created and clicked
5. File saves as `animation-annotations-{timestamp}.json`

## Error Handling

### Invalid Import File
- Show error message
- Keep existing data intact
- Log parsing error to console

### localStorage Full
- Warn user about storage limits
- Suggest exporting data
- Consider data compression

### Corrupted Data
- Attempt recovery from valid fields
- Reset to defaults if unrecoverable
- Log error for debugging
