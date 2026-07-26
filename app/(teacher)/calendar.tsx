import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  EmptyState,
  CatPill,
} from '../../lib/components';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function buildCalendarGrid(year: number, month: number) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);
  const grid: { day: number; currentMonth: boolean; date: Date }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    grid.push({ day: d, currentMonth: false, date: new Date(year, month - 1, d) });
  }
  for (let d = 1; d <= totalDays; d++) {
    grid.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }
  const remaining = 42 - grid.length;
  for (let d = 1; d <= remaining; d++) {
    grid.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
  }
  return grid;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  event_date: string;
  source: 'event' | 'assignment';
}

export default function TeacherCalendar() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const daysInGrid = buildCalendarGrid(year, month);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const fetchEvents = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);

    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`;

    const [eventsRes, assignmentsRes] = await Promise.all([
      supabase.from('events').select('id, title, description, event_type, event_date').eq('school_id', profile?.school_id ?? '').gte('event_date', monthStart).lte('event_date', monthEnd),
      supabase.from('assignments').select('id, title, description, event_type, due_date').eq('school_id', profile?.school_id ?? '').gte('due_date', monthStart).lte('due_date', monthEnd),
    ]);

    const mapped: CalendarEvent[] = [];
    const dates = new Set<string>();

    if (eventsRes.data) {
      for (const e of eventsRes.data) {
        mapped.push({ id: e.id, title: e.title, description: e.description, event_type: e.event_type, event_date: e.event_date, source: 'event' });
        dates.add(e.event_date);
      }
    }
    if (assignmentsRes.data) {
      for (const a of assignmentsRes.data) {
        mapped.push({ id: a.id, title: a.title, description: a.description, event_type: a.event_type ?? 'assignment', event_date: a.due_date, source: 'assignment' });
        dates.add(a.due_date);
      }
    }

    setEvents(mapped);
    setEventDates(dates);
    setLoading(false);
    setRefreshing(false);
  }, [year, month, profile?.school_id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
  }, [fetchEvents]);

  const selectedDateKey = dateKey(selectedDate);
  const selectedDayEvents = events.filter((e) => e.event_date === selectedDateKey);

  const goToPrev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); } };
  const goToNext = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); } };

  const getEventCategory = (type: string, source: string) => {
    if (source === 'assignment') return 'Deadline';
    switch (type?.toLowerCase()) {
      case 'holiday': return 'Holiday';
      case 'event':
      default: return 'Event';
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Calendar" subtitle="Events and schedule" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        <NotebookCard>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrev} style={styles.navArrow}>
              <Text style={styles.navArrowText}>{'‹'}</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={goToNext} style={styles.navArrow}>
              <Text style={styles.navArrowText}>{'›'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.daysHeader}>
            {DAYS.map((d) => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {daysInGrid.map((cell, i) => {
              const isToday = isSameDay(cell.date, today);
              const isSelected = isSameDay(cell.date, selectedDate);
              const dk = dateKey(cell.date);
              const hasEvent = eventDates.has(dk);
              const isCurrentMonth = cell.currentMonth;

              return (
                <TouchableOpacity key={i} style={styles.dayCell} onPress={() => setSelectedDate(cell.date)} activeOpacity={0.6}>
                  <View style={[styles.dayInner, isSelected && styles.daySelected, isToday && !isSelected && styles.dayToday]}>
                    <Text style={[styles.dayText, !isCurrentMonth && styles.dayTextMuted, isSelected && styles.dayTextSelected, isToday && !isSelected && styles.dayTextToday]}>
                      {cell.day}
                    </Text>
                  </View>
                  {hasEvent && isCurrentMonth && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </NotebookCard>

        <View style={styles.eventsSection}>
          <Text style={styles.eventsSectionTitle}>
            Events for {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.cover} size="small" style={{ marginTop: 16 }} />
          ) : selectedDayEvents.length === 0 ? (
            <EmptyState icon="📅" title="No events for this day" />
          ) : (
            selectedDayEvents.map((ev) => (
              <NotebookCard key={ev.id} accent={ev.source === 'assignment' ? COLORS.pencil : COLORS.tape}>
                <View style={styles.eventCardHeader}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <CatPill category={getEventCategory(ev.event_type, ev.source)} />
                </View>
                {ev.description ? <Text style={styles.eventDesc}>{ev.description}</Text> : null}
              </NotebookCard>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 20, paddingBottom: 40, backgroundColor: COLORS.paper },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navArrow: { padding: 8 },
  navArrowText: { fontSize: 28, color: COLORS.ink, fontWeight: '300', lineHeight: 30 },
  monthTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
  daysHeader: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.graphite, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  dayInner: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  daySelected: { backgroundColor: COLORS.cover },
  dayToday: { borderWidth: 1.5, borderColor: COLORS.tape },
  dayText: { fontSize: 14, fontWeight: '500', color: COLORS.ink },
  dayTextMuted: { color: COLORS.graphite, opacity: 0.4 },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: COLORS.tape, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.pencil, marginTop: 2 },
  eventsSection: { marginTop: 20 },
  eventsSectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.ink, marginBottom: 12 },
  eventCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 15, fontWeight: '600', color: COLORS.ink, flex: 1 },
  eventDesc: { fontSize: 13, color: COLORS.graphite, marginTop: 6, lineHeight: 18 },
});
