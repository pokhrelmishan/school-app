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
import {
  ScreenHeader,
  NotebookCard,
  EmptyState,
  LoadingScreen,
  PillSelector,
} from '../../lib/components';

interface GradeEntry {
  id: string;
  subject_name: string | null;
  grade_letter: string | null;
  practical_grade: string | null;
  subject_gpa: number | null;
  overall_gpa: number | null;
  term: string;
  created_at: string;
  score: number | null;
  max_score: number | null;
  class?: { name: string; grade_level: string };
}

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  subject?: { name: string };
  teacher?: { full_name: string };
}

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

const gradeColor = (pct: number) => {
  if (pct >= 80) return COLORS.chalk;
  if (pct >= 60) return COLORS.pencil;
  if (pct >= 40) return COLORS.blue;
  return COLORS.danger;
};

export default function StudentGradesScreen() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'schedule' | 'grades'>('schedule');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', user.id);

    const classIds = enrollments?.map((e) => e.class_id) || [];

    const [gradeRes, ttRes] = await Promise.all([
      supabase
        .from('grade_entries')
        .select('id, subject_name, grade_letter, practical_grade, subject_gpa, overall_gpa, term, created_at, score, max_score, class:classes(name, grade_level)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false }),
      classIds.length > 0
        ? supabase
            .from('timetable')
            .select('id, day_of_week, start_time, end_time, room, subject:subjects(name), teacher:profiles(full_name)')
            .in('class_id', classIds)
            .order('day_of_week')
            .order('start_time')
        : { data: [] },
    ]);

    if (gradeRes.data) {
      setGrades(gradeRes.data as unknown as GradeEntry[]);
    }
    if (ttRes.data) {
      setTimetable(
        ttRes.data.map((e: any) => ({
          ...e,
          subject: Array.isArray(e.subject) ? e.subject[0] : e.subject,
          teacher: Array.isArray(e.teacher) ? e.teacher[0] : e.teacher,
        }))
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const today = new Date();
  const currentDay = today.getDay();
  const todayEntries = timetable
    .filter((e) => e.day_of_week === currentDay)
    .sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));

  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay];

  if (loading) return <LoadingScreen text="Loading..." />;

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
      <ScreenHeader title="Classes" subtitle={todayName} />

      <View style={styles.body}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'schedule' && styles.togglePillActive]}
            activeOpacity={0.7}
            onPress={() => setViewMode('schedule')}
          >
            <Text style={[styles.toggleText, viewMode === 'schedule' && styles.toggleTextActive]}>
              Schedule
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'grades' && styles.togglePillActive]}
            activeOpacity={0.7}
            onPress={() => setViewMode('grades')}
          >
            <Text style={[styles.toggleText, viewMode === 'grades' && styles.toggleTextActive]}>
              Grades
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'schedule' ? (
          <>
            {todayEntries.length === 0 ? (
              <NotebookCard>
                <EmptyState
                  icon="📅"
                  title="No classes today"
                  subtitle="No classes scheduled for today"
                />
              </NotebookCard>
            ) : (
              todayEntries.map((entry, i) => (
                <NotebookCard key={entry.id} accent={COLORS.chalk}>
                  <View style={styles.entryRow}>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodText}>{i + 1}</Text>
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.subjectName}>
                        {entry.subject?.name || 'Subject'}
                      </Text>
                      {entry.teacher && (
                        <Text style={styles.teacherName}>
                          {entry.teacher.full_name}
                        </Text>
                      )}
                      {entry.room && (
                        <Text style={styles.roomName}>Room {entry.room}</Text>
                      )}
                    </View>
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeText}>{formatTime(entry.start_time)}</Text>
                      <Text style={styles.timeSep}>–</Text>
                      <Text style={styles.timeText}>{formatTime(entry.end_time)}</Text>
                    </View>
                  </View>
                </NotebookCard>
              ))
            )}
          </>
        ) : (
          <>
            {grades.length === 0 ? (
              <NotebookCard>
                <EmptyState
                  icon="📊"
                  title="No grades yet"
                  subtitle="Grades will appear here"
                />
              </NotebookCard>
            ) : (
              grades.map((grade) => {
                const pct =
                  grade.score != null && grade.max_score != null
                    ? Math.round((grade.score / grade.max_score) * 100)
                    : grade.subject_gpa != null
                    ? Math.round((grade.subject_gpa / 4) * 100)
                    : 0;
                const c = gradeColor(pct);
                const className = Array.isArray(grade.class)
                  ? grade.class[0]?.name
                  : grade.class?.name;

                return (
                  <NotebookCard key={grade.id}>
                    <View style={styles.gradeCard}>
                      <View style={[styles.gradeSquare, { borderColor: c }]}>
                        <Text style={[styles.gradeLetter, { color: c }]}>
                          {grade.grade_letter || '—'}
                        </Text>
                      </View>
                      <View style={styles.gradeInfo}>
                        <Text style={styles.gradeSubject}>
                          {grade.subject_name || 'Subject'}
                        </Text>
                        {className && (
                          <Text style={styles.gradeClass}>{className}</Text>
                        )}
                        <Text style={styles.gradeTerm}>{grade.term}</Text>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: c,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.gradePercent, { color: c }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>
                  </NotebookCard>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 24 }} />
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

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  togglePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  togglePillActive: {
    backgroundColor: COLORS.cover,
    borderColor: COLORS.cover,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.graphite,
  },
  toggleTextActive: {
    color: COLORS.paper,
  },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.chalkSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.chalk,
  },
  entryInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  roomName: {
    fontSize: 12,
    color: COLORS.graphiteLight,
    marginTop: 2,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.graphite,
  },
  timeSep: {
    fontSize: 11,
    color: COLORS.graphiteLight,
    marginHorizontal: 3,
  },

  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeSquare: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginRight: 14,
  },
  gradeLetter: {
    fontSize: 22,
    fontWeight: '800',
  },
  gradeInfo: {
    flex: 1,
  },
  gradeSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  gradeClass: {
    fontSize: 12,
    color: COLORS.graphite,
  },
  gradeTerm: {
    fontSize: 11,
    color: COLORS.graphiteLight,
    marginBottom: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.paperDim,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  gradePercent: {
    fontSize: 12,
    fontWeight: '700',
  },
});
