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
  PillSelector,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  class_name?: string;
  subject_name?: string;
  teacher_name?: string;
}

interface ClassItem { id: string; name: string; }
interface SubjectItem { id: string; name: string; }
interface TeacherItem { id: string; full_name: string; }

export default function TimetableScreen() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formClassId, setFormClassId] = useState<string | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<string | null>(null);
  const [formTeacherId, setFormTeacherId] = useState<string | null>(null);
  const [formDay, setFormDay] = useState(0);
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formRoom, setFormRoom] = useState('');

  const schoolId = profile?.school_id;

  const fetchData = useCallback(async () => {
    if (!schoolId) return;

    const [classRes, subjectRes, teacherRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).eq('role', 'teacher').order('full_name'),
    ]);

    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);
    if (teacherRes.data) setTeachers(teacherRes.data);

    const classMap: Record<string, string> = {};
    if (classRes.data) for (const c of classRes.data) classMap[c.id] = c.name;
    const subjectMap: Record<string, string> = {};
    if (subjectRes.data) for (const s of subjectRes.data) subjectMap[s.id] = s.name;
    const teacherMap: Record<string, string> = {};
    if (teacherRes.data) for (const t of teacherRes.data) teacherMap[t.id] = t.full_name;

    const { data: ttData } = await supabase.from('timetable').select('*').eq('school_id', schoolId).order('day_of_week').order('start_time');
    if (ttData) {
      setEntries(ttData.map((e) => ({
        ...e,
        class_name: classMap[e.class_id] || 'Unknown',
        subject_name: subjectMap[e.subject_id] || 'Unknown',
        teacher_name: teacherMap[e.teacher_id] || 'Unassigned',
      })));
    }
  }, [schoolId]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const filteredEntries = selectedClass === 'All' ? entries : entries.filter((e) => e.class_name === selectedClass);

  const groupedByDay: Record<number, TimetableEntry[]> = {};
  for (const e of filteredEntries) {
    if (!groupedByDay[e.day_of_week]) groupedByDay[e.day_of_week] = [];
    groupedByDay[e.day_of_week].push(e);
  }

  const openModal = () => {
    setFormClassId(null); setFormSubjectId(null); setFormTeacherId(null);
    setFormDay(0); setFormStartTime(''); setFormEndTime(''); setFormRoom('');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formClassId || !formSubjectId || !formTeacherId) { Alert.alert('Missing', 'Select class, subject, and teacher.'); return; }
    if (!formStartTime.trim() || !formEndTime.trim()) { Alert.alert('Missing', 'Enter start and end times.'); return; }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('timetable').insert({
        class_id: formClassId, subject_id: formSubjectId, teacher_id: formTeacherId,
        day_of_week: formDay, start_time: formStartTime.trim(), end_time: formEndTime.trim(),
        room: formRoom.trim() || null, school_id: schoolId,
      });
      if (error) throw error;
      setModalVisible(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (entry: TimetableEntry) => {
    Alert.alert('Delete Entry', 'Remove this timetable entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('timetable').delete().eq('id', entry.id); await fetchData(); } },
    ]);
  };

  if (loading) return <LoadingScreen text="Loading timetable..." />;

  const classPills = ['All', ...new Set(classes.map((c) => c.name))];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Timetable" subtitle={`${filteredEntries.length} entries`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        {classes.length > 0 && (
          <PillSelector items={classPills} selected={selectedClass} onSelect={setSelectedClass} />
        )}

        {filteredEntries.length === 0 ? (
          <EmptyState icon={'\u{1F4C5}'} title="No Timetable Entries" subtitle="Add your first entry to get started." action={{ label: 'Add Entry', onPress: openModal }} />
        ) : (
          DAYS.map((day, idx) => {
            const dayEntries = groupedByDay[idx];
            if (!dayEntries || dayEntries.length === 0) return null;
            return (
              <View key={day} style={styles.daySection}>
                <Text style={styles.dayTitle}>{DAY_NAMES[idx]}</Text>
                {dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((entry) => (
                  <TouchableOpacity key={entry.id} activeOpacity={0.7} onLongPress={() => handleDelete(entry)}>
                    <NotebookCard accent={COLORS.chalk}>
                      <View style={styles.entryRow}>
                        <View style={styles.timeCol}>
                          <Text style={styles.entryTime}>{entry.start_time}</Text>
                          <Text style={styles.entryTimeEnd}>{entry.end_time}</Text>
                        </View>
                        <View style={styles.entryDivider} />
                        <View style={styles.entryInfo}>
                          <Text style={styles.entrySubject}>{entry.subject_name}</Text>
                          <Text style={styles.entryMeta}>
                            {entry.class_name}{entry.room ? ` \u00B7 ${entry.room}` : ''}
                          </Text>
                          <Text style={styles.entryTeacher}>{entry.teacher_name}</Text>
                        </View>
                      </View>
                    </NotebookCard>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Timetable Entry</Text>

            <Text style={styles.label}>Class</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Class', undefined, [{ text: 'Cancel', style: 'cancel' }, ...classes.map((c) => ({ text: c.name, onPress: () => setFormClassId(c.id) }))])}>
              <Text style={[styles.pickerText, !formClassId && { color: COLORS.graphiteLight }]}>{formClassId ? classes.find((c) => c.id === formClassId)?.name || 'Unknown' : 'Tap to select'}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Subject</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Subject', undefined, [{ text: 'Cancel', style: 'cancel' }, ...subjects.map((s) => ({ text: s.name, onPress: () => setFormSubjectId(s.id) }))])}>
              <Text style={[styles.pickerText, !formSubjectId && { color: COLORS.graphiteLight }]}>{formSubjectId ? subjects.find((s) => s.id === formSubjectId)?.name || 'Unknown' : 'Tap to select'}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Teacher</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Teacher', undefined, [{ text: 'Cancel', style: 'cancel' }, ...teachers.map((t) => ({ text: t.full_name, onPress: () => setFormTeacherId(t.id) }))])}>
              <Text style={[styles.pickerText, !formTeacherId && { color: COLORS.graphiteLight }]}>{formTeacherId ? teachers.find((t) => t.id === formTeacherId)?.full_name || 'Unknown' : 'Tap to select'}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Day</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Day', undefined, [{ text: 'Cancel', style: 'cancel' }, ...DAY_NAMES.map((d, i) => ({ text: d, onPress: () => setFormDay(i) }))])}>
              <Text style={styles.pickerText}>{DAY_NAMES[formDay]}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput style={styles.input} placeholder="08:00" placeholderTextColor={COLORS.graphiteLight} value={formStartTime} onChangeText={setFormStartTime} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>End Time</Text>
                <TextInput style={styles.input} placeholder="09:00" placeholderTextColor={COLORS.graphiteLight} value={formEndTime} onChangeText={setFormEndTime} />
              </View>
            </View>

            <Text style={styles.label}>Room</Text>
            <TextInput style={styles.input} placeholder="e.g. Room 101" placeholderTextColor={COLORS.graphiteLight} value={formRoom} onChangeText={setFormRoom} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Add Entry" onPress={handleCreate} disabled={submitting} loading={submitting} />
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

  daySection: { marginBottom: 16 },
  dayTitle: { fontSize: 12, fontWeight: '700', color: COLORS.chalk, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  entryRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: { alignItems: 'center', width: 52 },
  entryTime: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  entryTimeEnd: { fontSize: 11, color: COLORS.graphiteLight },
  entryDivider: { width: 3, height: 32, backgroundColor: COLORS.chalk, borderRadius: 2, marginHorizontal: 10 },
  entryInfo: { flex: 1 },
  entrySubject: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  entryMeta: { fontSize: 11, color: COLORS.graphite, marginTop: 2 },
  entryTeacher: { fontSize: 11, color: COLORS.graphiteLight, marginTop: 1 },

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
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  pickerText: { fontSize: 14, color: COLORS.ink },
  pickerChevron: { fontSize: 12, color: COLORS.graphiteLight },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.graphite },
});
