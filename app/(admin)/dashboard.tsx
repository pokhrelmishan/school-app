import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface StatCard {
  label: string;
  count: number;
  accent: string;
}

interface RecentUser {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [schoolName, setSchoolName] = useState('School');
  const [stats, setStats] = useState<StatCard[]>([
    { label: 'Teachers', count: 0, accent: COLORS.primary },
    { label: 'Students', count: 0, accent: COLORS.success },
    { label: 'Classes', count: 0, accent: COLORS.warning },
    { label: 'Subjects', count: 0, accent: COLORS.danger },
  ]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.school_id) return;

      const [schoolRes, teachersRes, studentsRes, classesRes, subjectsRes, usersRes] =
        await Promise.all([
          supabase.from('schools').select('name').eq('id', profile.school_id).single(),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'teacher'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'student'),
          supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
          supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
          supabase.from('profiles').select('id, full_name, role, created_at').eq('school_id', profile.school_id).order('created_at', { ascending: false }).limit(5),
        ]);

      if (schoolRes.data) setSchoolName(schoolRes.data.name);

      setStats([
        { label: 'Teachers', count: teachersRes.count ?? 0, accent: COLORS.primary },
        { label: 'Students', count: studentsRes.count ?? 0, accent: COLORS.success },
        { label: 'Classes', count: classesRes.count ?? 0, accent: COLORS.warning },
        { label: 'Subjects', count: subjectsRes.count ?? 0, accent: COLORS.danger },
      ]);

      if (usersRes.data) setRecentUsers(usersRes.data);
      setLoading(false);
    };

    fetchData();
  }, [profile?.school_id]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'teacher': return COLORS.primaryBg;
      case 'student': return COLORS.successBg;
      case 'admin': return COLORS.warningBg;
      default: return COLORS.surfaceAlt;
    }
  };

  const getRoleBadgeText = (role: string) => {
    switch (role) {
      case 'teacher': return COLORS.primary;
      case 'student': return COLORS.success;
      case 'admin': return COLORS.warning;
      default: return COLORS.textSecondary;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(admin)/profile' as any)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, SHADOWS.sm]}>
            <View style={[styles.statAccent, { backgroundColor: stat.accent }]} />
            <Text style={styles.statCount}>{stat.count}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityCard}>
        {recentUsers.length === 0 ? (
          <Text style={styles.emptyText}>No recent activity</Text>
        ) : (
          recentUsers.map((user) => (
            <View key={user.id} style={styles.activityRow}>
              <View style={styles.activityInfo}>
                <Text style={styles.activityName}>{user.full_name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) }]}>
                  <Text style={[styles.roleBadgeText, { color: getRoleBadgeText(user.role) }]}>
                    {user.role}
                  </Text>
                </View>
              </View>
              <Text style={styles.activityDate}>{formatDate(user.created_at)}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionCard, SHADOWS.sm]}
          onPress={() => router.push('/(admin)/users' as any)}
        >
          <Text style={styles.actionEmoji}>👤</Text>
          <Text style={styles.actionLabel}>Add User</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, SHADOWS.sm]}
          onPress={() => router.push('/(admin)/classes' as any)}
        >
          <Text style={styles.actionEmoji}>📚</Text>
          <Text style={styles.actionLabel}>Manage Classes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, SHADOWS.sm]}
          onPress={() => router.push('/(admin)/subjects' as any)}
        >
          <Text style={styles.actionEmoji}>📖</Text>
          <Text style={styles.actionLabel}>Subjects</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
  },
  schoolName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  statCount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.sm,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  activityDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: 26,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
});
