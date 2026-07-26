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
} from '../../lib/components';

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

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const dates: { label: string; date: number; full: Date; dayIdx: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      label: DAY_LABELS[d.getDay()],
      date: d.getDate(),
      full: d,
      dayIdx: d.getDay(),
    });
  }
  return dates;
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

export default function StudentTimetableScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  const weekDates = getWeekDates();
  const today = new Date();

  const fetchData = useCallback(async (isRefresh = false) => {
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
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const dayEntries = entries
    .filter((e) => e.day_of_week === selectedDay)
    .sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));

  if (loading) return <LoadingScreen text="Loading schedule..." />;

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
      <ScreenHeader title="Schedule" />

      <View style={styles.body}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayPicker}
          contentContainerStyle={styles.dayPickerContent}
        >
          {weekDates.map((day) => {
            const isActive = day.dayIdx === selectedDay;
            const isToday =
              day.full.toDateString() === today.toDateString();
            return (
              <TouchableOpacity
                key={day.dayIdx}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedDay(day.dayIdx)}
              >
                <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    isActive && styles.dayDateActive,
                    isToday && !isActive && styles.dayDateHighlight,
                  ]}
                >
                  {day.date}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {dayEntries.length === 0 ? (
          <NotebookCard>
            <EmptyState
              icon="📅"
              title="No classes"
              subtitle="No classes scheduled for this day"
            />
          </NotebookCard>
        ) : (
          dayEntries.map((entry, i) => (
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

  dayPicker: {
    marginBottom: 16,
  },
  dayPickerContent: {
    gap: 8,
  },
  dayPill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
    minWidth: 56,
  },
  dayPillActive: {
    backgroundColor: COLORS.cover,
    borderColor: COLORS.cover,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.graphite,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dayLabelActive: {
    color: COLORS.paper,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  dayDateActive: {
    color: COLORS.paper,
  },
  dayDateHighlight: {
    color: COLORS.tape,
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
});
