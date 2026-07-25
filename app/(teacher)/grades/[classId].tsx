import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

interface ClassInfo { id: string; name: string; grade_level: string; teacher_id: string; }
interface Subject { id: string; name: string; }
interface Student { id: string; full_name: string; email: string; }
interface GradeEntry { id: string; student_id: string; subject_id: string; title: string; theory_score: number | null; practical_score: number | null; theory_max: number; practical_max: number; term: string; }

export default function TeacherGradesEntryScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
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
        const unique = Array.from(new Map(allSubjects.map(s => [s.id, s])).values());
        setSubjects(unique);
        if (unique.length > 0 && !selectedSubject) setSelectedSubject(unique[0].id);
      }

      const enrollRes = await supabase.from('class_enrollments').select('student:profiles!class_enrollments_student_id_fkey(id, full_name, email)').eq('class_id', classId);
      if (enrollRes.data) {
        setStudents(enrollRes.data.map((e: any) => ({ id: e.student?.id, full_name: e.student?.full_name ?? '', email: e.student?.email ?? '' })).filter((s: Student) => s.id));
      }

      const gradesRes = await supabase.from('grade_entries').select('id, student_id, subject_id, title, theory_score, practical_score, theory_max, practical_max, term').eq('class_id', classId).order('created_at', { ascending: false });
      if (gradesRes.data) setGrades(gradesRes.data as GradeEntry[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStudentGrade = (studentId: string) => {
    return grades.find(g => g.student_id === studentId && g.subject_id === selectedSubject && g.term === term && g.title === title);
  };

  const handleScoreChange = (studentId: string, field: 'theory' | 'practical', value: string) => {
    setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Enter a grade title (e.g. Midterm)'); return; }
    if (!selectedSubject) { Alert.alert('Error', 'Select a subject'); return; }

    setSaving(true);
    try {
      const entries = students.map(s => {
        const sc = scores[s.id];
        const theory = parseFloat(sc?.theory || '0');
        const practical = parseFloat(sc?.practical || '0');
        return {
          class_id: classId,
          student_id: s.id,
          subject_id: selectedSubject,
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
      }).filter(e => e.theory_score > 0 || e.practical_score > 0);

      if (entries.length === 0) { Alert.alert('Error', 'Enter at least one score'); return; }

      for (const entry of entries) {
        const existing = grades.find(g => g.student_id === entry.student_id && g.subject_id === entry.subject_id && g.term === entry.term && g.title === entry.title);
        if (existing) {
          await supabase.from('grade_entries').update({ theory_score: entry.theory_score, practical_score: entry.practical_score, score: entry.score }).eq('id', existing.id);
        } else {
          await supabase.from('grade_entries').insert(entry);
        }
      }

      Alert.alert('Success', `Saved grades for ${entries.length} students`);
      setScores({});
      setTitle('');
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!classInfo) return <View style={styles.center}><Text>Class not found</Text></View>;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>← Back</Text></TouchableOpacity>

      <Text style={styles.className}>{classInfo.name}</Text>
      <Text style={styles.gradeLevel}>Grade {classInfo.grade_level}</Text>

      {isClassTeacher ? (
        <View style={[styles.badge, { backgroundColor: COLORS.primaryBg }]}>
          <Text style={[styles.badgeText, { color: COLORS.primary }]}>Class Teacher — Grade Entry</Text>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: COLORS.warningBg }]}>
          <Text style={[styles.badgeText, { color: COLORS.warning }]}>View Only — Class Teacher only enters grades</Text>
        </View>
      )}

      {isClassTeacher && (
        <>
          {/* Subject Pills */}
          <Text style={styles.sectionLabel}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {subjects.map(s => (
              <TouchableOpacity key={s.id} style={[styles.pill, selectedSubject === s.id && styles.pillActive]} onPress={() => setSelectedSubject(s.id)}>
                <Text style={[styles.pillText, selectedSubject === s.id && styles.pillTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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

          {/* Student Score Entry */}
          <Text style={styles.sectionLabel}>Enter Scores (Theory /75 + Practical /25)</Text>
          {students.map(s => {
            const sc = scores[s.id];
            const existing = getStudentGrade(s.id);
            return (
              <View key={s.id} style={styles.studentCard}>
                <View style={styles.studentRow}>
                  <View style={styles.studentAvatar}><Text style={styles.studentInitial}>{s.full_name[0]}</Text></View>
                  <Text style={styles.studentName} numberOfLines={1}>{s.full_name}</Text>
                </View>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreInput}>
                    <Text style={styles.scoreLabel}>Theory</Text>
                    <TextInput style={styles.scoreField} keyboardType="numeric" value={sc?.theory ?? (existing?.theory_score?.toString() ?? '')} onChangeText={v => handleScoreChange(s.id, 'theory', v)} placeholder="0" />
                  </View>
                  <Text style={styles.scorePlus}>+</Text>
                  <View style={styles.scoreInput}>
                    <Text style={styles.scoreLabel}>Practical</Text>
                    <TextInput style={styles.scoreField} keyboardType="numeric" value={sc?.practical ?? (existing?.practical_score?.toString() ?? '')} onChangeText={v => handleScoreChange(s.id, 'practical', v)} placeholder="0" />
                  </View>
                  <View style={styles.scoreTotal}>
                    <Text style={styles.scoreLabel}>= </Text>
                    <Text style={styles.totalValue}>{(parseFloat(sc?.theory || existing?.theory_score?.toString() || '0') + parseFloat(sc?.practical || existing?.practical_score?.toString() || '0'))}</Text>
                    <Text style={styles.scoreLabel}>/100</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Grades'}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Existing grades summary */}
      {!isClassTeacher && grades.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Existing Grades</Text>
          {grades.slice(0, 20).map(g => {
            const sub = subjects.find(s => s.id === g.subject_id);
            const total = (g.theory_score ?? 0) + (g.practical_score ?? 0);
            return (
              <View key={g.id} style={styles.gradeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gradeTitle}>{g.title} — {sub?.name ?? 'N/A'}</Text>
                  <Text style={styles.gradeMeta}>{g.term}</Text>
                </View>
                <Text style={styles.gradeScore}>T:{g.theory_score ?? 0} P:{g.practical_score ?? 0} = {total}</Text>
              </View>
            );
          })}
        </>
      )}

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
  gradeLevel: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  pillRow: { marginBottom: 16 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.textInverse },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  formHalf: { flex: 1 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text },
  studentCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  studentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  studentInitial: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  studentName: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreInput: { flex: 1 },
  scoreLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  scoreField: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15, color: COLORS.text, textAlign: 'center' },
  scorePlus: { fontSize: 18, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16 },
  scoreTotal: { alignItems: 'center', marginTop: 16 },
  totalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: COLORS.textInverse, fontSize: 16, fontWeight: '700' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  gradeTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  gradeMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  gradeScore: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});
