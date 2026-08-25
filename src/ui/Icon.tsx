// ─────────────────────────────────────────────────────────────────────────────
// Icon wrapper — uses react-icons (Feather set, stroke-based) so the app never
// depends on hand-rolled SVG paths or emoji.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiCheck, FiCornerUpLeft, FiCornerUpRight,
  FiDownload, FiEdit2, FiGithub, FiPlay, FiTrash2, FiUpload, FiX, FiZap,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';

const MAP: Record<string, IconType> = {
  undo: FiCornerUpLeft,
  redo: FiCornerUpRight,
  trash: FiTrash2,
  zap: FiZap,
  play: FiPlay,
  check: FiCheck,
  pencil: FiEdit2,
  x: FiX,
  arrowRight: FiArrowRight,
  arrowLeft: FiArrowLeft,
  arrowUp: FiArrowUp,
  arrowDown: FiArrowDown,
  github: FiGithub,
  download: FiDownload,
  upload: FiUpload,
};

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 16, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  const Cmp = MAP[name];
  return <Cmp size={size} className={className} title={title} aria-hidden="true" />;
}
