import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  EmptyState,
  LoadingScreen,
  Avatar,
} from '../../lib/components';

interface RecentUser {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
}

const QUICK_ACCESS = [
  { emoji: '👥', label: 'Users', route: '/(admin)/users' as const },
  { emoji: '📚', label: 'Classes', route: '/(admin)/classes' as const },
  { emoji: '📖', label: 'Subjects', route: '/(admin)/subjects' as const },
  { emoji: '🗓️', label: 'Timetable', route: '/(admin)/timetable' as const },
  { emoji: '📝', label: 'Exams', route: '/(admin)/exams' as const },
  { emoji: '💰', label: 'Fees', route: '/(admin)/fees' as const },
  { emoji: '📅', label: 'Events', route: '/(admin)/events' as const },
  { emoji: '📢', label: 'Announcements', route: '/(admin)/announcements' as const },
  { emoji: '⚙️', label: 'Settings', route: '/(admin)/settings' as const },
  { emoji: '👤', label: 'Profile', route: '/(admin)/profile' as const },
];

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'teacher': return COLORS.primary;
    case 'student': return COLORS.success;
    case 'admin': return COLORS.warning;
    default: return COLORS.textSecondary;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [schoolName, setSchoolName] = useState('');
  const [teacherCount, setTeacherCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const [
      schoolRes,
      teachersRes,
      studentsRes,
      classesRes,
      subjectsRes,
      feesRes,
      monthEventsRes,
      usersRes,
      upcomingRes,
    ] = await Promise.all([
      supabase
        .from('schools')
        .select('name')
        .eq('id', profile.school_id)
        .single(),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', profile.school_id)
        .eq('role', 'teacher'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', profile.school_id)
        .eq('role', 'student'),
      supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', profile.school_id),
      supabase
        .from('subjects')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', profile.school_id),
      supabase
        .from('fee_payments')
        .select('amount')
        .eq('school_id', profile.school_id),
      supabase
        .from('school_events')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', profile.school_id)
        .gte('event_date', monthStart)
        .lte('event_date', monthEnd),
      supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('school_id', profile.school_id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('school_events')
        .select('id, title, event_date, event_type')
        .eq('school_id', profile.school_id)
        .gte('event_date', now.toISOString())
        .order('event_date', { ascending: true })
        .limit(3),
    ]);

    if (schoolRes.data) setSchoolName(schoolRes.data.name);
    setTeacherCount(teachersRes.count ?? 0);
    setStudentCount(studentsRes.count ?? 0);
    setClassCount(classesRes.count ?? 0);
    setSubjectCount(subjectsRes.count ?? 0);
    setEventsCount(monthEventsRes.count ?? 0);

    if (feesRes.data) {
      const total = feesRes.data.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
      setTotalFees(total);
    }

    if (usersRes.data) setRecentUsers(usersRes.data);
    if (upcomingRes.data) setUpcomingEvents(upcomingRes.data);
  }, [profile?.school_id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await fetchData();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return <LoadingScreen text="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* ── Greeting ──────────────────────────── */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            Welcome, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋
          </Text>
          {schoolName ? (
            <Text style={styles.schoolName}>{schoolName}</Text>
          ) : null}
          <Text style={styles.dateText}>{formatToday()}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(admin)/profile' as any)}
          activeOpacity={0.7}
        >
          <Avatar name={profile?.full_name || 'A'} size={52} />
        </TouchableOpacity>
      </View>

      {/* ── Stats Grid (2×3) ────────────────── */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statHalf}>
          <StatCard icon="👨‍🏫" label="Teachers" value={teacherCount} color={COLORS.primary} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="👨‍🎓" label="Students" value={studentCount} color={COLORS.success} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="📚" label="Classes" value={classCount} color={COLORS.warning} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="📖" label="Subjects" value={subjectCount} color={COLORS.danger} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="💰" label="Fee Collection" value={formatCurrency(totalFees)} color="#8B5CF6" />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="📅" label="Events This Month" value={eventsCount} color="#EC4899" />
        </View>
      </View>

      {/* ── Quick Access ─────────────────────── */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACCESS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickCard}
            activeOpacity={0.7}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.quickEmoji}>{item.emoji}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Recent Registrations ─────────────── */}
      <Text style={styles.sectionTitle}>Recent Registrations</Text>
      <Card>
        {recentUsers.length === 0 ? (
          <EmptyState icon="👤" title="No registrations yet" subtitle="New users will appear here" />
        ) : (
          recentUsers.map((user, idx) => (
            <View
              key={user.id}
              style={[styles.userRow, idx < recentUsers.length - 1 && styles.userRowBorder]}
            >
              <Avatar name={user.full_name} size={38} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Badge text={user.role} color={getRoleColor(user.role)} />
              </View>
              <Text style={styles.userDate}>{formatShortDate(user.created_at)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* ── Upcoming Events ──────────────────── */}
      <Text style={styles.sectionTitle}>Upcoming Events</Text>
      <Card>
        {upcomingEvents.length === 0 ? (
          <EmptyState icon="📅" title="No upcoming events" subtitle="Events will show up here" />
        ) : (
          upcomingEvents.map((evt, idx) => (
            <View
              key={evt.id}
              style={[styles.eventRow, idx < upcomingEvents.length - 1 && styles.userRowBorder]}
            >
              <View style={styles.eventDateBox}>
                <Text style={styles.eventMonth}>
                  {new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short' })}
                </Text>
                <Text style={styles.eventDay}>
                  {new Date(evt.event_date).getDate()}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>{evt.title}</Text>
                <Badge text={evt.event_type || 'Event'} color={COLORS.primary} />
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={{ height: 24 }} />
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

  /* Greeting */
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  /* Section */
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 4,
  },

  /* Stats 2×3 */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statHalf: {
    width: '48%',
    marginBottom: 10,
  },

  /* Quick Access */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  quickEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },

  /* User rows */
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  userRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  userDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },

  /* Event rows */
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  eventDateBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  eventDay: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 22,
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});
