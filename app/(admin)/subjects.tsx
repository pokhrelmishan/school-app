import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
  PrimaryButton,
  SectionHeader,
  Divider,
} from '../../lib/components';

interface Subject {
  id: string;
  name: string;
  created_at: string;
}

interface TeacherProfile {
  id: string;
  full_name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface TeacherSubjectAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  profiles: { full_name: string } | null;
  classes: { name: string } | null;
}

export default function AdminSubjectsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignSubjectId, setAssignSubjectId] = useState<string | null>(null);
  const [assignSubjectName, setAssignSubjectName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;

    const [subjectsRes, assignmentsRes, teachersRes, classesRes] = await Promise.all([
      supabase.from('subjects').select('id, name, created_at').eq('school_id', profile.school_id).order('name'),
      supabase.from('teacher_subjects').select('id, teacher_id, subject_id, class_id, profiles(full_name), classes(name)').eq('school_id', profile.school_id),
      supabase.from('profiles').select('id, full_name').eq('school_id', profile.school_id).eq('role', 'teacher').order('full_name'),
      supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
    ]);

    if (subjectsRes.data) setSubjects(subjectsRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as any);
    if (teachersRes.data) setTeachers(teachersRes.data);
    if (classesRes.data) setClasses(classesRes.data);
  }, [profile?.school_id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const getAssignmentsForSubject = (subjectId: string) => assignments.filter((a) => a.subject_id === subjectId);

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) { Alert.alert('Error', 'Subject name is required'); return; }
    if (!profile?.school_id) return;

    setSubmitting(true);
    const { error } = await supabase.from('subjects').insert({ name, school_id: profile.school_id });
    setSubmitting(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setNewSubjectName('');
    setCreateModalVisible(false);
    await fetchData();
  };

  const handleAssign = async () => {
    if (!selectedTeacherId || !selectedClassId || !assignSubjectId || !profile?.school_id) {
      Alert.alert('Error', 'Please select both a teacher and a class');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('teacher_subjects').insert({
      teacher_id: selectedTeacherId, subject_id: assignSubjectId, class_id: selectedClassId, school_id: profile.school_id,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert(error.code === '23505' ? 'Duplicate' : 'Error', error.code === '23505' ? 'Already assigned' : error.message);
      return;
    }
    setSelectedTeacherId(null);
    setSelectedClassId(null);
    setAssignModalVisible(false);
    await fetchData();
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    Alert.alert('Remove', 'Remove this assignment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await supabase.from('teacher_subjects').delete().eq('id', assignmentId); await fetchData(); } },
    ]);
  };

  const handleDeleteSubject = (subject: Subject) => {
    Alert.alert('Delete Subject', `Delete "${subject.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('subjects').delete().eq('id', subject.id); await fetchData(); } },
    ]);
  };

  const openAssignModal = (subjectId: string, subjectName: string) => {
    setAssignSubjectId(subjectId);
    setAssignSubjectName(subjectName);
    setSelectedTeacherId(null);
    setSelectedClassId(null);
    setAssignModalVisible(true);
  };

  if (loading) return <LoadingScreen text="Loading subjects..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Subjects" subtitle={`${subjects.length} total`} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        {subjects.length === 0 ? (
          <EmptyState icon={'\u{1F4D6}'} title="No Subjects Yet" subtitle="Create subjects and assign teachers." />
        ) : (
          subjects.map((subject) => {
            const subjectAssignments = getAssignmentsForSubject(subject.id);
            const isExpanded = expandedId === subject.id;
            return (
              <TouchableOpacity
                key={subject.id}
                activeOpacity={0.8}
                onPress={() => setExpandedId(isExpanded ? null : subject.id)}
                onLongPress={() => handleDeleteSubject(subject)}
              >
                <NotebookCard accent={COLORS.tape}>
                  <View style={styles.subjectHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <Text style={styles.assignmentCount}>
                        {subjectAssignments.length === 0 ? 'No assignments' : `${subjectAssignments.length} assignment${subjectAssignments.length !== 1 ? 's' : ''}`}
                      </Text>
                    </View>
                    <PrimaryButton title="+ Assign" onPress={() => openAssignModal(subject.id, subject.name)} />
                  </View>

                  {isExpanded && subjectAssignments.length > 0 && (
                    <View style={styles.assignmentsList}>
                      {subjectAssignments.map((a) => (
                        <View key={a.id} style={styles.assignmentRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.assignmentTeacher}>{a.profiles?.full_name ?? 'Unknown'}</Text>
                            <Text style={styles.assignmentClass}>{a.classes?.name ?? 'Unknown class'}</Text>
                          </View>
                          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveAssignment(a.id)}>
                            <Text style={styles.removeBtnText}>{'\u2715'}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isExpanded && subjectAssignments.length === 0 && (
                    <Text style={styles.noAssignText}>No teachers assigned yet. Tap "+ Assign" to get started.</Text>
                  )}
                </NotebookCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => { setNewSubjectName(''); setCreateModalVisible(true); }}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Subject</Text>
            <TextInput style={styles.input} placeholder="e.g. Mathematics" placeholderTextColor={COLORS.graphiteLight} value={newSubjectName} onChangeText={setNewSubjectName} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Create" onPress={handleCreateSubject} disabled={submitting} loading={submitting} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={assignModalVisible} transparent animationType="fade" onRequestClose={() => setAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign to {assignSubjectName}</Text>
            <Text style={styles.pickerLabel}>Teacher</Text>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {teachers.map((t) => (
                <TouchableOpacity key={t.id} style={[styles.pickerItem, selectedTeacherId === t.id && styles.pickerItemSelected]} onPress={() => setSelectedTeacherId(t.id)}>
                  <Text style={[styles.pickerItemText, selectedTeacherId === t.id && styles.pickerItemTextSelected]}>{t.full_name}</Text>
                </TouchableOpacity>
              ))}
              {teachers.length === 0 && <Text style={styles.emptyPickerText}>No teachers found</Text>}
            </ScrollView>
            <Text style={styles.pickerLabel}>Class</Text>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {classes.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.pickerItem, selectedClassId === c.id && styles.pickerItemSelected]} onPress={() => setSelectedClassId(c.id)}>
                  <Text style={[styles.pickerItemText, selectedClassId === c.id && styles.pickerItemTextSelected]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
              {classes.length === 0 && <Text style={styles.emptyPickerText}>No classes found</Text>}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssignModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Assign" onPress={handleAssign} disabled={submitting} loading={submitting} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },

  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  assignmentCount: { fontSize: 12, color: COLORS.graphite, marginTop: 2 },

  assignmentsList: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 8 },
  assignmentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.paperDim, borderRadius: 8, padding: 10, marginBottom: 6,
  },
  assignmentTeacher: { fontSize: 13, fontWeight: '500', color: COLORS.ink },
  assignmentClass: { fontSize: 11, color: COLORS.graphite, marginTop: 1 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.dangerBg, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  removeBtnText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  noAssignText: { fontSize: 12, color: COLORS.graphiteLight, textAlign: 'center', paddingVertical: 8 },

  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.cover, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabIcon: { color: COLORS.paper, fontSize: 28, fontWeight: '400', marginTop: -2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: COLORS.paper, borderRadius: 16, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.ink, marginBottom: 16,
  },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 8 },
  pickerScroll: { maxHeight: 140, marginBottom: 12 },
  pickerItem: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 12, marginBottom: 6 },
  pickerItemSelected: { backgroundColor: COLORS.chalkSoft, borderColor: COLORS.chalk },
  pickerItemText: { fontSize: 13, color: COLORS.ink },
  pickerItemTextSelected: { color: COLORS.chalk, fontWeight: '600' },
  emptyPickerText: { fontSize: 12, color: COLORS.graphiteLight, textAlign: 'center', paddingVertical: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.surfaceAlt },
  cancelBtnText: { color: COLORS.graphite, fontSize: 14, fontWeight: '600' },
});
