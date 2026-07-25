import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { COLORS, SHADOWS } from '../lib/theme';

// ─── Page Header ─────────────────────────────────────
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
    <View style={hdrStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={hdrStyles.title}>{title}</Text>
        {subtitle ? <Text style={hdrStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

// ─── Stat Card ───────────────────────────────────────
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
  const c = color || COLORS.primary;
  const content = (
    <View style={[statStyles.card, { borderLeftColor: c }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: c + '15' }]}>
        <Text style={statStyles.icon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={statStyles.value}>{value}</Text>
        <Text style={statStyles.label}>{label}</Text>
      </View>
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
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20 },
  value: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});

// ─── Card ─────────────────────────────────────────────
export function Card({
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
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[cardStyles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
});

// ─── Badge ────────────────────────────────────────────
export function Badge({
  text,
  color,
  size = 'sm',
}: {
  text: string;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const c = color || COLORS.primary;
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

// ─── Empty State ──────────────────────────────────────
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
  btn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: COLORS.textInverse, fontWeight: '700', fontSize: 15 },
});

// ─── Loading Screen ───────────────────────────────────
export function LoadingScreen({ text }: { text?: string }) {
  return (
    <View style={loadStyles.wrap}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {text ? <Text style={loadStyles.text}>{text}</Text> : null}
    </View>
  );
}

const loadStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  text: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },
});

// ─── Section Header ───────────────────────────────────
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
    marginTop: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  action: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});

// ─── Avatar ───────────────────────────────────────────
export function Avatar({
  name,
  size = 40,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const c = color || COLORS.primary;
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        avStyles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c + '20',
        },
      ]}
    >
      <Text style={[avStyles.text, { fontSize: size * 0.38, color: c }]}>
        {initials}
      </Text>
    </View>
  );
}

const avStyles = StyleSheet.create({
  wrap: { justifyContent: 'center', alignItems: 'center' },
  text: { fontWeight: '700' },
});

// ─── Pill Selector ────────────────────────────────────
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
  },
  pillActive: { backgroundColor: COLORS.primary },
  text: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  textActive: { color: COLORS.textInverse },
});

// ─── Info Row ─────────────────────────────────────────
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
    borderBottomColor: COLORS.borderLight,
  },
  icon: { fontSize: 16, marginRight: 8 },
  label: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.text },
});

// ─── Primary Button ───────────────────────────────────
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
      : COLORS.primary;
  const borderColor =
    variant === 'outline' ? COLORS.border : 'transparent';

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
        <ActivityIndicator size="small" color={COLORS.textInverse} />
      ) : (
        <Text style={[btnStyles.text, variant === 'outline' && { color: COLORS.primary }]}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  disabled: { opacity: 0.5 },
  text: { color: COLORS.textInverse, fontSize: 16, fontWeight: '700' },
});

// ─── Divider ──────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 12 }, style]} />;
}
