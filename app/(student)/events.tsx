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
  CatPill,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  end_date: string;
  event_type: 'event' | 'holiday' | 'exam' | 'meeting' | 'activity';
}

const EVENT_ACCENT: Record<string, string> = {
  event: COLORS.tape,
  holiday: COLORS.chalk,
  exam: COLORS.danger,
  meeting: COLORS.pencil,
  activity: COLORS.blue,
};

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
      label: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()],
      date: d.getDate(),
      full: d,
      dayIdx: d.getDay(),
    });
  }
  return dates;
}

export default function StudentEventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const weekDates = getWeekDates();
  const today = new Date();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const { data } = await supabase
      .from('school_events')
      .select('id, title, description, event_date, event_time, end_date, event_type')
      .order('event_date', { ascending: true });

    if (data) setEvents(data as SchoolEvent[]);
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

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const dayEvents = events.filter((e) => e.event_date === selectedDateStr);

  const formatEventDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  if (loading) return <LoadingScreen text="Loading events..." />;

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
      <ScreenHeader title="Calendar" />

      <View style={styles.body}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekPicker}
          contentContainerStyle={styles.weekPickerContent}
        >
          {weekDates.map((day) => {
            const isActive =
              day.full.toISOString().split('T')[0] === selectedDateStr;
            const isToday =
              day.full.toDateString() === today.toDateString();
            return (
              <TouchableOpacity
                key={day.dayIdx}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedDate(day.full)}
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

        <Text style={styles.selectedDateText}>
          {formatEventDate(selectedDateStr)}
        </Text>

        {dayEvents.length === 0 ? (
          <NotebookCard>
            <EmptyState
              icon="📅"
              title="No events"
              subtitle="Nothing scheduled for this day"
            />
          </NotebookCard>
        ) : (
          dayEvents.map((event) => {
            const accent = EVENT_ACCENT[event.event_type] || COLORS.tape;
            return (
              <NotebookCard key={event.id} accent={accent}>
                <View style={styles.eventRow}>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.event_time && (
                      <Text style={styles.eventTime}>{event.event_time}</Text>
                    )}
                    {event.description ? (
                      <Text style={styles.eventDesc} numberOfLines={2}>
                        {event.description}
                      </Text>
                    ) : null}
                  </View>
                  <CatPill category={event.event_type} />
                </View>
              </NotebookCard>
            );
          })
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

  weekPicker: {
    marginBottom: 12,
  },
  weekPickerContent: {
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

  selectedDateText: {
    fontSize: 13,
    color: COLORS.graphite,
    marginBottom: 16,
    fontWeight: '600',
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 13,
    color: COLORS.graphite,
    marginBottom: 4,
  },
  eventDesc: {
    fontSize: 13,
    color: COLORS.graphiteLight,
    lineHeight: 18,
  },
});
