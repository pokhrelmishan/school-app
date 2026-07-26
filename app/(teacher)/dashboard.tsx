import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  StatCard,
  NotebookCard,
  Avatar,
  LoadingScreen,
  SectionHeader,
  QuickCard,
} from '../../lib/components';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    <View style={styles.root}>
      <ScreenHeader title="Teacher" subtitle="Edify International School" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>
              {lastName ? `Mr./Ms. ${lastName}` : firstName}
            </Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <Avatar name={profile?.full_name || 'T'} size={48} />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statHalf}>
            <StatCard icon="👨‍🎓" label="Students" value={totalStudents} color={COLORS.chalk} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon="📚" label="Classes" value={totalClasses} color={COLORS.tape} />
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statHalf}>
            <StatCard icon="🗓️" label="Today's Classes" value={todayCount} color={COLORS.pencil} onPress={() => router.push('/(teacher)/timetable')} />
          </View>
          <View style={styles.statHalf}>
            <StatCard icon="✉️" label="Messages" value={messageCount} color={COLORS.blue} onPress={() => router.push('/(teacher)/messages')} />
          </View>
        </View>

        <SectionHeader title="Today's Schedule" />
        {todaySchedule.length > 0 ? (
          todaySchedule.map((entry, i) => (
            <NotebookCard key={i} accent={COLORS.chalk}>
              <View style={styles.scheduleRow}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{entry.time}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectText}>{entry.subject}</Text>
                  <Text style={styles.classText}>{entry.className}</Text>
                </View>
                <Badge text={entry.room} color={COLORS.graphite} />
              </View>
            </NotebookCard>
          ))
        ) : (
          <NotebookCard>
            <View style={styles.emptyRow}>
              <Text style={styles.emptyIcon}>✏️</Text>
              <Text style={styles.emptyText}>No classes scheduled today</Text>
            </View>
          </NotebookCard>
        )}

        <SectionHeader title="Quick Access" />
        <View style={styles.quickGrid}>
          <QuickCard icon="📚" label="Classes" color={COLORS.chalk} bg={COLORS.chalkSoft} onPress={() => router.push('/(teacher)/classes')} />
          <QuickCard icon="🗓️" label="Schedule" color={COLORS.pencil} bg={COLORS.pencil + '20'} onPress={() => router.push('/(teacher)/timetable')} />
          <QuickCard icon="✓" label="Attendance" color={COLORS.chalk} bg={COLORS.chalkSoft} onPress={() => router.push('/(teacher)/attendance')} />
          <QuickCard icon="📝" label="Exams" color={COLORS.tape} bg={COLORS.tape + '18'} onPress={() => router.push('/(teacher)/exams')} />
          <QuickCard icon="💬" label="Messages" color={COLORS.blue} bg={COLORS.blueBg} onPress={() => router.push('/(teacher)/messages')} />
          <QuickCard icon="📅" label="Calendar" color={COLORS.pencil} bg={COLORS.pencil + '20'} onPress={() => router.push('/(teacher)/calendar')} />
          <QuickCard icon="👤" label="Profile" color={COLORS.graphite} bg={COLORS.paperDim} onPress={() => router.push('/(teacher)/profile')} />
        </View>

        {recentMessages.length > 0 && (
          <>
            <SectionHeader title="Recent Messages" />
            {recentMessages.map((msg) => (
              <NotebookCard key={msg.id} onPress={() => router.push('/(teacher)/messages')} accent={COLORS.tape}>
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
              </NotebookCard>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[badgeStyles.badge, { backgroundColor: color + '18' }]}>
      <Text style={[badgeStyles.text, { color }]}>{text}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  text: { fontSize: 11, fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  greeting: { fontSize: 15, color: COLORS.graphite, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.5 },
  date: { fontSize: 13, color: COLORS.graphiteLight, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statHalf: { flex: 1 },

  scheduleRow: { flexDirection: 'row', alignItems: 'center' },
  timeBox: { marginRight: 14 },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.graphite },
  subjectText: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  classText: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },

  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 8 },
  emptyIcon: { fontSize: 18 },
  emptyText: { fontSize: 14, color: COLORS.graphiteLight, fontStyle: 'italic' },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  msgRow: { flexDirection: 'row', alignItems: 'center' },
  msgName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  msgBody: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
  msgTime: { fontSize: 11, color: COLORS.graphiteLight },
});
