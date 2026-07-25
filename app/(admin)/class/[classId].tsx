import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  teacher_name: string;
}

interface EnrolledStudent {
  id: string;
  full_name: string;
  email: string;
  roll_number: string;
}

interface UnenrolledStudent {
  id: string;
  full_name: string;
  email: string;
}

interface Teacher {
  id: string;
  full_name: string;
}

export default function AdminClassDetailScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { profile } = useAuth();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [allStudents, setAllStudents] = useState<UnenrolledStudent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (classId) fetchData();
  }, [classId]);

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);

    try {
      const classRes = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('id', classId)
        .single();

      if (classRes.data) {
        let teacherName = 'Unassigned';
        if (classRes.data.teacher_id) {
          const teacherRes = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', classRes.data.teacher_id)
            .single();
          if (teacherRes.data) teacherName = teacherRes.data.full_name;
        }
        setClassInfo({
          ...classRes.data,
          teacher_name: teacherName,
        });
      }

      await fetchEnrolledStudents();
      await fetchTeachers();
    } catch (err) {
      console.error('Error fetching class data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrolledStudents = async () => {
    if (!classId) return;

    const enrollmentRes = await supabase
      .from('class_enrollments')
      .select('student_id, profiles(id, full_name, email, roll_number)')
      .eq('class_id', classId);

    if (enrollmentRes.data) {
      const mapped: EnrolledStudent[] = enrollmentRes.data
        .map((e: any) => {
          const profile = e.profiles;
          if (!profile) return null;
          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            roll_number: profile.roll_number,
          };
        })
        .filter(Boolean) as EnrolledStudent[];
      setStudents(mapped);

      const enrolledIds = mapped.map((s) => s.id);

      if (profile?.school_id) {
        const studentsRes = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('school_id', profile.school_id)
          .eq('role', 'student');

        if (studentsRes.data) {
          const unenrolled = studentsRes.data.filter(
            (s) => !enrolledIds.includes(s.id)
          );
          setAllStudents(unenrolled);
        }
      }
    }
  };

  const fetchTeachers = async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('school_id', profile.school_id)
      .eq('role', 'teacher')
      .order('full_name');

    if (data) setTeachers(data);
  };

  const handleRemoveStudent = (student: EnrolledStudent) => {
    Alert.alert(
      'Remove Student',
      `Remove "${student.full_name}" from this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('class_enrollments')
                .delete()
                .eq('class_id', classId)
                .eq('student_id', student.id);
              if (error) throw error;
              setStudents((prev) => prev.filter((s) => s.id !== student.id));
              setAllStudents((prev) => [
                ...prev,
                { id: student.id, full_name: student.full_name, email: student.email },
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove student.');
            }
          },
        },
      ]
    );
  };

  const handleAddStudent = async (student: UnenrolledStudent) => {
    try {
      const { error } = await supabase.from('class_enrollments').insert({
        class_id: classId,
        student_id: student.id,
      });
      if (error) throw error;
      setAllStudents((prev) => prev.filter((s) => s.id !== student.id));
      setStudents((prev) => [
        ...prev,
        { id: student.id, full_name: student.full_name, email: student.email, roll_number: '' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add student.');
    }
  };

  const handleChangeTeacher = () => {
    if (teachers.length === 0) {
      Alert.alert('No teachers', 'No teachers available in this school.');
      return;
    }
    Alert.alert(
      'Change Teacher',
      'Select a new teacher for this class:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unassign', onPress: () => updateTeacher(null) },
        ...teachers.map((t) => ({
          text: t.full_name,
          onPress: () => updateTeacher(t.id),
        })),
      ]
    );
  };

  const updateTeacher = async (teacherId: string | null) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ teacher_id: teacherId })
        .eq('id', classId);
      if (error) throw error;

      const teacherName = teacherId
        ? teachers.find((t) => t.id === teacherId)?.full_name || 'Unknown'
        : 'Unassigned';
      setClassInfo((prev) =>
        prev ? { ...prev, teacher_id: teacherId || '', teacher_name: teacherName } : prev
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update teacher.');
    }
  };

  const filteredStudents = allStudents.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: COLORS.text }}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.className}>{classInfo.name}</Text>
          <Text style={styles.gradeLevel}>Grade {classInfo.grade_level}</Text>

          <TouchableOpacity style={styles.teacherRow} onPress={handleChangeTeacher}>
            <View style={styles.teacherInfo}>
              <Text style={styles.teacherLabel}>Assigned Teacher</Text>
              <Text style={styles.teacherName}>{classInfo.teacher_name}</Text>
            </View>
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Enrolled Students</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{students.length}</Text>
          </View>
        </View>

        {students.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={{ fontSize: 36 }}>{'\u{1F465}'}</Text>
            <Text style={styles.emptyInlineText}>No students enrolled yet.</Text>
          </View>
        ) : (
          students.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {student.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
                {student.roll_number ? (
                  <Text style={styles.studentRoll}>Roll: {student.roll_number}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemoveStudent(student)}
              >
                <Text style={styles.removeBtnText}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Add Students</Text>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search students by name or email..."
          placeholderTextColor={COLORS.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {filteredStudents.length === 0 ? (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>
              {searchQuery ? 'No matching students found.' : 'All students are already enrolled.'}
            </Text>
          </View>
        ) : (
          filteredStudents.map((student) => (
            <View key={student.id} style={styles.addCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {student.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => handleAddStudent(student)}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    marginBottom: 24,
  },
  className: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  gradeLevel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  teacherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    ...SHADOWS.sm,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  changeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
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
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  studentCard: {
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
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  studentRoll: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  emptyInline: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyInlineText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
