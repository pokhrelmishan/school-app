import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignSubjectId, setAssignSubjectId] = useState<string | null>(null);
  const [assignSubjectName, setAssignSubjectName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [profile?.school_id]);

  const fetchData = async () => {
    if (!profile?.school_id) return;
    setLoading(true);

    const [subjectsRes, assignmentsRes, teachersRes, classesRes] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, name, created_at')
        .eq('school_id', profile.school_id)
        .order('name'),
      supabase
        .from('teacher_subjects')
        .select('id, teacher_id, subject_id, class_id, profiles(full_name), classes(name)')
        .eq('school_id', profile.school_id),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', profile.school_id)
        .eq('role', 'teacher')
        .order('full_name'),
      supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .order('name'),
    ]);

    if (subjectsRes.data) setSubjects(subjectsRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as any);
    if (teachersRes.data) setTeachers(teachersRes.data);
    if (classesRes.data) setClasses(classesRes.data);
    setLoading(false);
  };

  const getAssignmentsForSubject = (subjectId: string) =>
    assignments.filter((a) => a.subject_id === subjectId);

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      Alert.alert('Error', 'Subject name is required');
      return;
    }
    if (!profile?.school_id) return;

    setSubmitting(true);
    const { error } = await supabase.from('subjects').insert({
      name,
      school_id: profile.school_id,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setNewSubjectName('');
    setCreateModalVisible(false);
    fetchData();
  };

  const handleAssign = async () => {
    if (!selectedTeacherId || !selectedClassId || !assignSubjectId || !profile?.school_id) {
      Alert.alert('Error', 'Please select both a teacher and a class');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('teacher_subjects').insert({
      teacher_id: selectedTeacherId,
      subject_id: assignSubjectId,
      class_id: selectedClassId,
      school_id: profile.school_id,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Duplicate', 'This teacher is already assigned to this subject for the selected class');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    setSelectedTeacherId(null);
    setSelectedClassId(null);
    setAssignModalVisible(false);
    fetchData();
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    Alert.alert('Remove Assignment', 'Are you sure you want to remove this assignment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('teacher_subjects').delete().eq('id', assignmentId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            fetchData();
          }
        },
      },
    ]);
  };

  const handleDeleteSubject = (subject: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"? This will also remove all teacher assignments for this subject.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              fetchData();
            }
          },
        },
      ],
    );
  };

  const openAssignModal = (subjectId: string, subjectName: string) => {
    setAssignSubjectId(subjectId);
    setAssignSubjectName(subjectName);
    setSelectedTeacherId(null);
    setSelectedClassId(null);
    setAssignModalVisible(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Subjects</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/profile' as any)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {subjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyTitle}>No Subjects Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create subjects and assign teachers to get started.
            </Text>
          </View>
        ) : (
          subjects.map((subject) => {
            const subjectAssignments = getAssignmentsForSubject(subject.id);
            const isExpanded = expandedId === subject.id;

            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.subjectCard, SHADOWS.sm]}
                activeOpacity={0.8}
                onPress={() => toggleExpand(subject.id)}
                onLongPress={() => handleDeleteSubject(subject)}
              >
                <View style={styles.subjectCardHeader}>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{subject.name}</Text>
                    <Text style={styles.assignmentCount}>
                      {subjectAssignments.length === 0
                        ? 'No assignments'
                        : `${subjectAssignments.length} assignment${subjectAssignments.length !== 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.assignBtn, SHADOWS.sm]}
                    onPress={() => openAssignModal(subject.id, subject.name)}
                  >
                    <Text style={styles.assignBtnText}>+ Assign</Text>
                  </TouchableOpacity>
                </View>

                {isExpanded && subjectAssignments.length > 0 && (
                  <View style={styles.assignmentsList}>
                    {subjectAssignments.map((assignment) => (
                      <View key={assignment.id} style={styles.assignmentRow}>
                        <View style={styles.assignmentInfo}>
                          <Text style={styles.assignmentTeacher}>
                            {assignment.profiles?.full_name ?? 'Unknown'}
                          </Text>
                          <Text style={styles.assignmentClass}>
                            {assignment.classes?.name ?? 'Unknown class'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveAssignment(assignment.id)}
                        >
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {isExpanded && subjectAssignments.length === 0 && (
                  <View style={styles.assignmentsList}>
                    <Text style={styles.noAssignmentsText}>
                      No teachers assigned yet. Tap "+ Assign" to get started.
                    </Text>
                  </View>
                )}

                <Text style={[styles.expandChevron, isExpanded && styles.expandChevronOpen]}>
                  ▾
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, SHADOWS.lg]}
        activeOpacity={0.85}
        onPress={() => {
          setNewSubjectName('');
          setCreateModalVisible(true);
        }}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create Subject Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mathematics, English, Science"
              placeholderTextColor={COLORS.textTertiary}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleCreateSubject}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Create Subject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Teacher Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign to {assignSubjectName}</Text>

            <Text style={styles.pickerLabel}>Teacher</Text>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {teachers.map((teacher) => (
                <TouchableOpacity
                  key={teacher.id}
                  style={[
                    styles.pickerItem,
                    selectedTeacherId === teacher.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => setSelectedTeacherId(teacher.id)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedTeacherId === teacher.id && styles.pickerItemTextSelected,
                    ]}
                  >
                    {teacher.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
              {teachers.length === 0 && (
                <Text style={styles.emptyPickerText}>No teachers found</Text>
              )}
            </ScrollView>

            <Text style={styles.pickerLabel}>Class</Text>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.pickerItem,
                    selectedClassId === cls.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => setSelectedClassId(cls.id)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedClassId === cls.id && styles.pickerItemTextSelected,
                    ]}
                  >
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {classes.length === 0 && (
                <Text style={styles.emptyPickerText}>No classes found</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleAssign}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  subjectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  subjectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  assignmentCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  assignBtn: {
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  assignmentsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTeacher: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  assignmentClass: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  noAssignmentsText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  expandChevron: {
    textAlign: 'center',
    color: COLORS.textTertiary,
    fontSize: 14,
    marginTop: 6,
  },
  expandChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  pickerScroll: {
    maxHeight: 160,
    marginBottom: 12,
  },
  pickerItem: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primaryBg,
    borderColor: COLORS.primary,
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.text,
  },
  pickerItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyPickerText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
