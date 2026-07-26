import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { COLORS, SHADOWS } from '../lib/theme';

// ─── Screen Header (dark cover with handwritten title) ──
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={hdrStyles.cover}>
      <View style={hdrStyles.content}>
        {subtitle ? (
          <Text style={hdrStyles.school}>{subtitle.toUpperCase()}</Text>
        ) : null}
        <Text style={hdrStyles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  cover: {
    backgroundColor: COLORS.cover,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  content: { flex: 1 },
  school: {
    fontSize: 11,
    color: COLORS.graphiteLight,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.paper,
    marginTop: 4,
    letterSpacing: -0.3,
  },
});

// ─── Tape Strip ────────────────────────────────────────
export function TapeStrip({ label }: { label: string }) {
  return (
    <View style={tapeStyles.wrap}>
      <Text style={tapeStyles.text}>{label}</Text>
    </View>
  );
}

const tapeStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: COLORS.tape,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 2,
    transform: [{ rotate: '-1.5deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  text: {
    color: COLORS.white,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});

// ─── Category Pill ─────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Deadline: COLORS.tape,
  Club: COLORS.chalk,
  Holiday: COLORS.pencil,
  Event: COLORS.blue,
  Academic: COLORS.tape,
  Sports: COLORS.chalk,
  School: COLORS.chalk,
  Health: COLORS.blue,
  PTA: COLORS.pencil,
  deadline: COLORS.tape,
  club: COLORS.chalk,
  holiday: COLORS.pencil,
  event: COLORS.blue,
  academic: COLORS.tape,
  sports: COLORS.chalk,
  school: COLORS.chalk,
  health: COLORS.blue,
  pta: COLORS.pencil,
};

export function CatPill({ category }: { category: string }) {
  const c = CAT_COLORS[category] || COLORS.graphite;
  return (
    <View style={[catStyles.pill, { borderColor: c }]}>
      <Text style={[catStyles.text, { color: c }]}>{category}</Text>
    </View>
  );
}

const catStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

// ─── Notebook Card ─────────────────────────────────────
export function NotebookCard({
  children,
  style,
  onPress,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accent?: string;
}) {
  const content = (
    <View style={[cardStyles.card, accent && { borderLeftWidth: 4, borderLeftColor: accent }, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
});

// ─── Paper Card (older style, no border) ──────────────
export function PaperCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[paperStyles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[paperStyles.card, style]}>{children}</View>;
}

const paperStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
});

// ─── Stat Card ─────────────────────────────────────────
export function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}) {
  const c = color || COLORS.chalk;
  const content = (
    <View style={[statStyles.card, { borderLeftColor: c }]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={[statStyles.value, { color: c }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const statStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  icon: { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, color: COLORS.graphite, marginTop: 2, fontWeight: '600' },
});

// ─── Badge ──────────────────────────────────────────────
export function Badge({
  text,
  color,
  size = 'sm',
}: {
  text: string;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const c = color || COLORS.chalk;
  return (
    <View
      style={[
        badgeStyles.badge,
        { backgroundColor: c + '18' },
        size === 'md' && badgeStyles.badgeMd,
      ]}
    >
      <Text
        style={[
          badgeStyles.text,
          { color: c },
          size === 'md' && badgeStyles.textMd,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeMd: { paddingHorizontal: 12, paddingVertical: 5 },
  text: { fontSize: 11, fontWeight: '700' },
  textMd: { fontSize: 13 },
});

// ─── Empty State ───────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>{icon}</Text>
      <Text style={emptyStyles.title}>{title}</Text>
      {subtitle ? <Text style={emptyStyles.sub}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity
          style={emptyStyles.btn}
          activeOpacity={0.7}
          onPress={action.onPress}
        >
          <Text style={emptyStyles.btnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    borderRadius: 14,
    marginVertical: 8,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 13, color: COLORS.graphite, marginTop: 6, textAlign: 'center' },
  btn: {
    marginTop: 16,
    backgroundColor: COLORS.cover,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnText: { color: COLORS.paper, fontWeight: '700', fontSize: 14 },
});

// ─── Loading Screen ────────────────────────────────────
export function LoadingScreen({ text }: { text?: string }) {
  return (
    <View style={loadStyles.wrap}>
      <ActivityIndicator size="large" color={COLORS.cover} />
      {text ? <Text style={loadStyles.text}>{text}</Text> : null}
    </View>
  );
}

const loadStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  text: { marginTop: 12, fontSize: 13, color: COLORS.graphite },
});

// ─── Section Header ────────────────────────────────────
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={secStyles.row}>
      <Text style={secStyles.title}>{title}</Text>
      {action ? (
        <TouchableOpacity activeOpacity={0.7} onPress={action.onPress}>
          <Text style={secStyles.action}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  action: { fontSize: 13, fontWeight: '600', color: COLORS.tape },
});

// ─── Avatar ────────────────────────────────────────────
export function Avatar({
  name,
  size = 40,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const c = color || COLORS.chalk;
  const initial = (name || '?')[0].toUpperCase();

  return (
    <View
      style={[
        avStyles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.chalkSoft,
        },
      ]}
    >
      <Text style={[avStyles.text, { fontSize: size * 0.4, color: c }]}>
        {initial}
      </Text>
    </View>
  );
}

const avStyles = StyleSheet.create({
  wrap: { justifyContent: 'center', alignItems: 'center' },
  text: { fontWeight: '700' },
});

// ─── Pill Selector ─────────────────────────────────────
export function PillSelector({
  items,
  selected,
  onSelect,
}: {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
}) {
  return (
    <View style={pillStyles.row}>
      {items.map((item) => {
        const active = item === selected;
        return (
          <TouchableOpacity
            key={item}
            style={[pillStyles.pill, active && pillStyles.pillActive]}
            activeOpacity={0.7}
            onPress={() => onSelect(item)}
          >
            <Text style={[pillStyles.text, active && pillStyles.textActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  pillActive: {
    backgroundColor: COLORS.cover,
    borderColor: COLORS.cover,
  },
  text: { fontSize: 13, fontWeight: '600', color: COLORS.graphite },
  textActive: { color: COLORS.paper },
});

// ─── Info Row ──────────────────────────────────────────
export function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) {
  return (
    <View style={infoStyles.row}>
      {icon ? <Text style={infoStyles.icon}>{icon}</Text> : null}
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  icon: { fontSize: 14, marginRight: 8 },
  label: { flex: 1, fontSize: 13, color: COLORS.graphite },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.text },
});

// ─── Primary Button ────────────────────────────────────
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  variant?: 'primary' | 'danger' | 'outline';
}) {
  const bg =
    variant === 'danger'
      ? COLORS.danger
      : variant === 'outline'
      ? 'transparent'
      : COLORS.cover;
  const borderColor =
    variant === 'outline' ? COLORS.line : variant === 'danger' ? COLORS.danger : 'transparent';

  return (
    <TouchableOpacity
      style={[
        btnStyles.btn,
        { backgroundColor: bg, borderColor },
        (disabled || loading) && btnStyles.disabled,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.paper} />
      ) : (
        <Text
          style={[
            btnStyles.text,
            variant === 'outline' && { color: COLORS.cover },
          ]}
        >
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  disabled: { opacity: 0.5 },
  text: { color: COLORS.paper, fontSize: 15, fontWeight: '700' },
});

// ─── Divider ───────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[
        { height: 1, backgroundColor: COLORS.line, marginVertical: 12 },
        style,
      ]}
    />
  );
}

// ─── PageHeader (simple, for non-cover screens) ────────
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={pageStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={pageStyles.title}>{title}</Text>
        {subtitle ? <Text style={pageStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const pageStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.graphite,
    marginTop: 2,
  },
});

// ─── Quick Access Card ─────────────────────────────────
export function QuickCard({
  icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[quickStyles.card, { backgroundColor: bg }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={quickStyles.icon}>{icon}</Text>
      <Text style={[quickStyles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const quickStyles = StyleSheet.create({
  card: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  icon: { fontSize: 24, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '700' },
});
