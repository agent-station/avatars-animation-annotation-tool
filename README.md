# Avatars Animation Annotation Tool

A React + TypeScript web application for annotating and evaluating 3D humanoid character animations. Uses the [Agent Station Avatar SDK](https://www.npmjs.com/package/@agent-station/avatar-web) to display VRMA (VRM Animation) files and allows users to rate animations with quality, character type, and action tags.

## Features

- **VRMA Animation Playback**: View and evaluate 3D humanoid animations
- **Quality Ratings**: Mark animations as approved, rejected, or maybe
- **Character Tagging**: Assign character types (Sarang, Yeona, Other, None)
- **Action Tags**: Categorize animations (idle, greeting, reaction, conversation, locomotion, combat)
- **Keyboard Shortcuts**: Efficient annotation workflow
- **LocalStorage Persistence**: Annotations saved locally with import/export support
- **Cloud Sync** (optional): Sync annotations to AWS DynamoDB for multi-device/team access
- **Offline-First**: Local changes queue and sync automatically when online
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

### Environment Configuration (Optional)

To enable cloud sync, create a `.env.local` file:

```bash
cp .env.example .env.local
```

Configure the following variables:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API endpoint (enables cloud sync when set) |
| `VITE_USER_ID` | User identifier for multi-user support |

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
| **P** | Pause/Play toggle |
| **?** | Show keyboard shortcuts help |
| **Ctrl+Z / Cmd+Z** | Undo last annotation change |
| **Ctrl+Shift+Z / Cmd+Shift+Z** | Redo |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run build:prod` | Production build with correct base path |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
| `npm run generate-manifest` | Scan /animations and create manifest |
| `npm run deploy` | Build, upload to S3, and invalidate CloudFront |

## Deployment

Deploy the app to AWS S3 with CloudFront CDN:

```bash
npm run deploy
```

This command:
1. Builds the app with the correct base path (`/apps/animation-reviewer/`)
2. Syncs the `dist/` folder to S3
3. Invalidates the CloudFront cache

**Production URL**: https://avatars.staging.agsn.ai/apps/animation-reviewer/

**Note**: Requires AWS CLI configured with `agent-station-staging` profile.

## Cloud Infrastructure (Optional)

The `/infra` directory contains AWS CDK infrastructure for cloud sync:

```bash
cd infra
npm install
npm run deploy    # Deploy to AWS
```

### Architecture
- **DynamoDB**: Serverless annotation storage with point-in-time recovery
- **Lambda**: Node.js 20 API handler
- **API Gateway**: REST API with CORS, throttling, and compression

After deployment, copy the API endpoint URL to your `.env.local` file as `VITE_API_URL`.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Agent Station Avatar SDK
- AWS CDK (infrastructure)

## License

MIT
