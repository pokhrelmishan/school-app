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
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  Card,
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
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 0 : new Date().getDay()]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [timetableRes, classTeacherRes, subjectRes] = await Promise.all([
        supabase
          .from('timetable')
          .select('*, classes(name), subjects(name)')
          .eq('teacher_id', user.id)
          .order('start_time'),
        supabase
          .from('classes')
          .select('id, name, grade_level')
          .eq('teacher_id', user.id),
        supabase
          .from('teacher_subjects')
          .select('class_id, classes(id, name, grade_level), subjects(name)')
          .eq('teacher_id', user.id),
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
          merged.push({
            id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            role: 'class_teacher',
          });
        }
      }

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const ci = s.classes as any;
          const si = s.subjects as any;
          if (!ci) continue;
          if (!classTeacherIds.has(s.class_id)) {
            classTeacherIds.add(s.class_id);
            merged.push({
              id: ci.id,
              name: ci.name,
              grade_level: ci.grade_level,
              subject_name: si?.name,
              role: 'subject_teacher',
            });
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getDayEntries = (day: string) => {
    const dayIndex = DAYS.indexOf(day);
    return entries
      .filter((e) => e.day_of_week === dayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const selectedEntries = getDayEntries(selectedDay);

  if (loading) return <LoadingScreen text="Loading timetable..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <PageHeader title="Timetable" subtitle="Your weekly schedule" />

      {entries.length === 0 && classes.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No Timetable"
          subtitle="No schedule entries or classes assigned yet."
        />
      ) : (
        <>
          <Text style={styles.sectionLabel}>This Week</Text>
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
            <Card>
              <View style={styles.noClassRow}>
                <Text style={styles.noClassIcon}>🎉</Text>
                <View>
                  <Text style={styles.noClassTitle}>No classes</Text>
                  <Text style={styles.noClassSub}>Enjoy your free {selectedDay}!</Text>
                </View>
              </View>
            </Card>
          ) : (
            selectedEntries.map((entry) => (
              <Card key={entry.id}>
                <View style={styles.entryRow}>
                  <View style={[styles.timeCol, { backgroundColor: COLORS.primaryBg }]}>
                    <Text style={styles.timeStart}>{entry.start_time.slice(0, 5)}</Text>
                    <View style={styles.timeLine} />
                    <Text style={styles.timeEnd}>{entry.end_time.slice(0, 5)}</Text>
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.subjectName}>{entry.subject_name || 'Subject'}</Text>
                    <Text style={styles.className}>{entry.class_name || 'Class'}</Text>
                    <View style={styles.entryMeta}>
                      {entry.room ? (
                        <Badge text={`Room ${entry.room}`} color={COLORS.textSecondary} />
                      ) : null}
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}

          <SectionHeader title="My Classes" />
          {classes.length === 0 ? (
            <Card>
              <Text style={styles.noClassSub}>No classes assigned.</Text>
            </Card>
          ) : (
            classes.map((cls) => (
              <Card key={cls.id}>
                <View style={styles.classRow}>
                  <View style={styles.classInfo}>
                    <Text style={styles.classTitle}>{cls.name}</Text>
                    <Text style={styles.classSub}>Grade {cls.grade_level}</Text>
                  </View>
                  <Badge
                    text={cls.role === 'class_teacher' ? 'Class Teacher' : cls.subject_name || 'Subject'}
                    color={cls.role === 'class_teacher' ? COLORS.primary : COLORS.success}
                  />
                </View>
              </Card>
            ))
          )}
        </>
      )}

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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dayRow: {
    marginBottom: 16,
  },
  dayChip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    marginRight: 8,
    minWidth: 56,
    ...SHADOWS.sm,
  },
  dayChipActive: {
    backgroundColor: COLORS.primary,
  },
  dayShort: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dayShortActive: {
    color: COLORS.textInverse,
  },
  dayDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  dayDotActive: {
    backgroundColor: COLORS.textInverse + '30',
  },
  dayDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dayDotTextActive: {
    color: COLORS.textInverse,
  },
  noClassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noClassIcon: {
    fontSize: 28,
  },
  noClassTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  noClassSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entryRow: {
    flexDirection: 'row',
    gap: 14,
  },
  timeCol: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 60,
  },
  timeStart: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  timeLine: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.primary + '30',
    marginVertical: 2,
  },
  timeEnd: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  entryInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  className: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entryMeta: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  classRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classInfo: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  classSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
