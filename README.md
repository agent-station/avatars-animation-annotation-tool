# Avatars Animation Annotation Tool

A React + TypeScript web application for annotating and evaluating 3D humanoid character animations. Uses the [Agent Station Avatar SDK](https://www.npmjs.com/package/@agent-station/avatar-web) to display VRMA (VRM Animation) files and allows users to rate animations with quality, character type, and action tags.

## Features

- **VRMA Animation Playback**: View and evaluate 3D humanoid animations
- **Quality Ratings**: Mark animations as approved, rejected, or maybe
- **Character Tagging**: Assign character types (Sarang, Yeona, Other, None)
- **Action Tags**: Categorize animations (idle, greeting, reaction, conversation, locomotion, combat)
- **Keyboard Shortcuts**: Efficient annotation workflow
- **LocalStorage Persistence**: Annotations saved locally with import/export support
- **Filtering**: Filter animations by pack, category, or annotation status

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Generate Animation Manifest

Before first use, scan the `/animations` directory to create the manifest:

```bash
npm run generate-manifest
```

### Development

```bash
npm run dev
```

## Adding Animations

Place VRMA files in the `/animations` directory following this structure:

```
/animations
  /{pack-name}
    /{category}
      animation1.vrma
      animation2.vrma
```

After adding new files, regenerate the manifest:

```bash
npm run generate-manifest
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **1 / 2 / 3** | Set quality: approved / rejected / maybe |
| **S / Y / O / N** | Set character: Sarang / Yeona / Other / None |
| **I / G / R / C / L / X** | Toggle tags: idle / greeting / reaction / conversation / locomotion / combat |
| **Enter / Arrows** | Navigate animations |
| **Space** | Replay current animation |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
| `npm run generate-manifest` | Scan /animations and create manifest |

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Agent Station Avatar SDK

## License

MIT
