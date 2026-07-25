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
  Avatar,
  LoadingScreen,
} from '../../lib/components';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleEntry {
  time: string;
  subject: string;
  className: string;
  room: string;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_name: string;
}

interface QuickLink {
  icon: string;
  label: string;
  route: string;
  color: string;
  bg: string;
}

const QUICK_LINKS: QuickLink[] = [
  { icon: '📚', label: 'Classes', route: '/(teacher)/classes', color: COLORS.primary, bg: COLORS.primaryBg },
  { icon: '🗓️', label: 'Schedule', route: '/(teacher)/timetable', color: '#7C3AED', bg: '#F3E8FF' },
  { icon: '✓', label: 'Attendance', route: '/(teacher)/attendance', color: COLORS.success, bg: COLORS.successBg },
  { icon: '📝', label: 'Exams', route: '/(teacher)/exams', color: COLORS.warning, bg: COLORS.warningBg },
  { icon: '💬', label: 'Messages', route: '/(teacher)/messages', color: '#0EA5E9', bg: '#E0F2FE' },
  { icon: '📅', label: 'Calendar', route: '/(teacher)/calendar', color: '#F43F5E', bg: '#FFE4E6' },
  { icon: '👤', label: 'Profile', route: '/(teacher)/profile', color: '#6366F1', bg: '#EEF2FF' },
];

export default function TeacherDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const [todaySchedule, setTodaySchedule] = useState<ScheduleEntry[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);

  const firstName = (profile?.full_name || 'Teacher').split(' ')[0];
  const lastName = (profile?.full_name || '').split(' ').slice(1).join(' ');

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date();
  const todayDayOfWeek = today.getDay();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [classTeacherRes, subjectRes, todayRes, msgRes, msgNamesRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('teacher_id', user.id),
        supabase.from('teacher_subjects').select('class_id, classes(name)').eq('teacher_id', user.id),
        supabase.from('timetable').select('start_time, end_time, room, subject_id(subjects(name)), class_id(classes(name))').eq('teacher_id', user.id).eq('day_of_week', todayDayOfWeek).order('start_time'),
        supabase.from('messages').select('id, body, created_at, sender_id').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('messages').select('id').eq('recipient_id', user.id),
      ]);

      const classIds = new Set<string>();
      if (classTeacherRes.data) {
        classTeacherRes.data.forEach((c: any) => classIds.add(c.id));
      }
      if (subjectRes.data) {
        subjectRes.data.forEach((ts: any) => classIds.add(ts.class_id));
      }
      setTotalClasses(classIds.size);

      if (classIds.size > 0) {
        const enrollRes = await supabase
          .from('class_enrollments')
          .select('student_id')
          .in('class_id', Array.from(classIds));
        setTotalStudents(enrollRes.data?.length || 0);
      }

      if (todayRes.data) {
        const entries: ScheduleEntry[] = todayRes.data.map((e: any) => ({
          time: `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`,
          subject: e.subject_id?.subjects?.name || '—',
          className: e.class_id?.classes?.name || '—',
          room: e.room || '—',
        }));
        setTodaySchedule(entries);
        setTodayCount(entries.length);
      }

      setMessageCount(msgNamesRes.data?.length || 0);

      if (msgRes.data && msgRes.data.length > 0) {
        const senderIds = [...new Set(msgRes.data.map((m: any) => m.sender_id))];
        const namesRes = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
        const nameMap: Record<string, string> = {};
        if (namesRes.data) namesRes.data.forEach((p: any) => { nameMap[p.id] = p.full_name || 'Unknown'; });

        setRecentMessages(msgRes.data.map((m: any) => ({
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          sender_name: nameMap[m.sender_id] || 'Unknown',
        })));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, todayDayOfWeek]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) return <LoadingScreen text="Loading dashboard..." />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>
            {lastName ? `Mr./Ms. ${lastName}` : firstName}
          </Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(teacher)/profile')}>
          <Avatar name={profile?.full_name || 'T'} size={48} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statHalf}>
          <StatCard icon="👨‍🎓" label="Students" value={totalStudents} color={COLORS.primary} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="📚" label="Classes" value={totalClasses} color={COLORS.success} />
        </View>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statHalf}>
          <StatCard icon="🗓️" label="Today's Classes" value={todayCount} color="#7C3AED" onPress={() => router.push('/(teacher)/timetable')} />
        </View>
        <View style={styles.statHalf}>
          <StatCard icon="✉️" label="Messages" value={messageCount} color="#0EA5E9" onPress={() => router.push('/(teacher)/messages')} />
        </View>
      </View>

      {/* Today's Schedule */}
      <Text style={styles.sectionTitle}>Today's Schedule</Text>
      {todaySchedule.length > 0 ? (
        todaySchedule.map((entry, i) => (
          <Card key={i} style={{ marginBottom: 8 }}>
            <View style={styles.scheduleRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeText}>{entry.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectText}>{entry.subject}</Text>
                <Text style={styles.classText}>{entry.className}</Text>
              </View>
              <Badge text={entry.room} color="#6366F1" />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.emptyText}>No classes scheduled for today</Text>
        </Card>
      )}

      {/* Quick Access */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {QUICK_LINKS.map((link) => (
          <TouchableOpacity
            key={link.label}
            style={[styles.quickCard, { backgroundColor: link.bg }]}
            activeOpacity={0.7}
            onPress={() => router.push(link.route as any)}
          >
            <Text style={styles.quickIcon}>{link.icon}</Text>
            <Text style={[styles.quickLabel, { color: link.color }]}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Messages</Text>
          {recentMessages.map((msg) => (
            <TouchableOpacity
              key={msg.id}
              activeOpacity={0.7}
              onPress={() => router.push('/(teacher)/messages')}
            >
              <Card style={{ marginBottom: 8 }}>
                <View style={styles.msgRow}>
                  <Avatar name={msg.sender_name} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.msgName}>{msg.sender_name}</Text>
                    <Text style={styles.msgBody} numberOfLines={1}>{msg.body}</Text>
                  </View>
                  <Text style={styles.msgTime}>
                    {new Date(msg.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 24,
  },
  greeting: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  date: { fontSize: 13, color: COLORS.textTertiary, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statHalf: { flex: 1 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 10,
  },

  scheduleRow: { flexDirection: 'row', alignItems: 'center' },
  timeBox: { marginRight: 14 },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  subjectText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  classText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { fontSize: 14, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 8 },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  quickIcon: { fontSize: 28, marginBottom: 6 },
  quickLabel: { fontSize: 13, fontWeight: '700' },

  msgRow: { flexDirection: 'row', alignItems: 'center' },
  msgName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  msgBody: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  msgTime: { fontSize: 11, color: COLORS.textTertiary },
});
