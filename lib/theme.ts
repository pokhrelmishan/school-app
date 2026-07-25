export const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  primaryBg: '#EEF2FF',

  success: '#10B981',
  successBg: '#D1FAE5',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',

  bg: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  white: '#FFFFFF',
  black: '#000000',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const FONTS = {
  body: 'System',
  mono: 'Courier',
};

// Keep old exports for backward compatibility during transition
export const COLORS_LEGACY = {
  cover: COLORS.primaryDark,
  paper: COLORS.bg,
  paperDim: COLORS.surfaceAlt,
  tape: COLORS.danger,
  pencil: COLORS.primary,
  chalk: COLORS.success,
  chalkSoft: COLORS.successBg,
  ink: COLORS.text,
  graphite: COLORS.textSecondary,
  graphiteLight: COLORS.textTertiary,
  line: COLORS.border,
  danger: COLORS.danger,
};
