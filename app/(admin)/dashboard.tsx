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
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  PaperCard,
  StatCard,
  Badge,
  EmptyState,
  LoadingScreen,
  Avatar,
  QuickCard,
  SectionHeader,
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
  { icon: '\u{1F465}', label: 'Users', route: '/(admin)/users' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
  { icon: '\u{1F4DA}', label: 'Classes', route: '/(admin)/classes' as const, color: COLORS.tape, bg: COLORS.dangerBg },
  { icon: '\u{1F4D6}', label: 'Subjects', route: '/(admin)/subjects' as const, color: COLORS.blue, bg: COLORS.blueBg },
  { icon: '\u{1F4C5}', label: 'Timetable', route: '/(admin)/timetable' as const, color: COLORS.pencil, bg: COLORS.warningBg },
  { icon: '\u{1F4DD}', label: 'Exams', route: '/(admin)/exams' as const, color: COLORS.tape, bg: COLORS.dangerBg },
  { icon: '\u{1F4B0}', label: 'Fees', route: '/(admin)/fees' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
  { icon: '\u{1F4C6}', label: 'Events', route: '/(admin)/events' as const, color: COLORS.blue, bg: COLORS.blueBg },
  { icon: '\u{1F4E2}', label: 'Announcements', route: '/(admin)/announcements' as const, color: COLORS.pencil, bg: COLORS.warningBg },
  { icon: '\u{2699}\uFE0F', label: 'Settings', route: '/(admin)/settings' as const, color: COLORS.graphite, bg: COLORS.surfaceAlt },
  { icon: '\u{1F464}', label: 'Profile', route: '/(admin)/profile' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
];

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
    case 'teacher': return COLORS.chalk;
    case 'student': return COLORS.blue;
    case 'admin': return COLORS.tape;
    default: return COLORS.graphite;
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
      supabase.from('schools').select('name').eq('id', profile.school_id).single(),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'teacher'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'student'),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      supabase.from('fee_payments').select('amount_paid').eq('school_id', profile.school_id),
      supabase.from('school_events').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).gte('event_date', monthStart).lte('event_date', monthEnd),
      supabase.from('profiles').select('id, full_name, role, created_at').eq('school_id', profile.school_id).order('created_at', { ascending: false }).limit(5),
      supabase.from('school_events').select('id, title, event_date, event_type').eq('school_id', profile.school_id).gte('event_date', now.toISOString()).order('event_date', { ascending: true }).limit(3),
    ]);

    if (schoolRes.data) setSchoolName(schoolRes.data.name);
    setTeacherCount(teachersRes.count ?? 0);
    setStudentCount(studentsRes.count ?? 0);
    setClassCount(classesRes.count ?? 0);
    setSubjectCount(subjectsRes.count ?? 0);
    setEventsCount(monthEventsRes.count ?? 0);

    if (feesRes.data) {
      const total = feesRes.data.reduce((sum: number, p: any) => sum + (p.amount_paid ?? 0), 0);
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

  if (loading) return <LoadingScreen text="Loading dashboard..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Admin Dashboard" subtitle={schoolName} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />
        }
      >
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Welcome, {profile?.full_name?.split(' ')[0] || 'Admin'}
            </Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(admin)/profile' as any)} activeOpacity={0.7}>
            <Avatar name={profile?.full_name || 'A'} size={48} />
          </TouchableOpacity>
        </View>

        <SectionHeader title="Overview" />
        <View style={styles.statsGrid}>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F468}\u200D\u{1F3EB}'} label="Teachers" value={teacherCount} color={COLORS.chalk} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F468}\u200D\u{1F393}'} label="Students" value={studentCount} color={COLORS.blue} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F4DA}'} label="Classes" value={classCount} color={COLORS.pencil} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F4D6}'} label="Subjects" value={subjectCount} color={COLORS.tape} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F4B0}'} label="Fee Collection" value={formatCurrency(totalFees)} color={COLORS.chalk} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon={'\u{1F4C6}'} label="Events" value={eventsCount} color={COLORS.blue} />
          </View>
        </View>

        <SectionHeader title="Quick Access" />
        <View style={styles.quickGrid}>
          {QUICK_ACCESS.map((item) => (
            <QuickCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              color={item.color}
              bg={item.bg}
              onPress={() => router.push(item.route as any)}
            />
          ))}
        </View>

        <SectionHeader title="Recent Registrations" />
        <NotebookCard>
          {recentUsers.length === 0 ? (
            <EmptyState icon={'\u{1F464}'} title="No registrations yet" subtitle="New users will appear here" />
          ) : (
            recentUsers.map((user, idx) => (
              <View key={user.id} style={[styles.userRow, idx < recentUsers.length - 1 && styles.divider]}>
                <Avatar name={user.full_name} size={36} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.full_name}</Text>
                  <Badge text={user.role} color={getRoleColor(user.role)} />
                </View>
                <Text style={styles.userDate}>{formatShortDate(user.created_at)}</Text>
              </View>
            ))
          )}
        </NotebookCard>

        <SectionHeader title="Upcoming Events" />
        <NotebookCard>
          {upcomingEvents.length === 0 ? (
            <EmptyState icon={'\u{1F4C6}'} title="No upcoming events" subtitle="Events will show up here" />
          ) : (
            upcomingEvents.map((evt, idx) => (
              <View key={evt.id} style={[styles.eventRow, idx < upcomingEvents.length - 1 && styles.divider]}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateMonth}>
                    {new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                  <Text style={styles.dateDay}>{new Date(evt.event_date).getDate()}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{evt.title}</Text>
                  <Badge text={evt.event_type || 'Event'} color={COLORS.blue} />
                </View>
              </View>
            ))
          )}
        </NotebookCard>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.graphite,
    marginTop: 2,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statHalf: { width: '48%', marginBottom: 8 },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  userInfo: { flex: 1, marginLeft: 10, gap: 3 },
  userName: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  userDate: { fontSize: 11, color: COLORS.graphiteLight },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.chalkSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dateMonth: { fontSize: 9, fontWeight: '700', color: COLORS.chalk, textTransform: 'uppercase' },
  dateDay: { fontSize: 16, fontWeight: '800', color: COLORS.chalk, lineHeight: 20 },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
});
