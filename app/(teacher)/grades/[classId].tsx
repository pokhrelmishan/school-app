import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

interface ClassInfo { id: string; name: string; grade_level: string; teacher_id: string; }
interface Subject { id: string; name: string; }
interface Student { id: string; full_name: string; email: string; roll_number?: string; }
interface GradeEntry { id: string; student_id: string; subject_id: string; title: string; theory_score: number | null; practical_score: number | null; theory_max: number; practical_max: number; term: string; }

export default function TeacherGradesEntryScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allGrades, setAllGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1: list of students | Step 2: selected student's subjects
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [term, setTerm] = useState('Term 1');
  const [title, setTitle] = useState('');
  const [scores, setScores] = useState<Record<string, { theory: string; practical: string }>>({});
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

      const subRes = await supabase.from('teacher_subjects').select('subject_id, subjects(id, name)').eq('class_id', classId);
      if (subRes.data) {
        const allSubjects: Subject[] = subRes.data.map((s: any) => ({ id: s.subjects?.id ?? s.subject_id, name: s.subjects?.name ?? '' })).filter((s: Subject) => s.id && s.name);
        setSubjects(Array.from(new Map(allSubjects.map(s => [s.id, s])).values()));
      }

      const enrollRes = await supabase.from('class_enrollments').select('student:profiles!class_enrollments_student_id_fkey(id, full_name, email, roll_number)').eq('class_id', classId);
      if (enrollRes.data) {
        setStudents(enrollRes.data.map((e: any) => ({
          id: e.student?.id, full_name: e.student?.full_name ?? '', email: e.student?.email ?? '', roll_number: e.student?.roll_number ?? ''
        })).filter((s: Student) => s.id));
      }

      const gradesRes = await supabase.from('grade_entries').select('id, student_id, subject_id, title, theory_score, practical_score, theory_max, practical_max, term').eq('class_id', classId);
      if (gradesRes.data) setAllGrades(gradesRes.data as GradeEntry[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStudentGrades = (studentId: string) => {
    return allGrades.filter(g => g.student_id === studentId && g.term === term && g.title === title);
  };

  const handleScoreChange = (subjectId: string, field: 'theory' | 'practical', value: string) => {
    setScores(prev => {
      const key = subjectId;
      return { ...prev, [key]: { ...prev[key], [field]: value } };
    });
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Enter a grade title (e.g. Midterm)'); return; }
    if (!selectedStudent) return;

    setSaving(true);
    try {
      const entries = subjects.map(sub => {
        const sc = scores[sub.id];
        const existing = allGrades.find(g => g.student_id === selectedStudent.id && g.subject_id === sub.id && g.term === term && g.title === title);
        const theory = parseFloat(sc?.theory ?? (existing?.theory_score?.toString() ?? '0'));
        const practical = parseFloat(sc?.practical ?? (existing?.practical_score?.toString() ?? '0'));

        return {
          class_id: classId,
          student_id: selectedStudent.id,
          subject_id: sub.id,
          title: title.trim(),
          theory_score: theory,
          practical_score: practical,
          theory_max: 75,
          practical_max: 25,
          score: theory + practical,
          max_score: 100,
          term,
          entered_by: user?.id,
          existingId: existing?.id ?? null,
        };
      }).filter(e => e.theory_score > 0 || e.practical_score > 0);

      if (entries.length === 0) { Alert.alert('Error', 'Enter at least one score'); return; }

      for (const entry of entries) {
        const { existingId, ...payload } = entry;
        if (existingId) {
          await supabase.from('grade_entries').update({ theory_score: payload.theory_score, practical_score: payload.practical_score, score: payload.score }).eq('id', existingId);
        } else {
          await supabase.from('grade_entries').insert(payload);
        }
      }

      Alert.alert('Success', `Saved grades for ${selectedStudent.full_name}`);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const computeOverallGpa = () => {
    if (subjects.length === 0) return 0;
    let totalPct = 0;
    let count = 0;
    for (const sub of subjects) {
      const sc = scores[sub.id];
      const existing = allGrades.find(g => g.student_id === selectedStudent?.id && g.subject_id === sub.id && g.term === term && g.title === title);
      const theory = parseFloat(sc?.theory ?? (existing?.theory_score?.toString() ?? ''));
      const practical = parseFloat(sc?.practical ?? (existing?.practical_score?.toString() ?? ''));
      if (!isNaN(theory) || !isNaN(practical)) {
        const total = (isNaN(theory) ? 0 : theory) + (isNaN(practical) ? 0 : practical);
        totalPct += total;
        count++;
      }
    }
    return count > 0 ? totalPct / count / 10 : 0;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!classInfo) return <View style={styles.center}><Text>Class not found</Text></View>;

  // STEP 2: Selected student — show subjects with theory/practical
  if (selectedStudent) {
    const overallGpa = computeOverallGpa();
    const gpaColorFn = (g: number) => g >= 7 ? COLORS.success : g >= 5 ? COLORS.warning : COLORS.danger;
    const gpaBgFn = (g: number) => g >= 7 ? COLORS.successBg : g >= 5 ? COLORS.warningBg : COLORS.dangerBg;

    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => { setSelectedStudent(null); setScores({}); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Back to students</Text>
        </TouchableOpacity>

        <View style={styles.studentHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{selectedStudent.full_name[0]}</Text></View>
          <View>
            <Text style={styles.studentName}>{selectedStudent.full_name}</Text>
            {selectedStudent.roll_number ? <Text style={styles.rollNo}>Roll #{selectedStudent.roll_number}</Text> : null}
          </View>
        </View>

        {isClassTeacher ? (
          <>
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

            <Text style={styles.sectionLabel}>Subjects</Text>
            {subjects.map(sub => {
              const sc = scores[sub.id];
              const existing = allGrades.find(g => g.student_id === selectedStudent.id && g.subject_id === sub.id && g.term === term && g.title === title);
              const theory = sc?.theory ?? existing?.theory_score?.toString() ?? '';
              const practical = sc?.practical ?? existing?.practical_score?.toString() ?? '';
              const t = parseFloat(theory || '0');
              const p = parseFloat(practical || '0');
              const total = t + p;
              const pct = Math.round((total / 100) * 100);
              const subGpa = total / 10;

              return (
                <View key={sub.id} style={styles.subjectCard}>
                  <View style={styles.subjectHeader}>
                    <Text style={styles.subjectName}>{sub.name}</Text>
                    <View style={[styles.gpaPill, { backgroundColor: gpaBgFn(subGpa) }]}>
                      <Text style={[styles.gpaPillText, { color: gpaColorFn(subGpa) }]}>{subGpa.toFixed(1)} GPA · {pct}%</Text>
                    </View>
                  </View>
                  <View style={styles.scoreRow}>
                    <View style={styles.scoreInput}>
                      <Text style={styles.scoreLabel}>Theory /75</Text>
                      <TextInput style={styles.scoreField} keyboardType="numeric" value={theory} onChangeText={v => handleScoreChange(sub.id, 'theory', v)} placeholder="0" />
                    </View>
                    <Text style={styles.scorePlus}>+</Text>
                    <View style={styles.scoreInput}>
                      <Text style={styles.scoreLabel}>Practical /25</Text>
                      <TextInput style={styles.scoreField} keyboardType="numeric" value={practical} onChangeText={v => handleScoreChange(sub.id, 'practical', v)} placeholder="0" />
                    </View>
                    <View style={styles.scoreTotal}>
                      <Text style={styles.scoreEquals}>=</Text>
                      <Text style={[styles.scoreTotalVal, { color: gpaColorFn(subGpa) }]}>{total}</Text>
                      <Text style={styles.scoreLabel}>/100</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Overall GPA */}
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>Overall GPA</Text>
              <Text style={[styles.overallGpa, { color: gpaColorFn(overallGpa) }]}>{overallGpa.toFixed(1)}</Text>
              <Text style={styles.overallSub}>/ 10</Text>
              <View style={styles.overallBar}>
                <View style={[styles.overallBarFill, { width: `${Math.min(overallGpa * 10, 100)}%`, backgroundColor: gpaColorFn(overallGpa) }]} />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save All Grades'}</Text>
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

      <Text style={styles.sectionLabel}>Select a student to grade</Text>

      {students.map(s => {
        const studentGrades = getStudentGrades(s.id);
        const gradedCount = studentGrades.filter(g => (g.theory_score ?? 0) > 0 || (g.practical_score ?? 0) > 0).length;
        return (
          <TouchableOpacity key={s.id} style={styles.studentCard} onPress={() => setSelectedStudent(s)}>
            <View style={styles.studentRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{s.full_name[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{s.full_name}</Text>
                {s.roll_number ? <Text style={styles.rollNo}>Roll #{s.roll_number}</Text> : null}
              </View>
              {gradedCount > 0 ? (
                <View style={[styles.gradedBadge, { backgroundColor: COLORS.successBg }]}>
                  <Text style={[styles.gradedBadgeText, { color: COLORS.success }]}>{gradedCount}/{subjects.length}</Text>
                </View>
              ) : (
                <View style={[styles.gradedBadge, { backgroundColor: COLORS.surfaceAlt }]}>
                  <Text style={[styles.gradedBadgeText, { color: COLORS.textSecondary }]}>0/{subjects.length}</Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        );
      })}

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

  studentCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rollNo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  gradedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  gradedBadgeText: { fontSize: 12, fontWeight: '700' },
  arrow: { fontSize: 22, color: COLORS.textSecondary, fontWeight: '300' },

  // Student detail view
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  formHalf: { flex: 1 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text },

  subjectCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subjectName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  gpaPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gpaPillText: { fontSize: 12, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreInput: { flex: 1 },
  scoreLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  scoreField: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, color: COLORS.text, textAlign: 'center' },
  scorePlus: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
  scoreTotal: { alignItems: 'center', marginTop: 16 },
  scoreEquals: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  scoreTotalVal: { fontSize: 18, fontWeight: '800' },

  overallCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, marginTop: 12, marginBottom: 8, alignItems: 'center', ...SHADOWS.md },
  overallLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  overallGpa: { fontSize: 52, fontWeight: '800', marginTop: 4 },
  overallSub: { fontSize: 15, color: COLORS.textSecondary, marginTop: 2 },
  overallBar: { width: '100%', height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, marginTop: 16 },
  overallBarFill: { height: 6, borderRadius: 3 },

  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: COLORS.textInverse, fontSize: 16, fontWeight: '700' },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: '600' },
});
