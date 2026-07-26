import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { useFocusEffect } from 'expo-router';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  Avatar,
  SectionHeader,
  EmptyState,
  PrimaryButton,
  InfoRow,
  LoadingScreen,
} from '../../../lib/components';

interface Student {
  id: string;
  full_name: string;
  email?: string;
  roll_number?: string;
  grade_level?: string;
  house?: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  created_at: string;
  created_by: string;
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
  const { user } = useAuth();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDay, setFormDay] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [posting, setPosting] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchData(); }, [classId])
  );

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const classRes = await supabase.from('classes').select('id, name, grade_level, teacher_id').eq('id', classId).single();
      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === authUser.id);
      }

      const studentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(id, full_name, email, roll_number, grade_level, house)')
        .eq('class_id', classId);
      if (studentRes.data) {
        setStudents(studentRes.data.map((e: any) => {
          const p = e.profiles;
          if (!p) return null;
          return { id: p.id, full_name: p.full_name, email: p.email, roll_number: p.roll_number, grade_level: p.grade_level, house: p.house };
        }).filter(Boolean) as Student[]);
      }

      const assignRes = await supabase
        .from('assignments')
        .select('id, title, description, due_date, created_at, created_by')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });
      if (assignRes.data) setAssignments(assignRes.data as Assignment[]);
    } catch (err) {
      console.error('Error fetching class data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [classId]);

  const handlePost = async () => {
    if (!formTitle.trim()) return Alert.alert('Error', 'Title is required');
    const dueDate = formDay && formMonth && formYear
      ? `${formYear}-${formMonth.padStart(2, '0')}-${formDay.padStart(2, '0')}` : null;

    setPosting(true);
    const { error } = await supabase.from('assignments').insert({
      title: formTitle.trim(),
      description: formDesc.trim(),
      class_id: classId,
      created_by: user?.id,
      due_date: dueDate,
      school_id: (await supabase.from('classes').select('school_id').eq('id', classId).single()).data?.school_id,
    });

    if (error) { Alert.alert('Error', error.message); setPosting(false); return; }

    setShowForm(false);
    setFormTitle(''); setFormDesc(''); setFormDay(''); setFormMonth(''); setFormYear('');
    await fetchData();
    setPosting(false);
  };

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: COLORS.danger };
    if (diff === 0) return { text: 'Due today', color: COLORS.danger };
    if (diff <= 3) return { text: `${diff}d left`, color: COLORS.pencil };
    return { text: `${diff}d left`, color: COLORS.chalk };
  };

  if (loading) return <LoadingScreen text="Loading class..." />;
  if (!classInfo) return <EmptyState icon="❌" title="Class not found" />;

  return (
    <View style={styles.root}>
      <ScreenHeader title={classInfo.name} subtitle={`Grade ${classInfo.grade_level} · ${students.length} students`} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        <SectionHeader title="Students" />

        {students.length === 0 ? (
          <EmptyState icon="👥" title="No students enrolled yet" />
        ) : (
          students.map((item) => (
            <NotebookCard key={item.id}>
              <View style={styles.studentTop}>
                <Avatar name={item.full_name} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.studentName}>{item.full_name}</Text>
                  {item.roll_number ? <Text style={styles.studentDetail}>Roll #{item.roll_number}</Text> : null}
                  {item.house ? (
                    <Badge text={item.house} color={COLORS.pencil} />
                  ) : null}
                </View>
              </View>
              {isClassTeacher && (
                <View style={styles.studentActions}>
                  <PrimaryButton
                    title="Give Grades"
                    variant="outline"
                    onPress={() => router.push(`/(teacher)/grades/${classId}?studentId=${item.id}` as any)}
                  />
                  <PrimaryButton
                    title="View Attendance"
                    variant="outline"
                    onPress={() => router.push(`/(teacher)/attendance/${classId}` as any)}
                  />
                </View>
              )}
            </NotebookCard>
          ))
        )}

        <SectionHeader
          title="Assignments"
          action={isClassTeacher ? { label: showForm ? 'Cancel' : '+ New', onPress: () => setShowForm(!showForm) } : undefined}
        />

        {showForm && (
          <NotebookCard accent={COLORS.pencil}>
            <Text style={styles.formLabel}>Title</Text>
            <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Assignment title" placeholderTextColor={COLORS.graphiteLight} />
            <Text style={styles.formLabel}>Description</Text>
            <TextInput style={[styles.input, styles.multiline]} value={formDesc} onChangeText={setFormDesc} placeholder="Optional description" placeholderTextColor={COLORS.graphiteLight} multiline numberOfLines={3} textAlignVertical="top" />
            <Text style={styles.formLabel}>Due Date</Text>
            <View style={styles.dateRow}>
              <TextInput style={[styles.input, styles.dateInput]} value={formDay} onChangeText={setFormDay} placeholder="DD" placeholderTextColor={COLORS.graphiteLight} keyboardType="number-pad" maxLength={2} />
              <TextInput style={[styles.input, styles.dateInput]} value={formMonth} onChangeText={setFormMonth} placeholder="MM" placeholderTextColor={COLORS.graphiteLight} keyboardType="number-pad" maxLength={2} />
              <TextInput style={[styles.input, { flex: 1.5 }]} value={formYear} onChangeText={setFormYear} placeholder="YYYY" placeholderTextColor={COLORS.graphiteLight} keyboardType="number-pad" maxLength={4} />
            </View>
            <PrimaryButton title="Post Assignment" onPress={handlePost} loading={posting} disabled={posting} />
          </NotebookCard>
        )}

        {assignments.length > 0 ? (
          assignments.map(item => {
            const badge = getDueDateBadge(item.due_date);
            return (
              <NotebookCard key={item.id} accent={COLORS.tape}>
                <View style={styles.assignTop}>
                  <Text style={styles.assignTitle}>{item.title}</Text>
                  {badge && <Badge text={badge.text} color={badge.color} />}
                </View>
                {item.description ? <Text style={styles.assignDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.assignMeta}>
                  <Text style={styles.metaText}>Posted {new Date(item.created_at).toLocaleDateString()}</Text>
                  {item.due_date && <Text style={styles.metaText}>Due {new Date(item.due_date).toLocaleDateString()}</Text>}
                </View>
              </NotebookCard>
            );
          })
        ) : !showForm ? (
          <EmptyState icon="📝" title="No assignments yet" subtitle="Create an assignment for this class." />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  studentTop: { flexDirection: 'row', alignItems: 'center' },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  studentDetail: { fontSize: 13, color: COLORS.graphite, marginTop: 1 },
  studentActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  multiline: { minHeight: 80, paddingTop: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1 },
  assignTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  assignTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, flex: 1 },
  assignDesc: { fontSize: 14, color: COLORS.graphite, lineHeight: 20, marginTop: 8 },
  assignMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 12, color: COLORS.graphiteLight },
});
