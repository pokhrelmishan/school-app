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
  ScreenHeader,
  NotebookCard,
  StatCard,
  Badge,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  QuickCard,
  Avatar,
} from '../../lib/components';

const QUICK_ACCESS = [
  { icon: '🗓️', label: 'Timetable', route: '/(student)/timetable' as const, color: COLORS.tape, bg: COLORS.dangerBg },
  { icon: '📊', label: 'Grades', route: '/(student)/grades' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
  { icon: '📝', label: 'Exams', route: '/(student)/exams' as const, color: COLORS.blue, bg: COLORS.blueBg },
  { icon: '💰', label: 'Fees', route: '/(student)/fees' as const, color: COLORS.pencil, bg: COLORS.warningBg },
  { icon: '📅', label: 'Events', route: '/(student)/events' as const, color: COLORS.tape, bg: COLORS.dangerBg },
  { icon: '📋', label: 'Attendance', route: '/(student)/attendance' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
  { icon: '📄', label: 'Homework', route: '/(student)/assignments' as const, color: COLORS.blue, bg: COLORS.blueBg },
  { icon: '📢', label: 'News', route: '/(student)/notices' as const, color: COLORS.pencil, bg: COLORS.warningBg },
  { icon: '✉️', label: 'Messages', route: '/(student)/messages' as const, color: COLORS.tape, bg: COLORS.dangerBg },
  { icon: '👤', label: 'Profile', route: '/(student)/profile' as const, color: COLORS.chalk, bg: COLORS.chalkSoft },
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
  period: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  event_time: string;
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
  const schoolName = profile?.school_id ? 'School Portal' : '';

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
                  'id, day_of_week, start_time, end_time, room, subject:subjects(name), teacher:profiles(full_name)'
                )
                .in('class_id', classIds)
                .eq('day_of_week', currentDay)
                .order('start_time')
            : { data: [] },
          supabase
            .from('school_events')
            .select('id, title, event_date, event_type, event_time, description')
            .gte('event_date', todayStr)
            .order('event_date')
            .limit(3),
        ]);

      if (attRes.data && attRes.data.length > 0) {
        const present = attRes.data.filter((r) => r.status === 'present').length;
        setAttendanceRate(Math.round((present / attRes.data.length) * 100));
      }

      if (gradeRes.data && gradeRes.data.length > 0) {
        const totalScore = gradeRes.data.reduce((sum, g) => sum + (g.score || 0), 0);
        const totalMax = gradeRes.data.reduce((sum, g) => sum + (g.max_score || 1), 0);
        setAvgGrade(totalMax > 0 ? `${Math.round((totalScore / totalMax) * 100)}%` : '—');
      }

      if (assignRes.data) {
        setPendingAssignments(assignRes.data.length);
      }

      if (examRes.data) {
        setUpcomingExams(examRes.data.length);
      }

      if (timetableRes.data) {
        setTodayClasses(
          timetableRes.data.map((e: any, idx: number) => ({
            id: e.id,
            start_time: e.start_time,
            end_time: e.end_time,
            room: e.room,
            subject: Array.isArray(e.subject) ? e.subject[0]?.name : e.subject?.name,
            teacher: Array.isArray(e.teacher) ? e.teacher[0]?.full_name : e.teacher?.full_name,
            period: idx + 1,
          }))
        );
      }

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
          tintColor={COLORS.tape}
          colors={[COLORS.tape]}
        />
      }
    >
      <ScreenHeader title="Home" subtitle={schoolName || undefined} />

      <View style={styles.body}>
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
              color={COLORS.tape}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsHalf}>
            <StatCard
              icon="📋"
              label="Attendance"
              value={`${attendanceRate}%`}
              color={COLORS.chalk}
              onPress={() => router.push('/(student)/attendance')}
            />
          </View>
          <View style={styles.statsHalf}>
            <StatCard
              icon="📊"
              label="Avg. Grade"
              value={avgGrade}
              color={COLORS.tape}
              onPress={() => router.push('/(student)/grades')}
            />
          </View>
        </View>
        <View style={[styles.statsGrid, { marginTop: 8 }]}>
          <View style={styles.statsHalf}>
            <StatCard
              icon="📄"
              label="Pending Tasks"
              value={pendingAssignments}
              color={COLORS.pencil}
              onPress={() => router.push('/(student)/assignments')}
            />
          </View>
          <View style={styles.statsHalf}>
            <StatCard
              icon="📝"
              label="Upcoming Exams"
              value={upcomingExams}
              color={COLORS.blue}
              onPress={() => router.push('/(student)/exams')}
            />
          </View>
        </View>

        <SectionHeader
          title="Today's Classes"
          action={
            todayClasses.length > 0
              ? { label: 'View all →', onPress: () => router.push('/(student)/timetable') }
              : undefined
          }
        />
        <NotebookCard>
          {todayClasses.length === 0 ? (
            <EmptyState icon="📅" title="No classes today" subtitle="Enjoy your day off!" />
          ) : (
            todayClasses.slice(0, 3).map((cls, i) => (
              <View
                key={cls.id}
                style={[styles.classRow, i < Math.min(todayClasses.length, 3) - 1 && styles.classRowBorder]}
              >
                <View style={styles.periodBadge}>
                  <Text style={styles.periodText}>{cls.period}</Text>
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.classSubject}>{cls.subject}</Text>
                  <View style={styles.classMeta}>
                    {cls.teacher ? (
                      <Text style={styles.classMetaText}>{cls.teacher}</Text>
                    ) : null}
                    {cls.room ? (
                      <Text style={styles.classMetaText}>· {cls.room}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.classTime}>{formatTime(cls.start_time)}</Text>
                  <Text style={styles.classTimeSep}>–</Text>
                  <Text style={styles.classTime}>{formatTime(cls.end_time)}</Text>
                </View>
              </View>
            ))
          )}
        </NotebookCard>

        <SectionHeader title="Quick Access" />
        <View style={styles.quickGrid}>
          {QUICK_ACCESS.map((item) => (
            <QuickCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              color={item.color}
              bg={item.bg}
              onPress={() => router.push(item.route)}
            />
          ))}
        </View>

        <SectionHeader
          title="Upcoming Events"
          action={
            upcomingEvents.length > 0
              ? { label: 'View all →', onPress: () => router.push('/(student)/events') }
              : undefined
          }
        />
        {upcomingEvents.length === 0 ? (
          <NotebookCard>
            <EmptyState icon="📅" title="No upcoming events" />
          </NotebookCard>
        ) : (
          upcomingEvents.map((event, i) => (
            <NotebookCard key={event.id} accent={COLORS.tape}>
              <View style={styles.eventRow}>
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
                  {event.event_time ? (
                    <Text style={styles.eventTime}>{event.event_time}</Text>
                  ) : null}
                </View>
                {event.event_type ? (
                  <Badge text={event.event_type} color={COLORS.tape} size="sm" />
                ) : null}
              </View>
            </NotebookCard>
          ))
        )}

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    padding: 20,
  },

  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 15,
    color: COLORS.graphite,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.graphiteLight,
    marginTop: 2,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statsHalf: {
    flex: 1,
  },

  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  classRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  periodBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.chalkSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.chalk,
  },
  classInfo: {
    flex: 1,
  },
  classSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  classMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  classMetaText: {
    fontSize: 12,
    color: COLORS.graphite,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  classTime: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.graphite,
  },
  classTimeSep: {
    fontSize: 10,
    color: COLORS.graphiteLight,
    marginHorizontal: 2,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDateBlock: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.paperDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDay: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.tape,
  },
  eventMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.tape,
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 12,
    color: COLORS.graphite,
  },
});
