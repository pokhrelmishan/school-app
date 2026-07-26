import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Avatar,
  Badge,
  SectionHeader,
  EmptyState,
  LoadingScreen,
  PrimaryButton,
  Divider,
} from '../../../lib/components';

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
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!classId) return;

    const classRes = await supabase.from('classes').select('id, name, grade_level, teacher_id').eq('id', classId).single();

    if (classRes.data) {
      let teacherName = 'Unassigned';
      if (classRes.data.teacher_id) {
        const teacherRes = await supabase.from('profiles').select('full_name').eq('id', classRes.data.teacher_id).single();
        if (teacherRes.data) teacherName = teacherRes.data.full_name;
      }
      setClassInfo({ ...classRes.data, teacher_name: teacherName });
    }

    const enrollmentRes = await supabase
      .from('class_enrollments')
      .select('student_id, profiles(id, full_name, email, roll_number)')
      .eq('class_id', classId);

    if (enrollmentRes.data) {
      const mapped: EnrolledStudent[] = enrollmentRes.data
        .map((e: any) => {
          const p = e.profiles;
          if (!p) return null;
          return { id: p.id, full_name: p.full_name, email: p.email, roll_number: p.roll_number };
        })
        .filter(Boolean) as EnrolledStudent[];
      setStudents(mapped);

      const enrolledIds = mapped.map((s) => s.id);
      if (profile?.school_id) {
        const studentsRes = await supabase.from('profiles').select('id, full_name, email').eq('school_id', profile.school_id).eq('role', 'student');
        if (studentsRes.data) {
          setAllStudents(studentsRes.data.filter((s) => !enrolledIds.includes(s.id)));
        }
      }
    }

    if (profile?.school_id) {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('school_id', profile.school_id).eq('role', 'teacher').order('full_name');
      if (data) setTeachers(data);
    }
  }, [classId, profile?.school_id]);

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

  const handleRemoveStudent = (student: EnrolledStudent) => {
    Alert.alert('Remove Student', `Remove "${student.full_name}" from this class?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('class_enrollments').delete().eq('class_id', classId).eq('student_id', student.id);
          if (!error) {
            setStudents((prev) => prev.filter((s) => s.id !== student.id));
            setAllStudents((prev) => [...prev, { id: student.id, full_name: student.full_name, email: student.email }]);
          }
        },
      },
    ]);
  };

  const handleAddStudent = async (student: UnenrolledStudent) => {
    const { error } = await supabase.from('class_enrollments').insert({ class_id: classId, student_id: student.id });
    if (!error) {
      setAllStudents((prev) => prev.filter((s) => s.id !== student.id));
      setStudents((prev) => [...prev, { id: student.id, full_name: student.full_name, email: student.email, roll_number: '' }]);
    }
  };

  const handleChangeTeacher = () => {
    if (teachers.length === 0) {
      Alert.alert('No teachers', 'No teachers available.');
      return;
    }
    Alert.alert('Change Teacher', 'Select a new teacher:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unassign', onPress: () => updateTeacher(null) },
      ...teachers.map((t) => ({ text: t.full_name, onPress: () => updateTeacher(t.id) })),
    ]);
  };

  const updateTeacher = async (teacherId: string | null) => {
    const { error } = await supabase.from('classes').update({ teacher_id: teacherId }).eq('id', classId);
    if (!error) {
      const teacherName = teacherId ? teachers.find((t) => t.id === teacherId)?.full_name || 'Unknown' : 'Unassigned';
      setClassInfo((prev) => prev ? { ...prev, teacher_id: teacherId || '', teacher_name: teacherName } : prev);
    }
  };

  const filteredStudents = allStudents.filter(
    (s) => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingScreen text="Loading class..." />;
  if (!classInfo) return <LoadingScreen text="Class not found." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title={classInfo.name} subtitle={`Grade ${classInfo.grade_level}`} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        <NotebookCard accent={COLORS.chalk}>
          <TouchableOpacity onPress={handleChangeTeacher} activeOpacity={0.7}>
            <View style={styles.teacherRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.teacherLabel}>Assigned Teacher</Text>
                <Text style={styles.teacherName}>{classInfo.teacher_name}</Text>
              </View>
              <PrimaryButton title="Change" variant="outline" onPress={handleChangeTeacher} />
            </View>
          </TouchableOpacity>
        </NotebookCard>

        <SectionHeader title="Enrolled Students" />
        {students.length === 0 ? (
          <EmptyState icon={'\u{1F465}'} title="No students enrolled" subtitle="Add students below" />
        ) : (
          students.map((student) => (
            <NotebookCard key={student.id}>
              <View style={styles.studentRow}>
                <Avatar name={student.full_name} size={38} />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.full_name}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                  {student.roll_number ? <Badge text={`Roll ${student.roll_number}`} color={COLORS.pencil} /> : null}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveStudent(student)}>
                  <Text style={styles.removeBtnText}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>
            </NotebookCard>
          ))
        )}

        <SectionHeader title="Add Students" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students by name or email..."
          placeholderTextColor={COLORS.graphiteLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {filteredStudents.length === 0 ? (
          <EmptyState icon={'\u{1F50D}'} title={searchQuery ? 'No matching students' : 'All students enrolled'} />
        ) : (
          filteredStudents.map((student) => (
            <NotebookCard key={student.id}>
              <View style={styles.studentRow}>
                <Avatar name={student.full_name} size={38} />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.full_name}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                </View>
                <PrimaryButton title="Add" onPress={() => handleAddStudent(student)} />
              </View>
            </NotebookCard>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  teacherRow: { flexDirection: 'row', alignItems: 'center' },
  teacherLabel: { fontSize: 11, color: COLORS.graphite, marginBottom: 2 },
  teacherName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },

  studentRow: { flexDirection: 'row', alignItems: 'center' },
  studentInfo: { flex: 1, marginLeft: 10 },
  studentName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  studentEmail: { fontSize: 11, color: COLORS.graphite, marginTop: 1 },

  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },

  searchInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 12,
  },
});
