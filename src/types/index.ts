export type Quality = 'approved' | 'rejected' | 'maybe';
export type Character = 'sarang' | 'yeona' | 'other' | 'none';
export type ActionTag = 'idle' | 'greeting' | 'reaction' | 'conversation' | 'locomotion' | 'combat';

export interface Annotation {
  quality: Quality;
  character: Character;
  tags: ActionTag[];
  annotatedAt: string;
}

export interface AnnotationData {
  version: number;
  characters: Character[];
  tags: ActionTag[];
  lastReviewedIndex: number;
  lastReviewedPath: string | null;
  annotations: Record<string, Annotation>;
}

export interface AnimationEntry {
  path: string;
  pack: string;
  category: string | null;
  filename: string;
}

export interface AnimationManifest {
  version: number;
  generatedAt: string;
  totalCount: number;
  packs: string[];
  animations: AnimationEntry[];
}
