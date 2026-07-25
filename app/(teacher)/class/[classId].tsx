import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useFocusEffect } from 'expo-router';

interface Student {
  id: string;
  full_name: string;
  email?: string;
}

interface SubjectAssignment {
  id: string;
  subject_name: string;
  subject_id: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [subjects, setSubjects] = useState<SubjectAssignment[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [classId])
  );

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const classRes = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('id', classId)
        .single();

      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === user.id);
      }

      const studentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(id, full_name, email)')
        .eq('class_id', classId);

      if (studentRes.data) {
        const mapped: Student[] = studentRes.data
          .map((e: any) => {
            const profile = e.profiles;
            if (!profile) return null;
            return {
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
            };
          })
          .filter(Boolean) as Student[];
        setStudents(mapped);
      }

      const subjectRes = await supabase
        .from('teacher_subjects')
        .select('id, subjects(name)')
        .eq('teacher_id', user.id)
        .eq('class_id', classId);

      if (subjectRes.data) {
        setSubjects(
          subjectRes.data.map((s: any) => ({
            id: s.id,
            subject_name: s.subjects?.name ?? '',
            subject_id: s.subject_id,
          }))
        );
      }

      // Fetch all available subjects for this school
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const profileRes = await supabase.from('profiles').select('school_id').eq('id', currentUser.id).single();
        if (profileRes.data?.school_id) {
          const allSubRes = await supabase.from('subjects').select('id, name').eq('school_id', profileRes.data.school_id);
          if (allSubRes.data) setAllSubjects(allSubRes.data as Subject[]);
        }
      }
    } catch (err) {
      console.error('Error fetching class data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) { Alert.alert('Error', 'Enter a subject name'); return; }
    if (!classId) return;

    setAddingSubject(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileRes = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
      const schoolId = profileRes.data?.school_id;
      if (!schoolId) return;

      // Check if subject already exists
      let subId: string | null = null;
      const existing = allSubjects.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        subId = existing.id;
      } else {
        // Create new subject
        const { data: newSub, error: subErr } = await supabase.from('subjects').insert({ name, school_id: schoolId }).select('id').single();
        if (subErr) { Alert.alert('Error', subErr.message); return; }
        subId = newSub?.id ?? null;
      }

      if (!subId) return;

      // Check if already assigned
      const alreadyAssigned = subjects.some(s => s.subject_id === subId);
      if (alreadyAssigned) { Alert.alert('Info', 'Subject already added to this class'); return; }

      // Link teacher to subject + class
      const { error: linkErr } = await supabase.from('teacher_subjects').insert({
        teacher_id: user.id,
        subject_id: subId,
        class_id: classId,
        school_id: schoolId,
      });
      if (linkErr) { Alert.alert('Error', linkErr.message); return; }

      setNewSubjectName('');
      setShowAddSubject(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to add subject');
    } finally {
      setAddingSubject(false);
    }
  };

  const handleRemoveSubject = (subjectAssignmentId: string) => {
    Alert.alert('Remove Subject', 'Remove this subject from the class?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('teacher_subjects').delete().eq('id', subjectAssignmentId);
        fetchData();
      }},
    ]);
  };

  const handleMarkAttendance = () => {
    router.push(`/(teacher)/attendance/${classId}` as any);
  };

  const handleViewGrades = () => {
    router.push(`/(teacher)/grades/${classId}` as any);
  };

  const handleSendMessage = () => {
    router.push({
      pathname: '/(teacher)/messages' as any,
      params: { classId },
    });
  };

  const renderStudent = ({ item, index }: { item: Student; index: number }) => (
    <View style={styles.studentRow}>
      <View style={[styles.studentAvatar, { backgroundColor: COLORS.primary + '18' }]}>
        <Text style={[styles.studentInitial, { color: COLORS.primary }]}>
          {item.full_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.full_name}</Text>
        {item.email ? <Text style={styles.studentEmail}>{item.email}</Text> : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!classInfo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Class not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={{ fontSize: 22, color: COLORS.text || '#1a1a2e' }}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerSection}>
              <Text style={styles.className}>{classInfo.name}</Text>
              <Text style={styles.gradeLevel}>Grade {classInfo.grade_level}</Text>
            </View>

            {!isClassTeacher && subjects.length > 0 && (
              <View style={styles.subjectBanner}>
                <Text style={{ fontSize: 18, color: COLORS.success }}>📖</Text>
                <Text style={styles.subjectBannerText}>
                  You teach: {subjects.map((s) => s.subject_name).join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.actionsGrid}>
              {isClassTeacher && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleMarkAttendance}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 22, color: '#fff' }}>✓</Text>
                  <Text style={styles.actionBtnText}>Mark Attendance</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.success || '#22c55e' }]}
                onPress={handleViewGrades}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22, color: '#fff' }}>📊</Text>
                <Text style={styles.actionBtnText}>View Grades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSendMessage}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22, color: '#fff' }}>💬</Text>
                <Text style={styles.actionBtnText}>Send Message</Text>
              </TouchableOpacity>
            </View>

            {/* Subjects Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Subjects</Text>
              <TouchableOpacity onPress={() => setShowAddSubject(!showAddSubject)}>
                <Text style={styles.addSubjectBtn}>{showAddSubject ? 'Cancel' : '+ Add'}</Text>
              </TouchableOpacity>
            </View>

            {showAddSubject && (
              <View style={styles.addSubjectCard}>
                <TextInput
                  style={styles.addSubjectInput}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                  placeholder="Subject name (e.g. Nepali)"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.addSubjectSaveBtn, addingSubject && { opacity: 0.6 }]}
                  onPress={handleAddSubject}
                  disabled={addingSubject}
                >
                  <Text style={styles.addSubjectSaveBtnText}>{addingSubject ? 'Adding...' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {subjects.length > 0 ? subjects.map(sub => (
              <View key={sub.id} style={styles.subjectRow}>
                <View style={[styles.subjectDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.subjectName}>{sub.subject_name}</Text>
                {isClassTeacher && (
                  <TouchableOpacity onPress={() => handleRemoveSubject(sub.id)}>
                    <Text style={styles.removeSubjectBtn}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            )) : (
              <Text style={styles.emptySubjectsText}>No subjects yet. Add one to start grading.</Text>
            )}

            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Text style={styles.sectionTitle}>Enrolled Students</Text>
              <Text style={styles.studentCount}>{students.length}</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, color: COLORS.textSecondary || '#bbb' }}>👥</Text>
            <Text style={styles.emptyText}>No students enrolled yet.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
  backBtn: {
    marginBottom: 12,
    padding: 4,
  },
  headerSection: {
    marginBottom: 20,
  },
  className: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text || '#1a1a2e',
  },
  gradeLevel: {
    fontSize: 15,
    color: COLORS.textSecondary || '#888',
    marginTop: 4,
  },
  subjectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '12',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  subjectBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.success || '#22c55e',
  },
  actionsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 12,
    ...SHADOWS.sm,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text || '#1a1a2e',
  },
  studentCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary || '#888',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  list: {
    paddingBottom: 20,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text || '#1a1a2e',
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.textSecondary || '#888',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary || '#888',
    marginTop: 12,
  },
  addSubjectBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  addSubjectCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    ...SHADOWS.sm,
  },
  addSubjectInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt || '#f5f5f5',
    borderWidth: 1,
    borderColor: COLORS.border || '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text || '#1a1a2e',
  },
  addSubjectSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addSubjectSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    ...SHADOWS.sm,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  subjectName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text || '#1a1a2e',
  },
  removeSubjectBtn: {
    fontSize: 22,
    color: COLORS.danger || '#ef4444',
    fontWeight: '400',
    paddingHorizontal: 8,
  },
  emptySubjectsText: {
    fontSize: 13,
    color: COLORS.textSecondary || '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary || '#888',
  },
});
