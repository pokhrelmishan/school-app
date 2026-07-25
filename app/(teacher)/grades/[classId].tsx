import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

interface ClassInfo { id: string; name: string; grade_level: string; teacher_id: string; }
interface Student { id: string; full_name: string; email: string; roll_number?: string; }
interface SavedGrade { id: string; student_id: string; title: string; subject_name: string; theory_score: number | null; practical_score: number | null; theory_max: number; practical_max: number; term: string; }
interface SubjectRow { key: string; name: string; theory: string; practical: string; }

let rowCounter = 0;
const newRow = (name = ''): SubjectRow => ({ key: `row_${Date.now()}_${rowCounter++}`, name, theory: '', practical: '' });

export default function TeacherGradesEntryScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [term, setTerm] = useState('Term 1');
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<SubjectRow[]>([newRow(), newRow(), newRow()]);
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
        setStudents(enrollRes.data.map((e: any) => ({
          id: e.student?.id, full_name: e.student?.full_name ?? '', email: e.student?.email ?? '', roll_number: e.student?.roll_number ?? ''
        })).filter((s: Student) => s.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentGrades = async (studentId: string) => {
    const { data } = await supabase
      .from('grade_entries')
      .select('id, student_id, title, subject_name, theory_score, practical_score, theory_max, practical_max, term')
      .eq('class_id', classId)
      .eq('student_id', studentId);
    if (data) setSavedGrades(data as SavedGrade[]);
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setRows([newRow(), newRow(), newRow()]);
    setTerm('Term 1');
    setTitle('');
    await loadStudentGrades(student.id);
  };

  const updateRow = (key: string, field: 'name' | 'theory' | 'practical', value: string) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const removeRow = (key: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.key !== key));
  };

  const getRowTotal = (row: SubjectRow) => {
    const t = parseFloat(row.theory) || 0;
    const p = parseFloat(row.practical) || 0;
    return t + p;
  };

  const getRowGpa = (row: SubjectRow) => getRowTotal(row) / 10;

  const getOverallGpa = () => {
    const graded = rows.filter(r => r.name.trim() && (parseFloat(r.theory) > 0 || parseFloat(r.practical) > 0));
    if (graded.length === 0) return 0;
    const sum = graded.reduce((acc, r) => acc + getRowTotal(r), 0);
    return sum / graded.length / 10;
  };

  const gpaColor = (g: number) => g >= 7 ? COLORS.success : g >= 5 ? COLORS.warning : COLORS.danger;
  const gpaBg = (g: number) => g >= 7 ? COLORS.successBg : g >= 5 ? COLORS.warningBg : COLORS.dangerBg;

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Enter a grade title (e.g. Midterm)'); return; }
    if (!selectedStudent) return;

    const graded = rows.filter(r => r.name.trim() && (parseFloat(r.theory) > 0 || parseFloat(r.practical) > 0));
    if (graded.length === 0) { Alert.alert('Error', 'Enter at least one subject with a score'); return; }

    setSaving(true);
    try {
      for (const row of graded) {
        const theory = parseFloat(row.theory) || 0;
        const practical = parseFloat(row.practical) || 0;

        const existing = savedGrades.find(
          g => g.subject_name?.toLowerCase() === row.name.trim().toLowerCase() && g.term === term && g.title === title.trim()
        );

        const payload = {
          class_id: classId,
          student_id: selectedStudent.id,
          subject_name: row.name.trim(),
          title: title.trim(),
          theory_score: theory,
          practical_score: practical,
          theory_max: 75,
          practical_max: 25,
          score: theory + practical,
          max_score: 100,
          term,
          entered_by: user?.id,
        };

        if (existing) {
          await supabase.from('grade_entries').update({ theory_score: theory, practical_score: practical, score: theory + practical, subject_name: row.name.trim() }).eq('id', existing.id);
        } else {
          await supabase.from('grade_entries').insert(payload);
        }
      }

      Alert.alert('Success', `Saved grades for ${selectedStudent.full_name}`);
      await loadStudentGrades(selectedStudent.id);
    } catch (err) {
      Alert.alert('Error', 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const loadFromSaved = () => {
    if (savedGrades.length === 0) return;
    const lastTitle = savedGrades[0].title;
    const lastTerm = savedGrades[0].term;
    setTitle(lastTitle);
    setTerm(lastTerm);
    const mapped: SubjectRow[] = savedGrades.map(g => ({
      key: `saved_${g.id}`,
      name: g.subject_name ?? '',
      theory: g.theory_score?.toString() ?? '',
      practical: g.practical_score?.toString() ?? '',
    }));
    setRows(mapped.length > 0 ? mapped : [newRow(), newRow(), newRow()]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!classInfo) return <View style={styles.center}><Text>Class not found</Text></View>;

  // STEP 2: Selected student — editable table
  if (selectedStudent) {
    const overallGpa = getOverallGpa();

    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => { setSelectedStudent(null); setRows([newRow(), newRow(), newRow()]); setSavedGrades([]); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Back to students</Text>
        </TouchableOpacity>

        <View style={styles.studentHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{selectedStudent.full_name[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{selectedStudent.full_name}</Text>
            {selectedStudent.roll_number ? <Text style={styles.rollNo}>Roll #{selectedStudent.roll_number}</Text> : null}
          </View>
        </View>

        {isClassTeacher ? (
          <>
            {/* Term + Title */}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Term</Text>
                <TextInput style={styles.input} value={term} onChangeText={setTerm} placeholder="Term 1" />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Midterm" />
              </View>
            </View>

            {savedGrades.length > 0 && (
              <TouchableOpacity style={styles.loadBtn} onPress={loadFromSaved}>
                <Text style={styles.loadBtnText}>Load previous grades for this term</Text>
              </TouchableOpacity>
            )}

            {/* Table */}
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Theory /75</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Practical /25</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Total</Text>
                <View style={{ width: 28 }} />
              </View>

              {rows.map((row) => {
                const total = getRowTotal(row);
                const gpa = getRowGpa(row);
                return (
                  <View key={row.key} style={styles.tableRow}>
                    <TextInput style={[styles.tableCell, { flex: 2 }]} value={row.name} onChangeText={v => updateRow(row.key, 'name', v)} placeholder="e.g. Math" placeholderTextColor={COLORS.textTertiary} />
                    <TextInput style={[styles.tableCell, { flex: 1.2 }]} keyboardType="numeric" value={row.theory} onChangeText={v => updateRow(row.key, 'theory', v)} placeholder="0" placeholderTextColor={COLORS.textTertiary} />
                    <TextInput style={[styles.tableCell, { flex: 1.2 }]} keyboardType="numeric" value={row.practical} onChangeText={v => updateRow(row.key, 'practical', v)} placeholder="0" placeholderTextColor={COLORS.textTertiary} />
                    <View style={[styles.tableCell, { flex: 0.8, justifyContent: 'center' }]}>
                      <Text style={[styles.totalText, total > 0 && { color: gpaColor(gpa) }]}>{total}</Text>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeRow(row.key)}>
                      <Text style={styles.removeBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
              <Text style={styles.addRowBtnText}>+ Add Subject</Text>
            </TouchableOpacity>

            {/* Overall GPA */}
            <View style={styles.gpaCard}>
              <Text style={styles.gpaLabel}>Overall GPA</Text>
              <Text style={[styles.gpaValue, { color: gpaColor(overallGpa) }]}>{overallGpa.toFixed(1)}</Text>
              <Text style={styles.gpaSub}>/ 10</Text>
              <View style={styles.gpaBar}>
                <View style={[styles.gpaBarFill, { width: `${Math.min(overallGpa * 10, 100)}%`, backgroundColor: gpaColor(overallGpa) }]} />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Grades'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.badge, { backgroundColor: COLORS.warningBg }]}>
            <Text style={[styles.badgeText, { color: COLORS.warning }]}>View Only — Class Teacher only enters grades</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // STEP 1: Student list
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>

      <Text style={styles.className}>{classInfo.name}</Text>
      <Text style={styles.gradeLevel}>Grade {classInfo.grade_level}</Text>

      {!isClassTeacher && (
        <View style={[styles.badge, { backgroundColor: COLORS.warningBg, marginBottom: 16 }]}>
          <Text style={[styles.badgeText, { color: COLORS.warning }]}>View Only</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Select a student to grade</Text>

      {students.map(s => (
        <TouchableOpacity key={s.id} style={styles.studentCard} onPress={() => handleSelectStudent(s)}>
          <View style={styles.studentRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{s.full_name[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{s.full_name}</Text>
              {s.roll_number ? <Text style={styles.rollNo}>Roll #{s.roll_number}</Text> : null}
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  backBtn: { marginBottom: 12, padding: 4 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  className: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  gradeLevel: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '600' },

  // Student list
  studentCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rollNo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 22, color: COLORS.textSecondary, fontWeight: '300' },

  // Student detail
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  formHalf: { flex: 1 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text },

  loadBtn: { backgroundColor: COLORS.surfaceAlt, padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  loadBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  // Table
  table: { backgroundColor: COLORS.surface, borderRadius: 14, overflow: 'hidden', marginBottom: 10, ...SHADOWS.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 48 },
  tableHeader: { backgroundColor: COLORS.surfaceAlt, minHeight: 40 },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 10, paddingVertical: 10 },
  tableCell: { fontSize: 14, color: COLORS.text, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 0 },
  totalText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  removeBtn: { width: 28, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
  removeBtnText: { fontSize: 20, color: COLORS.danger, fontWeight: '400' },

  addRowBtn: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', marginBottom: 16 },
  addRowBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  // GPA
  gpaCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, marginBottom: 12, alignItems: 'center', ...SHADOWS.md },
  gpaLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  gpaValue: { fontSize: 52, fontWeight: '800', marginTop: 4 },
  gpaSub: { fontSize: 15, color: COLORS.textSecondary, marginTop: 2 },
  gpaBar: { width: '100%', height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, marginTop: 16 },
  gpaBarFill: { height: 6, borderRadius: 3 },

  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: COLORS.textInverse, fontSize: 16, fontWeight: '700' },
});
