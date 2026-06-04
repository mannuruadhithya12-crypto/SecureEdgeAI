import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
};

export default theme;
export type Theme = typeof theme;
export { colors, spacing, typography, shadows };
