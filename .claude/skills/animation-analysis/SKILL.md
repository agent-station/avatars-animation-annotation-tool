---
name: animation-analysis
description: Analyze VRMA animation files, understand bone structures, and evaluate animation quality. Use when reviewing animation files, checking file structure, or understanding animation organization.
allowed-tools: Read, Glob, Grep, Bash
---

# Animation Analysis Skill

Analyze and understand VRMA animation files in the project.

## Animation Directory Structure

```
animations/
└── kawaii-animations-100/
    ├── action/
    │   ├── ka-dash-*.vrma
    │   ├── ka-jump*.vrma
    │   ├── ka-swimming-*.vrma
    │   └── ka-fly-*.vrma
    ├── combat/
    │   ├── ka-combat-bare-hands-*.vrma
    │   ├── ka-combat-heavy-sword-*.vrma
    │   ├── ka-combat-ohsword01-*.vrma
    │   └── ka-combat-witch-*.vrma
    ├── idle/
    │   └── ka-idle*.vrma
    └── locomotion/
        ├── ka-walk-*.vrma
        ├── ka-run-*.vrma
        └── ka-turn-*.vrma
```

## VRMA File Format

VRMA (VRM Animation) is a JSON-based format:

```json
{
  "asset": {
    "version": "2.0",
    "generator": "..."
  },
  "extensions": {
    "VRMC_vrm_animation": {
      "specVersion": "1.0",
      "humanoid": {
        "humanBones": {
          "hips": { "node": 0 },
          "spine": { "node": 1 },
          ...
        }
      }
    }
  },
  "animations": [
    {
      "channels": [...],
      "samplers": [...]
    }
  ]
}
```

## Quick Analysis Commands

### List All Animations
```bash
find animations -name "*.vrma" | wc -l
```

### List by Category
```bash
find animations/*/action -name "*.vrma" | wc -l
find animations/*/combat -name "*.vrma" | wc -l
find animations/*/idle -name "*.vrma" | wc -l
find animations/*/locomotion -name "*.vrma" | wc -l
```

### Search Animation Names
```bash
find animations -name "*idle*"
find animations -name "*combat*"
find animations -name "*jump*"
```

## Animation Naming Convention

Pattern: `{pack-prefix}-{category}-{action}-{variant}.vrma`

| Prefix | Pack |
|--------|------|
| ka | Kawaii Animations 100 |

| Category | Types |
|----------|-------|
| idle | Breathing, expressions, poses |
| combat | Attack combos, damage, magic |
| action | Jump, dash, swim, fly, death |
| locomotion | Walk, run, turn |

## Quality Assessment Criteria

### Technical Checks
- File loads without errors
- Animation duration reasonable
- Bone targets are valid humanoid bones
- No NaN or infinity values in keyframes

### Visual Checks
- Smooth motion (no jitter)
- Natural poses
- Good loop points (if looping)
- Appropriate timing

## Manifest Generation

Generate animation manifest for the app:
```bash
npm run generate-manifest
```

This creates `public/animation-manifest.json` with:
- All animation paths
- Pack/category organization
- Filename metadata
