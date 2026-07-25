import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  Card,
  Badge,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

const EVENT_TYPES = ['event', 'holiday', 'exam', 'meeting', 'activity'] as const;
type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  event: COLORS.primary,
  holiday: COLORS.success,
  exam: COLORS.danger,
  meeting: COLORS.warning,
  activity: '#8B5CF6',
};

interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  end_date: string;
  event_type: EventType;
  created_at: string;
}

export default function EventsScreen() {
  const { profile, user } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formType, setFormType] = useState<EventType>('event');

  const schoolId = profile?.school_id;

  const fetchEvents = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('school_events')
      .select('*')
      .eq('school_id', schoolId)
      .order('event_date', { ascending: true });

    if (data) setEvents(data as SchoolEvent[]);
  }, [schoolId]);

  useEffect(() => {
    fetchEvents().finally(() => setLoading(false));
  }, [fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => e.event_date >= today);
  const pastEvents = events.filter((e) => e.event_date < today);

  const openModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormDate('');
    setFormTime('');
    setFormEndDate('');
    setFormType('event');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Missing fields', 'Please enter an event title.');
      return;
    }
    if (!formDate.trim()) {
      Alert.alert('Missing fields', 'Please enter an event date.');
      return;
    }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('school_events').insert({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        event_date: formDate.trim(),
        event_time: formTime.trim() || null,
        end_date: formEndDate.trim() || null,
        event_type: formType,
        school_id: schoolId,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setModalVisible(false);
      await fetchEvents();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (event: SchoolEvent) => {
    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('school_events').delete().eq('id', event.id);
          if (!error) fetchEvents();
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return <LoadingScreen text="Loading events..." />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <PageHeader
          title="Events"
          subtitle={`${events.length} total`}
          right={<PrimaryButton title="New" icon="+" onPress={openModal} />}
        />

        {events.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No Events"
            subtitle="Create events, holidays, and activities for your school."
            action={{ label: 'Create Event', onPress: openModal }}
          />
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                {upcomingEvents.map((event) => (
                  <Card key={event.id} style={styles.eventCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => handleDelete(event)}
                    >
                      <View style={styles.eventRow}>
                        <View style={[styles.eventDot, { backgroundColor: EVENT_TYPE_COLORS[event.event_type] }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            <Badge text={event.event_type} color={EVENT_TYPE_COLORS[event.event_type]} />
                          </View>
                          <Text style={styles.eventDate}>
                            {formatDate(event.event_date)}
                            {event.event_time ? ` at ${event.event_time}` : ''}
                          </Text>
                          {event.description ? (
                            <Text style={styles.eventDesc} numberOfLines={2}>
                              {event.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Card>
                ))}
              </View>
            )}

            {pastEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past Events</Text>
                {pastEvents.map((event) => (
                  <Card key={event.id} style={[styles.eventCard, { opacity: 0.7 }] as any}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={() => handleDelete(event)}
                    >
                      <View style={styles.eventRow}>
                        <View style={[styles.eventDot, { backgroundColor: EVENT_TYPE_COLORS[event.event_type] }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            <Badge text={event.event_type} color={EVENT_TYPE_COLORS[event.event_type]} />
                          </View>
                          <Text style={styles.eventDate}>{formatDate(event.event_date)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Science Fair"
              placeholderTextColor={COLORS.textTertiary}
              value={formTitle}
              onChangeText={setFormTitle}
              autoFocus
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Optional description"
              placeholderTextColor={COLORS.textTertiary}
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, formType === t && { backgroundColor: EVENT_TYPE_COLORS[t] }]}
                  onPress={() => setFormType(t)}
                >
                  <Text style={[styles.typePillText, formType === t && { color: COLORS.textInverse }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textTertiary}
              value={formDate}
              onChangeText={setFormDate}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10:00"
                  placeholderTextColor={COLORS.textTertiary}
                  value={formTime}
                  onChangeText={setFormTime}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>End Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor={COLORS.textTertiary}
                  value={formEndDate}
                  onChangeText={setFormEndDate}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Create Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCard: {
    padding: 14,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  eventDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  eventDesc: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
