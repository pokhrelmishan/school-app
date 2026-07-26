import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Avatar,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  PrimaryButton,
} from '../../../lib/components';

interface ClassInfo { id: string; name: string; grade_level: string; teacher_id: string; }
interface Student { id: string; full_name: string; email: string; roll_number?: string; }
interface SavedGrade { id: string; student_id: string; subject_name: string; grade_letter: string | null; practical_grade: string | null; subject_gpa: number | null; overall_gpa: number | null; term: string; }
interface SubjectRow { key: string; name: string; theory: string; practical: string; gpa: string; }

let rowCounter = 0;
const newRow = (name = '', theory = '', practical = '', gpa = ''): SubjectRow => ({ key: `row_${Date.now()}_${rowCounter++}`, name, theory, practical, gpa });

export default function TeacherGradesEntryScreen() {
  const { classId, studentId } = useLocalSearchParams<{ classId: string; studentId?: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [term, setTerm] = useState('Term 1');
  const [rows, setRows] = useState<SubjectRow[]>([newRow(), newRow(), newRow()]);
  const [overallGpa, setOverallGpa] = useState('');
  const [savedGrades, setSavedGrades] = useState<SavedGrade[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [classId]);

  const fetchData = async () => {
    if (!classId || !user?.id) return;
    setLoading(true);
    try {
      const classRes = await supabase.from('classes').select('id, name, grade_level, teacher_id').eq('id', classId).single();
      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === user.id);
      }

      const enrollRes = await supabase.from('class_enrollments').select('student:profiles!class_enrollments_student_id_fkey(id, full_name, email, roll_number)').eq('class_id', classId);
      if (enrollRes.data) {
        const mappedStudents = enrollRes.data.map((e: any) => ({
          id: e.student?.id, full_name: e.student?.full_name ?? '', email: e.student?.email ?? '', roll_number: e.student?.roll_number ?? ''
        })).filter((s: Student) => s.id);
        setStudents(mappedStudents);

        if (studentId) {
          const target = mappedStudents.find((s: Student) => s.id === studentId);
          if (target) {
            setSelectedStudent(target);
            await loadStudentGrades(target.id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentGrades = async (sid: string) => {
    const { data } = await supabase
      .from('grade_entries')
      .select('id, student_id, subject_name, grade_letter, practical_grade, subject_gpa, overall_gpa, term')
      .eq('class_id', classId)
      .eq('student_id', sid);
    if (data) setSavedGrades(data as SavedGrade[]);
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setRows([newRow(), newRow(), newRow()]);
    setTerm('Term 1');
    setOverallGpa('');
    await loadStudentGrades(student.id);
  };

  const updateRow = (key: string, field: 'name' | 'theory' | 'practical' | 'gpa', value: string) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);
  const removeRow = (key: string) => { if (rows.length <= 1) return; setRows(prev => prev.filter(r => r.key !== key)); };

  const loadFromSaved = () => {
    if (savedGrades.length === 0) return;
    setTerm(savedGrades[0].term);
    setOverallGpa(savedGrades[0].overall_gpa?.toString() ?? '');
    const mapped: SubjectRow[] = savedGrades.map(g => ({
      key: `saved_${g.id}`,
      name: g.subject_name ?? '',
      theory: g.grade_letter ?? '',
      practical: g.practical_grade ?? '',
      gpa: g.subject_gpa?.toString() ?? '',
    }));
    setRows(mapped.length > 0 ? mapped : [newRow(), newRow(), newRow()]);
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    const graded = rows.filter(r => r.name.trim());
    if (graded.length === 0) { Alert.alert('Error', 'Enter at least one subject'); return; }

    setSaving(true);
    try {
      for (const row of graded) {
        const existing = savedGrades.find(
          g => g.subject_name?.toLowerCase() === row.name.trim().toLowerCase() && g.term === term
        );

        const payload = {
          class_id: classId,
          student_id: selectedStudent.id,
          subject_name: row.name.trim(),
          grade_letter: row.theory.trim() || null,
          practical_grade: row.practical.trim() || null,
          subject_gpa: parseFloat(row.gpa) || null,
          overall_gpa: parseFloat(overallGpa) || null,
          term,
          entered_by: user?.id,
          score: parseFloat(row.gpa) || 0,
          max_score: 4,
        };

        if (existing) {
          const { error } = await supabase.from('grade_entries').update({
            grade_letter: payload.grade_letter,
            practical_grade: payload.practical_grade,
            subject_gpa: payload.subject_gpa,
            overall_gpa: payload.overall_gpa,
            subject_name: payload.subject_name,
          }).eq('id', existing.id);
          if (error) { Alert.alert('Update Error', error.message); return; }
        } else {
          const { error } = await supabase.from('grade_entries').insert(payload);
          if (error) { Alert.alert('Insert Error', error.message); return; }
        }
      }

      Alert.alert('Success', `Saved grades for ${selectedStudent.full_name}`);
      await loadStudentGrades(selectedStudent.id);
    } catch (err) {
      Alert.alert('Error', `Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen text="Loading grades..." />;
  if (!classInfo) return <EmptyState icon="❌" title="Class not found" />;

  if (selectedStudent) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Grades" subtitle={`${classInfo.name} · ${selectedStudent.full_name}`} />
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => { setSelectedStudent(null); setRows([newRow(), newRow(), newRow()]); setSavedGrades([]); setOverallGpa(''); }} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to students</Text>
          </TouchableOpacity>

          <View style={styles.studentHeader}>
            <Avatar name={selectedStudent.full_name} size={44} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.studentName}>{selectedStudent.full_name}</Text>
              {selectedStudent.roll_number ? <Text style={styles.rollNo}>Roll #{selectedStudent.roll_number}</Text> : null}
            </View>
          </View>

          {isClassTeacher ? (
            <>
              <NotebookCard>
                <Text style={styles.formLabel}>Term</Text>
                <TextInput style={styles.input} value={term} onChangeText={setTerm} placeholder="e.g. Midterm, Term 1, Final" placeholderTextColor={COLORS.graphiteLight} />
              </NotebookCard>

              {savedGrades.length > 0 && (
                <TouchableOpacity style={styles.loadBtn} onPress={loadFromSaved}>
                  <Text style={styles.loadBtnText}>Load previous grades</Text>
                </TouchableOpacity>
              )}

              <NotebookCard>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Theory</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Practical</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>GPA</Text>
                  <View style={{ width: 32 }} />
                </View>

                {rows.map((row) => (
                  <View key={row.key} style={styles.tableRow}>
                    <TextInput style={[styles.tableCell, { flex: 2 }]} value={row.name} onChangeText={v => updateRow(row.key, 'name', v)} placeholder="e.g. Math" placeholderTextColor={COLORS.graphiteLight} />
                    <TextInput style={[styles.tableCell, { flex: 1.3 }]} value={row.theory} onChangeText={v => updateRow(row.key, 'theory', v)} placeholder="A+" placeholderTextColor={COLORS.graphiteLight} />
                    <TextInput style={[styles.tableCell, { flex: 1.3 }]} value={row.practical} onChangeText={v => updateRow(row.key, 'practical', v)} placeholder="A" placeholderTextColor={COLORS.graphiteLight} />
                    <TextInput style={[styles.tableCell, { flex: 1.2 }]} keyboardType="numeric" value={row.gpa} onChangeText={v => updateRow(row.key, 'gpa', v)} placeholder="4.0" placeholderTextColor={COLORS.graphiteLight} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeRow(row.key)}>
                      <Text style={styles.removeBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </NotebookCard>

              <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                <Text style={styles.addRowBtnText}>+ Add Subject</Text>
              </TouchableOpacity>

              <NotebookCard style={{ alignItems: 'center' }}>
                <Text style={styles.overallLabel}>Overall GPA</Text>
                <TextInput
                  style={styles.overallInput}
                  keyboardType="numeric"
                  value={overallGpa}
                  onChangeText={setOverallGpa}
                  placeholder="3.5"
                  placeholderTextColor={COLORS.graphiteLight}
                  maxLength={4}
                />
                <Text style={styles.overallSub}>/ 4.0</Text>
              </NotebookCard>

              <PrimaryButton title="Save Grades" onPress={handleSave} loading={saving} disabled={saving} />
            </>
          ) : (
            <NotebookCard accent={COLORS.pencil}>
              <Text style={styles.viewOnlyText}>View Only — Class Teacher only enters grades</Text>
            </NotebookCard>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Grades" subtitle={`${classInfo.name} · Grade ${classInfo.grade_level}`} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {!isClassTeacher && (
          <NotebookCard accent={COLORS.pencil}>
            <Text style={styles.viewOnlyText}>View Only</Text>
          </NotebookCard>
        )}

        <SectionHeader title="Select a student to grade" />

        {students.map(s => (
          <NotebookCard key={s.id} accent={COLORS.chalk} onPress={() => handleSelectStudent(s)}>
            <View style={styles.studentRow}>
              <Avatar name={s.full_name} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.studentName}>{s.full_name}</Text>
                {s.roll_number ? <Text style={styles.rollNo}>Roll #{s.roll_number}</Text> : null}
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
          </NotebookCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  backBtn: { marginBottom: 12, padding: 4 },
  backText: { fontSize: 16, color: COLORS.tape, fontWeight: '600' },
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  rollNo: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
  arrow: { fontSize: 22, color: COLORS.graphiteLight, fontWeight: '300' },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.paperDim,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  loadBtn: {
    backgroundColor: COLORS.paperDim,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  loadBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.tape },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line, minHeight: 48 },
  tableHeader: { backgroundColor: COLORS.paperDim, minHeight: 40 },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: COLORS.graphite, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 10, paddingVertical: 10 },
  tableCell: { fontSize: 14, color: COLORS.ink, paddingHorizontal: 10, paddingVertical: 10 },
  removeBtn: { width: 32, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
  removeBtnText: { fontSize: 20, color: COLORS.danger, fontWeight: '400' },
  addRowBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.tape,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 20,
  },
  addRowBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.tape },
  overallLabel: { fontSize: 13, fontWeight: '600', color: COLORS.graphite, textTransform: 'uppercase', letterSpacing: 1 },
  overallInput: { fontSize: 52, fontWeight: '800', color: COLORS.ink, marginTop: 8, textAlign: 'center', minWidth: 100 },
  overallSub: { fontSize: 15, color: COLORS.graphite, marginTop: 4 },
  viewOnlyText: { fontSize: 14, fontWeight: '600', color: COLORS.pencil },
});
