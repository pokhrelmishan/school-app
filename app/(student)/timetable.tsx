import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, EmptyState, LoadingScreen } from '../../lib/components';

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  subject?: { name: string };
  teacher?: { full_name: string };
  class?: { name: string };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default function StudentTimetableScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const currentDay = today.getDay();

  const fetchData = async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', user.id);

    if (!enrollments || enrollments.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const classIds = enrollments.map((e) => e.class_id);

    const { data } = await supabase
      .from('timetable')
      .select('id, day_of_week, start_time, end_time, room, subject:subjects(name), teacher:profiles(full_name), class:classes(name)')
      .in('class_id', classIds)
      .order('day_of_week')
      .order('start_time');

    if (data) {
      setEntries(
        data.map((e: any) => ({
          ...e,
          subject: Array.isArray(e.subject) ? e.subject[0] : e.subject,
          teacher: Array.isArray(e.teacher) ? e.teacher[0] : e.teacher,
          class: Array.isArray(e.class) ? e.class[0] : e.class,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const entriesByDay = DAY_NAMES.map((_, i) =>
    entries.filter((e) => e.day_of_week === i).sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time))
  );

  const timeSlots = Array.from(
    new Set(entries.map((e) => e.start_time))
  ).sort((a, b) => parseTime(a) - parseTime(b));

  if (loading) return <LoadingScreen text="Loading timetable..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
    >
      <PageHeader title="Timetable" subtitle={FULL_DAY_NAMES[currentDay]} />

      {entries.length === 0 ? (
        <EmptyState icon="📅" title="No timetable" subtitle="No classes scheduled yet" />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Today's Classes</Text>
          {entriesByDay[currentDay].length === 0 ? (
            <Card>
              <Text style={styles.noClasses}>No classes today</Text>
            </Card>
          ) : (
            entriesByDay[currentDay].map((entry) => (
              <Card key={entry.id} style={styles.todayCard}>
                <View style={styles.todayTop}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeText}>{formatTime(entry.start_time)}</Text>
                    <Text style={styles.timeSep}>–</Text>
                    <Text style={styles.timeText}>{formatTime(entry.end_time)}</Text>
                  </View>
                  <View style={[styles.liveDot, { backgroundColor: COLORS.success }]} />
                </View>
                <Text style={styles.subjectName}>{entry.subject?.name || 'Subject'}</Text>
                <View style={styles.metaRow}>
                  {entry.teacher && (
                    <Text style={styles.metaText}>👤 {entry.teacher.full_name}</Text>
                  )}
                  {entry.room && (
                    <Text style={styles.metaText}>📍 {entry.room}</Text>
                  )}
                </View>
                {entry.class && (
                  <Text style={styles.classLabel}>{entry.class.name}</Text>
                )}
              </Card>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Weekly Overview</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
            <View style={styles.weekContainer}>
              <View style={styles.weekHeader}>
                {DAY_NAMES.map((day, i) => (
                  <View
                    key={day}
                    style={[
                      styles.weekDayHeader,
                      i === currentDay && styles.weekDayHeaderActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekDayText,
                        i === currentDay && styles.weekDayTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                    <Text
                      style={[
                        styles.weekDateText,
                        i === currentDay && styles.weekDateTextActive,
                      ]}
                    >
                      {today.getDate() + (i - currentDay)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.weekBody}>
                {DAY_NAMES.map((_, dayIdx) => (
                  <View key={dayIdx} style={[styles.weekCol, dayIdx === currentDay && styles.weekColActive]}>
                    {entriesByDay[dayIdx].length === 0 ? (
                      <View style={styles.weekEmptySlot}>
                        <Text style={styles.weekEmptyText}>—</Text>
                      </View>
                    ) : (
                      entriesByDay[dayIdx].map((entry) => (
                        <View key={entry.id} style={[styles.weekSlot, { borderLeftColor: COLORS.primary }]}>
                          <Text style={styles.weekSlotSubject} numberOfLines={1}>{entry.subject?.name || '—'}</Text>
                          <Text style={styles.weekSlotTime} numberOfLines={1}>{formatTime(entry.start_time)}</Text>
                          {entry.room ? <Text style={styles.weekSlotRoom} numberOfLines={1}>{entry.room}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  todayCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  timeBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  timeSep: { fontSize: 12, color: COLORS.primary, marginHorizontal: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  subjectName: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  metaText: { fontSize: 13, color: COLORS.textSecondary },
  classLabel: { fontSize: 12, color: COLORS.textTertiary, marginTop: 4 },
  noClasses: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  weekScroll: { marginBottom: 8 },
  weekContainer: { minWidth: Dimensions.get('window').width - 40 },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    marginHorizontal: 2,
  },
  weekDayHeaderActive: { backgroundColor: COLORS.primary },
  weekDayText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  weekDayTextActive: { color: COLORS.textInverse },
  weekDateText: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  weekDateTextActive: { color: COLORS.textInverse },

  weekBody: { flexDirection: 'row' },
  weekCol: { flex: 1, marginHorizontal: 2, gap: 6, paddingBottom: 4 },
  weekColActive: { backgroundColor: COLORS.primaryBg, borderRadius: 10 },
  weekEmptySlot: { alignItems: 'center', paddingVertical: 16 },
  weekEmptyText: { fontSize: 14, color: COLORS.textTertiary },

  weekSlot: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    ...SHADOWS.sm,
  },
  weekSlotSubject: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  weekSlotTime: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  weekSlotRoom: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
});
