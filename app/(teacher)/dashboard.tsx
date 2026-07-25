import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';

export default function TeacherDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<any[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [classesRes, assignmentsRes, messagesRes] = await Promise.all([
        supabase.from('classes').select('id, name, subject').eq('teacher_id', user.id),
        supabase.from('assignments').select('id').eq('created_by', user.id),
        supabase.from('messages').select('id').eq('recipient_id', user.id),
      ]);

      if (classesRes.data) setClasses(classesRes.data);
      if (assignmentsRes.data) setPendingAssignments(assignmentsRes.data.length);
      if (messagesRes.data) setUnreadMessages(messagesRes.data.length);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{profile?.full_name || 'Teacher'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(teacher)/profile')} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || 'T')[0]}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewRow}>
        <TouchableOpacity style={styles.overviewCard} activeOpacity={0.7} onPress={() => router.push('/(teacher)/classes')}>
          <Text style={styles.overviewNumber}>{classes.length}</Text>
          <Text style={styles.overviewLabel}>Classes</Text>
          <Text style={styles.overviewDetail}>
            {classes.length > 0 ? classes.map(c => c.name).join(', ') : 'None assigned'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.overviewCard} activeOpacity={0.7} onPress={() => router.push('/(teacher)/assignments')}>
          <Text style={styles.overviewNumber}>{pendingAssignments}</Text>
          <Text style={styles.overviewLabel}>Assignments</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.messageCard} activeOpacity={0.7} onPress={() => router.push('/(teacher)/messages')}>
        <View style={styles.messageIcon}>
          <Text style={styles.messageIconText}>{unreadMessages}</Text>
        </View>
        <View style={styles.messageInfo}>
          <Text style={styles.messageTitle}>Unread Messages</Text>
          <Text style={styles.messageSub}>
            {unreadMessages > 0 ? `You have ${unreadMessages} unread message${unreadMessages > 1 ? 's' : ''}` : 'No new messages'}
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: COLORS.successBg }]} activeOpacity={0.7} onPress={() => router.push('/(teacher)/classes')}>
          <Text style={[styles.actionEmoji]}>✓</Text>
          <Text style={[styles.actionTitle, { color: COLORS.success }]}>Mark Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: COLORS.primaryBg }]} activeOpacity={0.7} onPress={() => router.push('/(teacher)/assignments')}>
          <Text style={styles.actionEmoji}>📝</Text>
          <Text style={[styles.actionTitle, { color: COLORS.primary }]}>Create Assignment</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 28,
  },
  greeting: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },

  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.sm,
  },
  overviewNumber: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  overviewLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  overviewDetail: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 16 },

  messageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  messageIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  messageIconText: { fontSize: 18, fontWeight: '800', color: COLORS.warning },
  messageInfo: { flex: 1 },
  messageTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  messageSub: { fontSize: 13, color: COLORS.textSecondary },
  arrow: { fontSize: 20, color: COLORS.textTertiary, fontWeight: '600' },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  actionEmoji: { fontSize: 24, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
