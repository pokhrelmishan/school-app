import React, { useEffect, useState, useCallback } from 'react';
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
} from '../../lib/components';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  teacher_name: string;
  student_count: number;
}

interface Teacher {
  id: string;
  full_name: string;
}

export default function AdminClassesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!profile?.school_id) return;

    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, grade_level, teacher_id')
      .eq('school_id', profile.school_id)
      .order('grade_level', { ascending: true });

    const { data: enrollments } = await supabase.from('class_enrollments').select('class_id');

    const enrollmentCounts: Record<string, number> = {};
    if (enrollments) {
      for (const e of enrollments) {
        enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] || 0) + 1;
      }
    }

    const teacherIds = [...new Set((classData || []).map((c) => c.teacher_id).filter(Boolean))];
    let teacherMap: Record<string, string> = {};
    if (teacherIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
      if (profiles) {
        for (const p of profiles) teacherMap[p.id] = p.full_name;
      }
    }

    const mapped: ClassItem[] = (classData || []).map((c) => ({
      id: c.id,
      name: c.name,
      grade_level: c.grade_level,
      teacher_id: c.teacher_id,
      teacher_name: teacherMap[c.teacher_id] || 'Unassigned',
      student_count: enrollmentCounts[c.id] || 0,
    }));

    setClasses(mapped);
  }, [profile?.school_id]);

  const fetchTeachers = useCallback(async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('school_id', profile.school_id)
      .eq('role', 'teacher')
      .order('full_name');
    if (data) setTeachers(data);
  }, [profile?.school_id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchClasses(), fetchTeachers()]);
      setLoading(false);
    })();
  }, [fetchClasses, fetchTeachers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchClasses(), fetchTeachers()]);
    setRefreshing(false);
  }, [fetchClasses, fetchTeachers]);

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newGradeLevel.trim()) {
      Alert.alert('Missing fields', 'Please enter class name and grade level.');
      return;
    }
    if (!profile?.school_id) return;

    setCreating(true);
    try {
      const { error } = await supabase.from('classes').insert({
        name: newClassName.trim(),
        grade_level: newGradeLevel.trim(),
        teacher_id: selectedTeacherId || null,
        school_id: profile.school_id,
      });
      if (error) throw error;
      setModalVisible(false);
      setNewClassName('');
      setNewGradeLevel('');
      setSelectedTeacherId(null);
      await fetchClasses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create class.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClass = (item: ClassItem) => {
    Alert.alert('Delete Class', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('class_enrollments').delete().eq('class_id', item.id);
          const { error } = await supabase.from('classes').delete().eq('id', item.id);
          if (!error) setClasses((prev) => prev.filter((c) => c.id !== item.id));
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen text="Loading classes..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Classes" subtitle={`${classes.length} total`} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        {classes.length === 0 ? (
          <EmptyState
            icon={'\u{1F4DA}'}
            title="No Classes Yet"
            subtitle="Tap the + button to create your first class."
          />
        ) : (
          classes.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/(admin)/class/${item.id}` as any)}
              onLongPress={() => handleDeleteClass(item)}
            >
              <NotebookCard accent={COLORS.chalk}>
                <View style={styles.cardHeader}>
                  <Text style={styles.className}>{item.name}</Text>
                  <Badge text={`Grade ${item.grade_level}`} color={COLORS.pencil} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.teacherName}>{'\u{1F3EB}'} {item.teacher_name}</Text>
                  <Text style={styles.studentCount}>{'\u{1F464}'} {item.student_count}</Text>
                </View>
              </NotebookCard>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Class</Text>

            <Text style={styles.inputLabel}>Class Name</Text>
            <TextInput style={styles.input} placeholder='e.g. "Grade 10-A"' placeholderTextColor={COLORS.graphiteLight} value={newClassName} onChangeText={setNewClassName} />

            <Text style={styles.inputLabel}>Grade Level</Text>
            <TextInput style={styles.input} placeholder='e.g. "10"' placeholderTextColor={COLORS.graphiteLight} value={newGradeLevel} onChangeText={setNewGradeLevel} keyboardType="number-pad" />

            <Text style={styles.inputLabel}>Assign Teacher</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (teachers.length === 0) {
                  Alert.alert('No teachers', 'No teachers found in this school.');
                  return;
                }
                Alert.alert('Select Teacher', undefined, [
                  { text: 'None', onPress: () => setSelectedTeacherId(null) },
                  ...teachers.map((t) => ({
                    text: t.full_name,
                    onPress: () => setSelectedTeacherId(t.id),
                  })),
                ]);
              }}
            >
              <Text style={[styles.pickerText, !selectedTeacherId && { color: COLORS.graphiteLight }]}>
                {selectedTeacherId ? teachers.find((t) => t.id === selectedTeacherId)?.full_name || 'Unknown' : 'Tap to select a teacher'}
              </Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Create Class" onPress={handleCreateClass} disabled={creating} loading={creating} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  className: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  teacherName: { fontSize: 12, color: COLORS.graphite },
  studentCount: { fontSize: 12, color: COLORS.graphite },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cover,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: COLORS.paper, lineHeight: 30 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: COLORS.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.graphite, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.ink,
    marginBottom: 12,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  pickerText: { fontSize: 15, color: COLORS.ink },
  pickerChevron: { fontSize: 12, color: COLORS.graphiteLight },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.graphite },
});
