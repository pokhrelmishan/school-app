import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface Student {
  id: string;
  full_name: string;
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
  class?: {
    name: string;
    grade_level: string;
    teacher?: {
      full_name: string;
    };
  };
}

export default function ParentGradesScreen() {
  const { user } = useAuth();
  const [linkedStudents, setLinkedStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const fetchLinkedStudents = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('parent_students')
        .select(`
          student:profiles!parent_students_student_id_fkey(
            id,
            full_name
          )
        `)
        .eq('parent_id', user?.id);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const studentsList = data?.flatMap(item => item.student || []).filter(Boolean) as Student[];
      setLinkedStudents(studentsList);
      
      // Select first student by default
      if (studentsList.length > 0 && !selectedStudent) {
        setSelectedStudent(studentsList[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching students');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async () => {
    if (!selectedStudent) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      const query = supabase
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
          student:profiles!grade_entries_student_id_fkey(full_name),
          class:classes(name, grade_level, teacher:profiles!classes_teacher_id_fkey(full_name))
        `)
        .eq('student_id', selectedStudent)
        .order('created_at', { ascending: false });

      if (selectedTerm) {
        query.eq('term', selectedTerm);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setGrades(data as unknown as GradeEntry[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching grades');
    } finally {
      setLoading(false);
    }
  };

  const getGradePercent = (score: number, max: number) => {
    return Math.round((score / max) * 100);
  };

  const getScoreColor = (percent: number) => {
    if (percent >= 90) return COLORS.success;
    if (percent >= 70) return COLORS.primary;
    if (percent >= 50) return COLORS.text;
    return COLORS.danger;
  };

  const getUniqueTerms = () => {
    const terms = grades.map(grade => grade.term);
    return Array.from(new Set(terms)).sort((a, b) => b.localeCompare(a)); // Most recent first
  };

  const getGradeStats = () => {
    if (grades.length === 0) return null;
    
    const total = grades.reduce((sum, grade) => sum + grade.score, 0);
    const maxTotal = grades.reduce((sum, grade) => sum + grade.max_score, 0);
    const overallPercent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    
    const letterGrade = overallPercent >= 90 ? 'A' :
                       overallPercent >= 80 ? 'B' :
                       overallPercent >= 70 ? 'C' :
                       overallPercent >= 60 ? 'D' : 'F';
    
    return { overallPercent, letterGrade, count: grades.length };
  };

  const stats = getGradeStats();

  useEffect(() => {
    if (user?.id) {
      fetchLinkedStudents();
    }
  }, [user?.id]);

  useEffect(() => {
    fetchGrades();
  }, [selectedStudent, selectedTerm]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Child's Report Card</Text>

      {loading && linkedStudents.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : linkedStudents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No children linked to your account.</Text>
        </View>
      ) : (
        <>
          <View style={styles.studentSelector}>
            <Text style={styles.selectorLabel}>Select Child:</Text>
            <View style={styles.studentButtons}>
              {linkedStudents.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.studentButton, selectedStudent === student.id && styles.studentButtonSelected]}
                  onPress={() => setSelectedStudent(student.id)}
                >
                  <Text style={[styles.studentButtonText, selectedStudent === student.id && styles.studentButtonTextSelected]}>
                    {student.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedStudent && (
            <>
              {stats && (
                <View style={styles.statsContainer}>
                  <View style={styles.overallGradeCard}>
                    <Text style={styles.overallGradeLabel}>Overall Grade</Text>
                    <Text style={[styles.overallGradeValue, { color: getScoreColor(stats.overallPercent) }]}>
                      {stats.letterGrade}
                    </Text>
                    <Text style={styles.overallGradePercent}>{stats.overallPercent.toFixed(1)}%</Text>
                    <Text style={styles.overallGradeCount}>({stats.count} assignments)</Text>
                  </View>
                </View>
              )}

              <View style={styles.termSelector}>
                <TouchableOpacity 
                  style={[styles.termButton, !selectedTerm && styles.termButtonActive]}
                  onPress={() => setSelectedTerm(null)}
                >
                  <Text style={[styles.termButtonText, !selectedTerm && styles.termButtonTextActive]}>All</Text>
                </TouchableOpacity>
                
                {getUniqueTerms().map(term => (
                  <TouchableOpacity 
                    key={term}
                    style={[styles.termButton, selectedTerm === term && styles.termButtonActive]}
                    onPress={() => setSelectedTerm(term)}
                  >
                    <Text style={[styles.termButtonText, selectedTerm === term && styles.termButtonTextActive]}>
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : errorMsg ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={fetchGrades}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : grades.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No grade entries found.</Text>
                </View>
              ) : (
                <FlatList
                  data={grades}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const percent = getGradePercent(item.score, item.max_score);
                    return (
                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <View>
                            <Text style={styles.titleText}>{item.title}</Text>
                            <Text style={styles.termText}>Term: {item.term}</Text>
                          </View>
                          
                          <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(percent) }]}>
                            <Text style={styles.scoreBadgeText}>{percent}%</Text>
                          </View>
                        </View>

                        <View style={styles.cardContent}>
                          <Text style={styles.scoreText}>{item.score}/{item.max_score}</Text>
                          
                          <View>
                            <Text style={styles.classText}>{item.class?.name || 'Unknown Class'}</Text>
                            <Text style={styles.gradeLevelText}>{item.class?.grade_level || ''}</Text>
                          </View>
                          
                          {item.class?.teacher?.full_name && (
                            <Text style={styles.teacherText}>Teacher: {item.class.teacher.full_name}</Text>
                          )}
                        </View>

                        <Text style={styles.dateText}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    );
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  loader: {
    marginTop: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.surfaceAlt,
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
    backgroundColor: COLORS.primaryDark,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  studentSelector: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  studentButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  studentButtonText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  studentButtonTextSelected: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 20,
  },
  overallGradeCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  overallGradeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  overallGradeValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  overallGradePercent: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  overallGradeCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  termSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  termButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  termButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termButtonText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  termButtonTextActive: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  termText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  scoreBadgeText: {
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  classText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  gradeLevelText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  teacherText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});