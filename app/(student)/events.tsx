import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, Badge, EmptyState, LoadingScreen } from '../../lib/components';

interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  end_date: string;
  event_type: 'event' | 'holiday' | 'exam' | 'meeting' | 'activity';
}

const EVENT_COLORS: Record<string, string> = {
  event: COLORS.primary,
  holiday: COLORS.success,
  exam: COLORS.danger,
  meeting: COLORS.warning,
  activity: COLORS.primary,
};

export default function StudentEventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const { data } = await supabase
      .from('school_events')
      .select('id, title, description, event_date, event_time, end_date, event_type')
      .order('event_date', { ascending: true });

    if (data) setEvents(data as SchoolEvent[]);
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

  const today = new Date(new Date().toDateString());
  const upcoming = events.filter((e) => new Date(e.event_date) >= today);
  const past = events.filter((e) => new Date(e.event_date) < today);

  const formatEventDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const daysUntil = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (diff < 0) return null;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff}d`;
  };

  const renderEvent = (item: SchoolEvent, isPast = false) => {
    const c = EVENT_COLORS[item.event_type] || COLORS.primary;
    const d = daysUntil(item.event_date);

    return (
      <Card key={item.id} style={{ ...styles.eventCard, ...(isPast ? styles.eventCardPast : {}) }}>
        <View style={styles.eventTop}>
          <View style={[styles.eventTypeDot, { backgroundColor: c }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, isPast && styles.eventTitlePast]}>{item.title}</Text>
            <Text style={styles.eventType}>{item.event_type.charAt(0).toUpperCase() + item.event_type.slice(1)}</Text>
          </View>
          <Badge
            text={item.event_type}
            color={c}
          />
        </View>

        {item.description ? (
          <Text style={[styles.eventDesc, isPast && styles.eventDescPast]} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.eventFooter}>
          <View style={styles.eventDateRow}>
            <Text style={styles.eventDateIcon}>📅</Text>
            <Text style={[styles.eventDate, isPast && styles.eventDatePast]}>{formatEventDate(item.event_date)}</Text>
          </View>
          {item.event_time && (
            <View style={styles.eventDateRow}>
              <Text style={styles.eventDateIcon}>🕐</Text>
              <Text style={[styles.eventDate, isPast && styles.eventDatePast]}>{item.event_time}</Text>
            </View>
          )}
        </View>

        {d !== null && !isPast && (
          <View style={[styles.countdownBadge, { backgroundColor: c + '15' }]}>
            <Text style={[styles.countdownText, { color: c }]}>{d}</Text>
          </View>
        )}
      </Card>
    );
  };

  if (loading) return <LoadingScreen text="Loading events..." />;

  return (
    <FlatList
      style={styles.container}
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <View>
          <PageHeader title="Events" subtitle={`${upcoming.length} upcoming`} />

          {upcoming.length === 0 && past.length === 0 ? (
            <EmptyState icon="📅" title="No events" subtitle="No school events scheduled" />
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Upcoming Events</Text>
                  {upcoming.map((item) => renderEvent(item))}
                </>
              )}

              {past.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Past Events</Text>
                  {past.map((item) => renderEvent(item, true))}
                </>
              )}
            </>
          )}

          <View style={{ height: 24 }} />
        </View>
      }
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  eventCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  eventCardPast: { opacity: 0.6 },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  eventTypeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 4 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  eventTitlePast: { color: COLORS.textSecondary },
  eventType: { fontSize: 12, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  eventDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  eventDescPast: { color: COLORS.textTertiary },
  eventFooter: { flexDirection: 'row', gap: 16 },
  eventDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventDateIcon: { fontSize: 12 },
  eventDate: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  eventDatePast: { color: COLORS.textTertiary },
  countdownBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countdownText: { fontSize: 12, fontWeight: '700' },
});
