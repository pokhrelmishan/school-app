import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  EmptyState,
  LoadingScreen,
  Avatar,
} from '../../lib/components';

const QUICK_ACCESS = [
  { emoji: '🗓️', label: 'Timetable', route: '/(student)/timetable' as const },
  { emoji: '📊', label: 'Grades', route: '/(student)/grades' as const },
  { emoji: '📝', label: 'Exams', route: '/(student)/exams' as const },
  { emoji: '💰', label: 'Fees', route: '/(student)/fees' as const },
  { emoji: '📅', label: 'Events', route: '/(student)/events' as const },
  { emoji: '📋', label: 'Attendance', route: '/(student)/attendance' as const },
  { emoji: '📄', label: 'Assignments', route: '/(student)/assignments' as const },
  { emoji: '📢', label: 'Notices', route: '/(student)/notices' as const },
  { emoji: '✉️', label: 'Messages', route: '/(student)/messages' as const },
  { emoji: '👤', label: 'Profile', route: '/(student)/profile' as const },
];

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface TodayClass {
  id: string;
  start_time: string;
  end_time: string;
  room: string;
  subject: string;
  teacher: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  description?: string;
}

export default function StudentDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [attendanceRate, setAttendanceRate] = useState(0);
  const [avgGrade, setAvgGrade] = useState('—');
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [upcomingExams, setUpcomingExams] = useState(0);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  const firstName = (profile?.full_name || 'Student').split(' ')[0];

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    try {
      const now = new Date();
      const currentDay = now.getDay();
      const todayStr = now.toISOString().split('T')[0];

      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id);

      const classIds = enrollments?.map((e) => e.class_id) || [];

      const [attRes, gradeRes, assignRes, examRes, timetableRes, eventsRes] =
        await Promise.all([
          supabase
            .from('attendance_records')
            .select('status')
            .eq('student_id', user.id),
          supabase
            .from('grade_entries')
            .select('score, max_score')
            .eq('student_id', user.id),
          classIds.length > 0
            ? supabase
                .from('assignments')
                .select('id, due_date')
                .in('class_id', classIds)
                .gte('due_date', todayStr)
            : { data: [] },
          classIds.length > 0
            ? supabase
                .from('exams')
                .select('id, exam_date')
                .in('class_id', classIds)
                .gte('exam_date', todayStr)
            : { data: [] },
          classIds.length > 0
            ? supabase
                .from('timetable')
                .select(
                  'id, start_time, end_time, room, subject:subjects(name), teacher:profiles(full_name), class:classes(name)'
                )
                .in('class_id', classIds)
                .eq('day_of_week', currentDay)
                .order('start_time')
            : { data: [] },
          supabase
            .from('school_events')
            .select('id, title, event_date, description')
            .gte('event_date', todayStr)
            .order('event_date')
            .limit(3),
        ]);

      // Attendance percentage
      if (attRes.data && attRes.data.length > 0) {
        const present = attRes.data.filter(
          (r) => r.status === 'present'
        ).length;
        setAttendanceRate(
          Math.round((present / attRes.data.length) * 100)
        );
      }

      // Average grade
      if (gradeRes.data && gradeRes.data.length > 0) {
        const totalScore = gradeRes.data.reduce(
          (sum, g) => sum + (g.score || 0),
          0
        );
        const totalMax = gradeRes.data.reduce(
          (sum, g) => sum + (g.max_score || 1),
          0
        );
        setAvgGrade(
          totalMax > 0
            ? `${Math.round((totalScore / totalMax) * 100)}%`
            : '—'
        );
      }

      // Pending assignments
      if (assignRes.data) {
        setPendingAssignments(assignRes.data.length);
      }

      // Upcoming exams
      if (examRes.data) {
        setUpcomingExams(examRes.data.length);
      }

      // Today's classes
      if (timetableRes.data) {
        setTodayClasses(
          timetableRes.data.map((e: any) => ({
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            room: e.room,
            subject:
              Array.isArray(e.subject) ? e.subject[0]?.name : e.subject?.name,
            teacher:
              Array.isArray(e.teacher)
                ? e.teacher[0]?.full_name
                : e.teacher?.full_name,
          }))
        );
      }

      // Upcoming events
      if (eventsRes.data) {
        setUpcomingEvents(eventsRes.data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  if (loading) {
    return <LoadingScreen text="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* ── Greeting ────────────────────────────────── */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingText}>{getGreeting()},</Text>
          <Text style={styles.nameText}>{firstName}</Text>
          <Text style={styles.dateText}>{getTodayDate()}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(student)/profile')}
          activeOpacity={0.7}
        >
          <Avatar
            name={profile?.full_name || 'Student'}
            size={52}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Quick Stats (2×2) ──────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statsHalf}>
          <StatCard
            icon="📋"
            label="Attendance"
            value={`${attendanceRate}%`}
            color={COLORS.success}
            onPress={() => router.push('/(student)/attendance')}
          />
        </View>
        <View style={styles.statsHalf}>
          <StatCard
            icon="📊"
            label="Avg. Grade"
            value={avgGrade}
            color={COLORS.primary}
            onPress={() => router.push('/(student)/grades')}
          />
        </View>
      </View>
      <View style={[styles.statsGrid, { marginTop: 8 }]}>
        <View style={styles.statsHalf}>
          <StatCard
            icon="📄"
            label="Assignments Due"
            value={pendingAssignments}
            color={COLORS.warning}
            onPress={() => router.push('/(student)/assignments')}
          />
        </View>
        <View style={styles.statsHalf}>
          <StatCard
            icon="📝"
            label="Upcoming Exams"
            value={upcomingExams}
            color={COLORS.danger}
            onPress={() => router.push('/(student)/exams')}
          />
        </View>
      </View>

      {/* ── Today's Classes ────────────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Classes</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(student)/timetable')}
          >
            <Text style={styles.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>
        {todayClasses.length === 0 ? (
          <Text style={styles.emptyInline}>No classes scheduled today</Text>
        ) : (
          todayClasses.slice(0, 3).map((cls, i) => (
            <View
              key={cls.id}
              style={[styles.classRow, i < todayClasses.length - 1 && styles.classRowBorder]}
            >
              <View style={styles.classTimeBlock}>
                <Text style={styles.classTime}>{formatTime(cls.start_time)}</Text>
                <Text style={styles.classTimeSep}>–</Text>
                <Text style={styles.classTime}>{formatTime(cls.end_time)}</Text>
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.classSubject}>{cls.subject}</Text>
                <View style={styles.classMeta}>
                  {cls.teacher ? (
                    <Text style={styles.classMetaText}>👤 {cls.teacher}</Text>
                  ) : null}
                  {cls.room ? (
                    <Text style={styles.classMetaText}>📍 {cls.room}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* ── Quick Access Grid ──────────────────────── */}
      <Text style={styles.quickAccessTitle}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACCESS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickCard}
            activeOpacity={0.7}
            onPress={() => router.push(item.route)}
          >
            <Text style={styles.quickEmoji}>{item.emoji}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Upcoming Events ────────────────────────── */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(student)/events')}
          >
            <Text style={styles.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>
        {upcomingEvents.length === 0 ? (
          <Text style={styles.emptyInline}>No upcoming events</Text>
        ) : (
          upcomingEvents.map((event, i) => (
            <View
              key={event.id}
              style={[styles.eventRow, i < upcomingEvents.length - 1 && styles.eventRowBorder]}
            >
              <View style={styles.eventDateBlock}>
                <Text style={styles.eventDay}>
                  {new Date(event.event_date).getDate()}
                </Text>
                <Text style={styles.eventMonth}>
                  {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' })}
                </Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.description ? (
                  <Text style={styles.eventDesc} numberOfLines={1}>
                    {event.description}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 2,
  },

  // Stats 2×2 grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statsHalf: {
    flex: 1,
  },

  // Section card
  sectionCard: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyInline: {
    fontSize: 14,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Today's classes
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  classRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  classTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 12,
  },
  classTime: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  classTimeSep: {
    fontSize: 11,
    color: COLORS.primary,
    marginHorizontal: 3,
  },
  classInfo: {
    flex: 1,
  },
  classSubject: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  classMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  classMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Quick access
  quickAccessTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  quickEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },

  // Events
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  eventRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  eventDateBlock: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDay: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  eventMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
