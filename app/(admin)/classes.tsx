import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    if (!profile?.school_id) return;
    try {
      const { data: classData, error } = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('school_id', profile.school_id)
        .order('grade_level', { ascending: true });

      if (error) throw error;

      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id');

      const enrollmentCounts: Record<string, number> = {};
      if (enrollments) {
        for (const e of enrollments) {
          enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] || 0) + 1;
        }
      }

      const teacherIds = [...new Set((classData || []).map((c) => c.teacher_id).filter(Boolean))];
      let teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teacherIds);
        if (profiles) {
          for (const p of profiles) {
            teacherMap[p.id] = p.full_name;
          }
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
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!profile?.school_id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', profile.school_id)
        .eq('role', 'teacher')
        .order('full_name');

      if (data) setTeachers(data);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

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
      fetchClasses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create class.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClass = (item: ClassItem) => {
    Alert.alert(
      'Delete Class',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('class_enrollments').delete().eq('class_id', item.id);
              const { error } = await supabase.from('classes').delete().eq('id', item.id);
              if (error) throw error;
              setClasses((prev) => prev.filter((c) => c.id !== item.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete class.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ClassItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/class/${item.id}` as any)}
      onLongPress={() => handleDeleteClass(item)}
    >
      <View style={styles.accent} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.className}>{item.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Grade {item.grade_level}</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.teacherName}>
            {'\u{1F3EB}'} {item.teacher_name}
          </Text>
          <Text style={styles.studentCount}>
            {'\u{1F464}'} {item.student_count} student{item.student_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.chevron}>{'\u{27A1}\uFE0F'}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Classes</Text>
      </View>

      {classes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 64 }}>{'\u{1F4DA}'}</Text>
          <Text style={styles.emptyTitle}>No Classes Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button to create your first class.
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Class</Text>

            <Text style={styles.inputLabel}>Class Name</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. "Grade 10-A"'
              placeholderTextColor={COLORS.textTertiary}
              value={newClassName}
              onChangeText={setNewClassName}
            />

            <Text style={styles.inputLabel}>Grade Level</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. "10"'
              placeholderTextColor={COLORS.textTertiary}
              value={newGradeLevel}
              onChangeText={setNewGradeLevel}
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>Assign Teacher</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (teachers.length === 0) {
                  Alert.alert('No teachers', 'No teachers found in this school.');
                  return;
                }
                Alert.alert(
                  'Select Teacher',
                  undefined,
                  [
                    { text: 'None', onPress: () => setSelectedTeacherId(null) },
                    ...teachers.map((t) => ({
                      text: t.full_name,
                      onPress: () => setSelectedTeacherId(t.id),
                    })),
                  ]
                );
              }}
            >
              <Text
                style={[
                  styles.pickerText,
                  !selectedTeacherId && { color: COLORS.textTertiary },
                ]}
              >
                {selectedTeacherId
                  ? teachers.find((t) => t.id === selectedTeacherId)?.full_name || 'Unknown'
                  : 'Tap to select a teacher'}
              </Text>
              <Text style={styles.pickerChevron}>{'\u{25BC}'}</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateClass}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Create Class</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  list: {
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  accent: {
    width: 4,
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  className: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  badge: {
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  teacherName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  studentCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chevron: {
    marginLeft: 8,
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  fabText: {
    fontSize: 28,
    color: COLORS.white,
    lineHeight: 30,
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
  inputLabel: {
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
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  pickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  pickerChevron: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
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
