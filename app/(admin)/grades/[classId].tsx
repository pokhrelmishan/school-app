import React, { useState, useEffect, useCallback } from 'react';
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

interface Student {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Subject {
  id: string;
  name: string;
}

interface GradeEntry {
  id: string;
  student_id: string;
  title: string;
  score: number;
  max_score: number;
  term: string;
  subject_id: string;
  created_at: string;
}

interface GradeForm {
  title: string;
  score: string;
  maxScore: string;
  term: string;
}

const defaultForm: GradeForm = {
  title: '',
  score: '',
  maxScore: '100',
  term: 'Term 1',
};

export default function ClassGradeEntryScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user } = useAuth();

  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [existingGrades, setExistingGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkForm, setBulkForm] = useState<GradeForm>(defaultForm);
  const [studentForms, setStudentForms] = useState<Map<string, GradeForm>>(new Map());
  const [bulkScores, setBulkScores] = useState<Map<string, string>>(new Map());

  const fetchClassData = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);

      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select('name, grade_level')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassName(classInfo.name);
      setGradeLevel(classInfo.grade_level);

      const { data: enrollments, error: enrollError } = await supabase
        .from('class_enrollments')
        .select('student_id, profiles!student_id(id, full_name, avatar_url)')
        .eq('class_id', classId);

      if (enrollError) throw enrollError;

      const studentList: Student[] = (enrollments || [])
        .map((e: any) => e.profiles)
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        }));
      setStudents(studentList);

      const { data: subjectData, error: subjectError } = await supabase
        .from('teacher_subjects')
        .select('subjects!subject_id(id, name)')
        .eq('class_id', classId);

      if (subjectError) throw subjectError;

      const subjectList: Subject[] = (subjectData || [])
        .map((s: any) => s.subjects)
        .filter(Boolean)
        .map((s: any) => ({ id: s.id, name: s.name }));
      setSubjects(subjectList);

      if (subjectList.length > 0 && !selectedSubject) {
        setSelectedSubject(subjectList[0].id);
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
    } finally {
      setLoading(false);
    }
  }, [classId, selectedSubject]);

  const fetchGrades = useCallback(async () => {
    if (!classId || !selectedSubject) return;

    try {
      const query = supabase
        .from('grade_entries')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (selectedSubject !== 'all') {
        query.eq('subject_id', selectedSubject);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExistingGrades(data || []);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  }, [classId, selectedSubject]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const getStudentForm = (studentId: string): GradeForm => {
    return studentForms.get(studentId) || { ...defaultForm };
  };

  const updateStudentForm = (studentId: string, field: keyof GradeForm, value: string) => {
    setStudentForms((prev) => {
      const next = new Map(prev);
      const current = prev.get(studentId) || { ...defaultForm };
      next.set(studentId, { ...current, [field]: value });
      return next;
    });
  };

  const saveGrade = async (studentId: string, form: GradeForm) => {
    if (!classId || !user) return;
    if (!form.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!form.score.trim()) {
      Alert.alert('Error', 'Please enter a score');
      return;
    }

    const score = parseFloat(form.score);
    const maxScore = parseFloat(form.maxScore) || 100;

    if (isNaN(score) || score < 0) {
      Alert.alert('Error', 'Please enter a valid score');
      return;
    }

    if (score > maxScore) {
      Alert.alert('Error', 'Score cannot exceed max score');
      return;
    }

    const subjectId = selectedSubject === 'all' ? subjects[0]?.id : selectedSubject;
    if (!subjectId) {
      Alert.alert('Error', 'No subject selected');
      return;
    }

    try {
      setSaving(studentId);
      const { error } = await supabase.from('grade_entries').insert({
        class_id: classId,
        student_id: studentId,
        title: form.title.trim(),
        score,
        max_score: maxScore,
        term: form.term.trim() || 'Term 1',
        subject_id: subjectId,
        entered_by: user.id,
      });

      if (error) throw error;

      setStudentForms((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...defaultForm, maxScore: '100', term: form.term });
        return next;
      });

      fetchGrades();
      Alert.alert('Success', 'Grade saved successfully');
    } catch (error) {
      console.error('Error saving grade:', error);
      Alert.alert('Error', 'Failed to save grade');
    } finally {
      setSaving(null);
    }
  };

  const saveBulkGrades = async () => {
    if (!classId || !user) return;
    if (!bulkForm.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const subjectId = selectedSubject === 'all' ? subjects[0]?.id : selectedSubject;
    if (!subjectId) {
      Alert.alert('Error', 'No subject selected');
      return;
    }

    const maxScore = parseFloat(bulkForm.maxScore) || 100;
    const entries: any[] = [];
    let hasError = false;

    for (const student of students) {
      const scoreStr = bulkScores.get(student.id);
      if (!scoreStr || scoreStr.trim() === '') continue;

      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0 || score > maxScore) {
        Alert.alert('Error', `Invalid score for ${student.full_name}`);
        hasError = true;
        break;
      }

      entries.push({
        class_id: classId,
        student_id: student.id,
        title: bulkForm.title.trim(),
        score,
        max_score: maxScore,
        term: bulkForm.term.trim() || 'Term 1',
        subject_id: subjectId,
        entered_by: user.id,
      });
    }

    if (hasError) return;
    if (entries.length === 0) {
      Alert.alert('Error', 'Please enter at least one score');
      return;
    }

    try {
      setSaving('bulk');
      const { error } = await supabase.from('grade_entries').insert(entries);
      if (error) throw error;

      setBulkScores(new Map());
      setBulkForm({ ...defaultForm, maxScore: '100', term: bulkForm.term });
      fetchGrades();
      Alert.alert('Success', `${entries.length} grades saved successfully`);
    } catch (error) {
      console.error('Error saving bulk grades:', error);
      Alert.alert('Error', 'Failed to save grades');
    } finally {
      setSaving(null);
    }
  };

  const getStudentGradeCount = (studentId: string) => {
    return existingGrades.filter((g) => g.student_id === studentId).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{className}</Text>
          <Text style={styles.headerSubtitle}>Grade {gradeLevel}</Text>
        </View>
      </View>

      <View style={styles.subjectPickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.subjectPill,
              selectedSubject === 'all' && styles.subjectPillActive,
            ]}
            onPress={() => setSelectedSubject('all')}
          >
            <Text
              style={[
                styles.subjectPillText,
                selectedSubject === 'all' && styles.subjectPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {subjects.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={[
                styles.subjectPill,
                selectedSubject === subject.id && styles.subjectPillActive,
              ]}
              onPress={() => setSelectedSubject(subject.id)}
            >
              <Text
                style={[
                  styles.subjectPillText,
                  selectedSubject === subject.id && styles.subjectPillTextActive,
                ]}
              >
                {subject.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.bulkToggleContainer}>
        <TouchableOpacity
          style={[styles.bulkToggle, bulkMode && styles.bulkToggleActive]}
          onPress={() => setBulkMode(!bulkMode)}
        >
          <Text style={[styles.bulkToggleText, bulkMode && styles.bulkToggleTextActive]}>
            {bulkMode ? 'Individual Mode' : 'Bulk Entry Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.studentList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.studentListContent}
      >
        {bulkMode ? (
          <>
            <View style={styles.bulkFormCard}>
              <Text style={styles.cardTitle}>Bulk Entry Settings</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={bulkForm.title}
                  onChangeText={(v) => setBulkForm((p) => ({ ...p, title: v }))}
                  placeholder="e.g. Quiz 1, Midterm"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Max Score</Text>
                <TextInput
                  style={styles.input}
                  value={bulkForm.maxScore}
                  onChangeText={(v) => setBulkForm((p) => ({ ...p, maxScore: v }))}
                  placeholder="100"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Term</Text>
                <TextInput
                  style={styles.input}
                  value={bulkForm.term}
                  onChangeText={(v) => setBulkForm((p) => ({ ...p, term: v }))}
                  placeholder="Term 1"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {students.map((student) => (
              <View key={student.id} style={styles.bulkStudentRow}>
                <View style={styles.bulkStudentInfo}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarText}>
                      {student.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.bulkStudentName} numberOfLines={1}>
                    {student.full_name}
                  </Text>
                </View>
                <TextInput
                  style={styles.bulkScoreInput}
                  value={bulkScores.get(student.id) || ''}
                  onChangeText={(v) =>
                    setBulkScores((prev) => {
                      const next = new Map(prev);
                      next.set(student.id, v);
                      return next;
                    })
                  }
                  placeholder="--"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveAllButton, saving === 'bulk' && styles.saveAllButtonDisabled]}
              onPress={saveBulkGrades}
              disabled={saving === 'bulk'}
            >
              {saving === 'bulk' ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.saveAllButtonText}>
                  Save All ({students.filter((s) => bulkScores.get(s.id)).length} students)
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          students.map((student) => {
            const form = getStudentForm(student.id);
            return (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {student.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.full_name}</Text>
                    <Text style={styles.studentGradeCount}>
                      {getStudentGradeCount(student.id)} grades
                    </Text>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Title</Text>
                    <TextInput
                      style={styles.input}
                      value={form.title}
                      onChangeText={(v) => updateStudentForm(student.id, 'title', v)}
                      placeholder="e.g. Quiz 1"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Score</Text>
                    <TextInput
                      style={styles.input}
                      value={form.score}
                      onChangeText={(v) => updateStudentForm(student.id, 'score', v)}
                      placeholder="0"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Max</Text>
                    <TextInput
                      style={styles.input}
                      value={form.maxScore}
                      onChangeText={(v) => updateStudentForm(student.id, 'maxScore', v)}
                      placeholder="100"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Term</Text>
                    <TextInput
                      style={styles.input}
                      value={form.term}
                      onChangeText={(v) => updateStudentForm(student.id, 'term', v)}
                      placeholder="Term 1"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, saving === student.id && styles.saveButtonDisabled]}
                  onPress={() => saveGrade(student.id, form)}
                  disabled={saving === student.id}
                >
                  {saving === student.id ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {existingGrades.length > 0 && (
          <View style={styles.existingGradesSection}>
            <Text style={styles.sectionTitle}>
              Existing Grades ({existingGrades.length})
            </Text>
            {existingGrades.map((grade) => {
              const student = students.find((s) => s.id === grade.student_id);
              const pct = grade.max_score > 0
                ? Math.round((grade.score / grade.max_score) * 100)
                : 0;
              return (
                <View key={grade.id} style={styles.gradeRow}>
                  <View style={styles.gradeRowInfo}>
                    <Text style={styles.gradeRowName}>
                      {student?.full_name || 'Unknown'}
                    </Text>
                    <Text style={styles.gradeRowTitle}>{grade.title}</Text>
                  </View>
                  <View style={styles.gradeRowScore}>
                    <Text style={styles.gradeRowScoreText}>
                      {grade.score}/{grade.max_score}
                    </Text>
                    <Text
                      style={[
                        styles.gradeRowPct,
                        pct >= 70
                          ? styles.gradeGood
                          : pct >= 50
                          ? styles.gradeAverage
                          : styles.gradePoor,
                      ]}
                    >
                      {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  subjectPickerContainer: {
    marginBottom: 16,
  },
  subjectPill: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  subjectPillActive: {
    backgroundColor: COLORS.primaryBg,
  },
  subjectPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  subjectPillTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  bulkToggleContainer: {
    marginBottom: 16,
  },
  bulkToggle: {
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  bulkToggleActive: {
    backgroundColor: COLORS.primaryBg,
  },
  bulkToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  bulkToggleTextActive: {
    color: COLORS.primary,
  },
  studentList: {
    flex: 1,
  },
  studentListContent: {
    paddingBottom: 40,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  studentGradeCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  formSection: {
    gap: 10,
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    width: 40,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  bulkFormCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 14,
  },
  bulkStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  bulkStudentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bulkStudentName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  bulkScoreInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 70,
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.text,
  },
  saveAllButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  saveAllButtonDisabled: {
    opacity: 0.6,
  },
  saveAllButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  existingGradesSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  gradeRowInfo: {
    flex: 1,
  },
  gradeRowName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  gradeRowTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  gradeRowScore: {
    alignItems: 'flex-end',
  },
  gradeRowScoreText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  gradeRowPct: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  gradeGood: {
    color: '#22c55e',
  },
  gradeAverage: {
    color: '#f59e0b',
  },
  gradePoor: {
    color: '#ef4444',
  },
});
