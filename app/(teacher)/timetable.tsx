import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  class_name?: string;
  subject_name?: string;
}

interface TeachClass {
  id: string;
  name: string;
  grade_level: string;
  subject_name?: string;
  role: 'class_teacher' | 'subject_teacher';
}

export default function TeacherTimetableScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [timetableRes, classTeacherRes, subjectRes] = await Promise.all([
        supabase.from('timetable').select('*, classes(name), subjects(name)').eq('teacher_id', user.id).order('start_time'),
        supabase.from('classes').select('id, name, grade_level').eq('teacher_id', user.id),
        supabase.from('teacher_subjects').select('class_id, classes(id, name, grade_level), subjects(name)').eq('teacher_id', user.id),
      ]);

      const timetable: TimetableEntry[] = (timetableRes.data || []).map((e: any) => ({
        id: e.id,
        class_id: e.class_id,
        subject_id: e.subject_id,
        day_of_week: e.day_of_week,
        start_time: e.start_time,
        end_time: e.end_time,
        room: e.room,
        class_name: e.classes?.name,
        subject_name: e.subjects?.name,
      }));

      setEntries(timetable);

      const classTeacherIds = new Set<string>();
      const merged: TeachClass[] = [];

      if (classTeacherRes.data) {
        for (const c of classTeacherRes.data) {
          classTeacherIds.add(c.id);
          merged.push({ id: c.id, name: c.name, grade_level: c.grade_level, role: 'class_teacher' });
        }
      }

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const ci = s.classes as any;
          const si = s.subjects as any;
          if (!ci) continue;
          if (!classTeacherIds.has(s.class_id)) {
            classTeacherIds.add(s.class_id);
            merged.push({ id: ci.id, name: ci.name, grade_level: ci.grade_level, subject_name: si?.name, role: 'subject_teacher' });
          } else {
            const existing = merged.find((m) => m.id === s.class_id);
            if (existing && !existing.subject_name) {
              existing.subject_name = si?.name;
            }
          }
        }
      }

      setClasses(merged);
    } catch (err) {
      console.error('Error fetching timetable:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [fetchData]);

  const getDayEntries = (day: string) => {
    const dayIndex = DAYS.indexOf(day);
    return entries.filter((e) => e.day_of_week === dayIndex).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const selectedEntries = getDayEntries(selectedDay);

  if (loading) return <LoadingScreen text="Loading timetable..." />;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Schedule" subtitle="Your weekly timetable" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        {entries.length === 0 && classes.length === 0 ? (
          <EmptyState icon="📅" title="No Timetable" subtitle="No schedule entries or classes assigned yet." />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow}>
              {DAYS.map((day) => {
                const active = day === selectedDay;
                const count = getDayEntries(day).length;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[styles.dayShort, active && styles.dayShortActive]}>
                      {DAY_SHORT[DAYS.indexOf(day)]}
                    </Text>
                    {count > 0 && (
                      <View style={[styles.dayDot, active && styles.dayDotActive]}>
                        <Text style={[styles.dayDotText, active && styles.dayDotTextActive]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <SectionHeader title={selectedDay} />

            {selectedEntries.length === 0 ? (
              <NotebookCard>
                <View style={styles.noClassRow}>
                  <Text style={styles.noClassIcon}>✏️</Text>
                  <View>
                    <Text style={styles.noClassTitle}>No classes</Text>
                    <Text style={styles.noClassSub}>Enjoy your free {selectedDay}!</Text>
                  </View>
                </View>
              </NotebookCard>
            ) : (
              selectedEntries.map((entry) => (
                <NotebookCard key={entry.id} accent={COLORS.chalk}>
                  <View style={styles.entryRow}>
                    <View style={[styles.timeCol, { backgroundColor: COLORS.chalkSoft }]}>
                      <Text style={styles.timeStart}>{entry.start_time.slice(0, 5)}</Text>
                      <View style={styles.timeLine} />
                      <Text style={styles.timeEnd}>{entry.end_time.slice(0, 5)}</Text>
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.subjectName}>{entry.subject_name || 'Subject'}</Text>
                      <Text style={styles.className}>{entry.class_name || 'Class'}</Text>
                      {entry.room ? <Badge text={`Room ${entry.room}`} color={COLORS.graphite} /> : null}
                    </View>
                  </View>
                </NotebookCard>
              ))
            )}

            <SectionHeader title="My Classes" />
            {classes.length === 0 ? (
              <NotebookCard>
                <Text style={styles.noClassSub}>No classes assigned.</Text>
              </NotebookCard>
            ) : (
              classes.map((cls) => (
                <NotebookCard key={cls.id} accent={cls.role === 'class_teacher' ? COLORS.chalk : COLORS.tape}>
                  <View style={styles.classRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.classTitle}>{cls.name}</Text>
                      <Text style={styles.classSub}>Grade {cls.grade_level}</Text>
                    </View>
                    <Badge
                      text={cls.role === 'class_teacher' ? 'Class Teacher' : cls.subject_name || 'Subject'}
                      color={cls.role === 'class_teacher' ? COLORS.chalk : COLORS.tape}
                    />
                  </View>
                </NotebookCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  dayRow: { marginBottom: 16 },
  dayChip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginRight: 8,
    minWidth: 56,
  },
  dayChipActive: {
    backgroundColor: COLORS.cover,
    borderColor: COLORS.cover,
  },
  dayShort: { fontSize: 13, fontWeight: '700', color: COLORS.graphite },
  dayShortActive: { color: COLORS.paper },
  dayDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.chalkSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  dayDotActive: { backgroundColor: COLORS.paper + '30' },
  dayDotText: { fontSize: 10, fontWeight: '700', color: COLORS.chalk },
  dayDotTextActive: { color: COLORS.paper },
  noClassRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noClassIcon: { fontSize: 28 },
  noClassTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  noClassSub: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
  entryRow: { flexDirection: 'row', gap: 14 },
  timeCol: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 60,
  },
  timeStart: { fontSize: 13, fontWeight: '800', color: COLORS.chalk },
  timeLine: { width: 1, height: 12, backgroundColor: COLORS.chalk + '30', marginVertical: 2 },
  timeEnd: { fontSize: 11, fontWeight: '600', color: COLORS.chalkSoft },
  entryInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  className: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  classTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  classSub: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
});
