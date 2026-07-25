import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { useLocalSearchParams } from 'expo-router';

interface Student {
  id: string;
  full_name: string;
  email?: string;
}

interface GradeEntry {
  id: string;
  class_id: string;
  student_id: string;
  title: string;
  score: number;
  max_score: number;
  term: string;
  created_at: string;
  entered_by: string;
  student?: Student;
}

export default function TeacherGradesScreen() {
  const { user } = useAuth();
  const { classId } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeEntries, setGradeEntries] = useState<Record<string, GradeEntry[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<Record<string, boolean>>({});
  const [newGrade, setNewGrade] = useState<Record<string, { studentId: string; title: string; score: number; maxScore: number; term: string }>>({});

  const fetchStudentsAndGrades = async () => {
    if (!classId) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch students enrolled in this class
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          profiles(id, full_name)
        `)
        .eq('class_id', classId);

      if (enrollmentsError) {
        setErrorMsg(enrollmentsError.message);
        return;
      }

      const studentsList = enrollments?.map((enrollment: any) => {
        const p = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
        if (!p) return null;
        return p as Student;
      }).filter(Boolean) as Student[];
      setStudents(studentsList);

      // Fetch existing grade entries for this class
      const { data: existingEntries, error: entriesError } = await supabase
        .from('grade_entries')
        .select(`
          id,
          class_id,
          student_id,
          title,
          score,
          max_score,
          term,
          created_at,
          entered_by,
          student:profiles!grade_entries_student_id_fkey(id, full_name)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (entriesError) {
        setErrorMsg(entriesError.message);
        return;
      }

      // Group entries by student
      const entriesByStudent: Record<string, GradeEntry[]> = {};
      existingEntries?.forEach((entry: any) => {
        if (!entriesByStudent[entry.student_id]) {
          entriesByStudent[entry.student_id] = [];
        }
        const studentObj = Array.isArray(entry.student) ? entry.student[0] : entry.student;
        const typedEntry: GradeEntry = {
          id: entry.id,
          class_id: entry.class_id,
          student_id: entry.student_id,
          title: entry.title,
          score: entry.score,
          max_score: entry.max_score,
          term: entry.term,
          created_at: entry.created_at,
          entered_by: entry.entered_by,
          student: studentObj ? { id: studentObj.id, full_name: studentObj.full_name } : undefined,
        };
        entriesByStudent[entry.student_id].push(typedEntry);
      });
      setGradeEntries(entriesByStudent);

    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching data');
    } finally {
      setLoading(false);
    }
  };

  const addGrade = async (studentId: string) => {
    const gradeData = newGrade[studentId];
    if (!gradeData || !gradeData.title || gradeData.score < 0) return;
    
    setSaving(true);
    setErrorMsg(null);
    
    try {
      const { data, error } = await supabase
        .from('grade_entries')
        .insert({
          class_id: classId,
          student_id: studentId,
          title: gradeData.title,
          score: gradeData.score,
          max_score: gradeData.maxScore,
          term: gradeData.term,
          entered_by: user?.id,
        })
        .select(`
          id,
          class_id,
          student_id,
          title,
          score,
          max_score,
          term,
          created_at,
          entered_by,
          student:profiles!grade_entries_student_id_fkey(id, full_name)
        `)
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        // Add the new entry to the local state
        setGradeEntries(prev => {
          const studentEntries = prev[studentId] || [];
          const studentObj = Array.isArray((data as any).student) ? (data as any).student[0] : (data as any).student;
          const newEntry: GradeEntry = {
            id: data.id,
            class_id: data.class_id,
            student_id: data.student_id,
            title: data.title,
            score: data.score,
            max_score: data.max_score,
            term: data.term,
            created_at: data.created_at,
            entered_by: data.entered_by,
            student: studentObj ? { id: studentObj.id, full_name: studentObj.full_name } : undefined,
          };
          return {
            ...prev,
            [studentId]: [newEntry, ...studentEntries],
          };
        });
        
        // Clear the form
        setNewGrade(prev => ({
          ...prev,
          [studentId]: { ...prev[studentId], title: '', score: 0, maxScore: 100, term: '' }
        }));
        setShowAddForm(prev => ({ ...prev, [studentId]: false }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred adding grade');
    } finally {
      setSaving(false);
    }
  };

  const updateNewGrade = (studentId: string, field: string, value: any) => {
    setNewGrade(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const getGradePercent = (score: number, max: number) => {
    return Math.round((score / max) * 100);
  };

  const getScoreColor = (percent: number) => {
    if (percent >= 90) return COLORS.chalk;
    if (percent >= 70) return COLORS.pencil;
    if (percent >= 50) return COLORS.ink;
    return COLORS.danger;
  };

  useEffect(() => {
    fetchStudentsAndGrades();
  }, [classId]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Enter Grades</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStudentsAndGrades}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No students enrolled in this class.</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const studentGrades = gradeEntries[item.id] || [];
            const showForm = showAddForm[item.id] || false;
            const gradeData = newGrade[item.id] || { studentId: item.id, title: '', score: 0, maxScore: 100, term: '' };
            
            return (
              <View style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <Text style={styles.studentName}>{item.full_name}</Text>
                  <TouchableOpacity 
                    style={styles.addGradeButton}
                    onPress={() => setShowAddForm(prev => ({ ...prev, [item.id]: !showForm }))}
                  >
                    <Text style={styles.addGradeButtonText}>
                      {showForm ? 'Cancel' : 'Add Grade'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showForm && (
                  <View style={styles.addGradeForm}>
                    <TextInput
                      style={styles.formInput}
                      value={gradeData.title}
                      onChangeText={(text) => updateNewGrade(item.id, 'title', text)}
                      placeholder="Assignment Title"
                    />
                    
                    <View style={styles.scoreRow}>
                      <TextInput
                        style={[styles.formInput, styles.scoreInput]}
                        value={gradeData.score.toString()}
                        onChangeText={(text) => updateNewGrade(item.id, 'score', parseFloat(text) || 0)}
                        placeholder="Score"
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[styles.formInput, styles.maxScoreInput]}
                        value={gradeData.maxScore.toString()}
                        onChangeText={(text) => updateNewGrade(item.id, 'maxScore', parseFloat(text) || 100)}
                        placeholder="Max"
                        keyboardType="numeric"
                      />
                    </View>
                    
                    <TextInput
                      style={styles.formInput}
                      value={gradeData.term}
                      onChangeText={(text) => updateNewGrade(item.id, 'term', text)}
                      placeholder="Term (e.g., Fall 2026)"
                    />
                    
                    <TouchableOpacity 
                      style={[styles.saveGradeButton, saving && styles.saveGradeButtonDisabled]}
                      onPress={() => addGrade(item.id)}
                      disabled={saving}
                    >
                      <Text style={styles.saveGradeButtonText}>
                        {saving ? 'Saving...' : 'Save Grade'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {studentGrades.length > 0 && (
                  <View style={styles.gradesList}>
                    <Text style={styles.gradesTitle}>Recent Grades:</Text>
                    {studentGrades.map((grade) => {
                      const percent = getGradePercent(grade.score, grade.max_score);
                      return (
                        <View key={grade.id} style={styles.gradeCard}>
                          <View style={styles.gradeInfo}>
                            <Text style={styles.gradeTitle}>{grade.title}</Text>
                            <Text style={styles.gradeTerm}>{grade.term}</Text>
                          </View>
                          
                          <View style={styles.gradeScore}>
                            <Text style={[styles.scoreText, { color: getScoreColor(percent) }]}>
                              {grade.score}/{grade.max_score} ({percent}%)
                            </Text>
                            <Text style={styles.gradeDate}>
                              {new Date(grade.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 20,
  },
  loader: {
    marginTop: 32,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  errorText: {
    color: COLORS.danger,
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.cover,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.paper,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.graphite,
    fontSize: 16,
    textAlign: 'center',
  },
  studentCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  addGradeButton: {
    backgroundColor: COLORS.chalk,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addGradeButtonText: {
    color: COLORS.paper,
    fontWeight: '600',
    fontSize: 14,
  },
  addGradeForm: {
    backgroundColor: COLORS.paper,
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 16,
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.paperDim,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreInput: {
    flex: 1,
  },
  maxScoreInput: {
    flex: 1,
  },
  saveGradeButton: {
    backgroundColor: COLORS.pencil,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveGradeButtonDisabled: {
    backgroundColor: COLORS.graphite,
  },
  saveGradeButtonText: {
    color: COLORS.paper,
    fontWeight: 'bold',
    fontSize: 14,
  },
  gradesList: {
    marginTop: 8,
  },
  gradesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
  },
  gradeCard: {
    backgroundColor: COLORS.paper,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gradeInfo: {
    flex: 1,
  },
  gradeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 4,
  },
  gradeTerm: {
    fontSize: 14,
    color: COLORS.graphite,
  },
  gradeScore: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gradeDate: {
    fontSize: 12,
    color: COLORS.graphite,
  },
});