import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design baseline (e.g. iPhone 11/12 width is ~390)
const BASE_WIDTH = 390;
export const BASE_HEIGHT = 844;

export const isTablet = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= 600;

/**
 * Scale font size based on screen width
 */
export function scaleFont(size: number): number {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  
  // Cap scaling to prevent extremely large fonts on tablets
  const scaledSize = isTablet 
    ? size * 1.25 
    : Platform.OS === 'ios' 
      ? Math.round(PixelRatio.roundToNearestPixel(newSize))
      : Math.round(PixelRatio.roundToNearestPixel(newSize)) - 1;
      
  return Math.max(size * 0.85, scaledSize);
}

/**
 * Scale spacing (padding, margin, width, height) based on screen size
 */
export function scaleSpacing(size: number): number {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return isTablet ? size * 1.2 : Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Safe area and layout constraints for tablets
 */
export const layoutStyles = {
  tabletContainer: {
    width: '100%',
    maxWidth: isTablet ? 600 : undefined,
    alignSelf: 'center' as const,
  },
  cardBorderRadius: scaleSpacing(16),
  touchTargetMin: 44,
};
