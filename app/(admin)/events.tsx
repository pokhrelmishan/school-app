import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

const EVENT_TYPES = ['event', 'holiday', 'exam', 'meeting', 'activity'] as const;
type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  event: COLORS.blue, holiday: COLORS.chalk, exam: COLORS.tape, meeting: COLORS.pencil, activity: COLORS.blue,
};

interface SchoolEvent {
  id: string; title: string; description: string; event_date: string; event_time: string; end_date: string; event_type: EventType;
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
    const { data } = await supabase.from('school_events').select('*').eq('school_id', schoolId).order('event_date', { ascending: true });
    if (data) setEvents(data as SchoolEvent[]);
  }, [schoolId]);

  useEffect(() => { fetchEvents().finally(() => setLoading(false)); }, [fetchEvents]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchEvents(); setRefreshing(false); }, [fetchEvents]);

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => e.event_date >= today);
  const pastEvents = events.filter((e) => e.event_date < today);

  const openModal = () => {
    setFormTitle(''); setFormDescription(''); setFormDate(''); setFormTime(''); setFormEndDate(''); setFormType('event');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) { Alert.alert('Missing', 'Enter event title.'); return; }
    if (!formDate.trim()) { Alert.alert('Missing', 'Enter event date.'); return; }
    if (!schoolId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('school_events').insert({
        title: formTitle.trim(), description: formDescription.trim() || null, event_date: formDate.trim(),
        event_time: formTime.trim() || null, end_date: formEndDate.trim() || null, event_type: formType,
        school_id: schoolId, created_by: user?.id ?? null,
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
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('school_events').delete().eq('id', event.id); await fetchEvents(); } },
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
      <ScreenHeader title="Events" subtitle={`${events.length} total`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        {events.length === 0 ? (
          <EmptyState icon={'\u{1F4C6}'} title="No Events" subtitle="Create events, holidays, and activities." action={{ label: 'Create Event', onPress: openModal }} />
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Upcoming" />
                {upcomingEvents.map((event) => (
                  <TouchableOpacity key={event.id} activeOpacity={0.7} onLongPress={() => handleDelete(event)}>
                    <NotebookCard accent={EVENT_TYPE_COLORS[event.event_type]}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Badge text={event.event_type} color={EVENT_TYPE_COLORS[event.event_type]} />
                      </View>
                      <Text style={styles.eventDate}>{formatDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ''}</Text>
                      {event.description ? <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text> : null}
                    </NotebookCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {pastEvents.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Past Events" />
                {pastEvents.map((event) => (
                  <TouchableOpacity key={event.id} activeOpacity={0.7} onLongPress={() => handleDelete(event)}>
                    <NotebookCard style={{ opacity: 0.6 }}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Badge text={event.event_type} color={EVENT_TYPE_COLORS[event.event_type]} />
                      </View>
                      <Text style={styles.eventDate}>{formatDate(event.event_date)}</Text>
                    </NotebookCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} placeholder="e.g. Science Fair" placeholderTextColor={COLORS.graphiteLight} value={formTitle} onChangeText={setFormTitle} autoFocus />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} placeholder="Optional" placeholderTextColor={COLORS.graphiteLight} value={formDescription} onChangeText={setFormDescription} multiline />
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.typePill, formType === t && { backgroundColor: EVENT_TYPE_COLORS[t] }]} onPress={() => setFormType(t)}>
                  <Text style={[styles.typePillText, formType === t && { color: COLORS.paper }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.graphiteLight} value={formDate} onChangeText={setFormDate} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Time</Text>
                <TextInput style={styles.input} placeholder="10:00" placeholderTextColor={COLORS.graphiteLight} value={formTime} onChangeText={setFormTime} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>End Date</Text>
                <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={COLORS.graphiteLight} value={formEndDate} onChangeText={setFormEndDate} />
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Create Event" onPress={handleCreate} disabled={submitting} loading={submitting} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 16, paddingBottom: 100 },

  section: { marginBottom: 16 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: COLORS.ink, flex: 1 },
  eventDate: { fontSize: 12, color: COLORS.graphite },
  eventDesc: { fontSize: 12, color: COLORS.graphiteLight, marginTop: 6 },

  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.cover, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: COLORS.paper, lineHeight: 30 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.graphite, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.ink, marginBottom: 12 },
  row: { flexDirection: 'row' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  typePillText: { fontSize: 12, fontWeight: '600', color: COLORS.graphite },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.graphite },
});
