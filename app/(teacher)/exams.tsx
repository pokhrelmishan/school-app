import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  Card,
  Badge,
  PillSelector,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  InfoRow,
  Divider,
} from '../../lib/components';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

interface TeachClass {
  id: string;
  name: string;
  grade_level: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  name: string;
  term: string;
  exam_date: string;
  max_score: number;
  passing_score: number;
  class_id: string;
  subject_id: string;
  created_by: string;
  class_name?: string;
  subject_name?: string;
}

interface ExamResult {
  id: string;
  student_id: string;
  score: number;
  grade_letter: string;
  remarks: string;
  full_name?: string;
  roll_number?: string;
}

export default function TeacherExamsScreen() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [formName, setFormName] = useState('');
  const [formTerm, setFormTerm] = useState('Term 1');
  const [formDate, setFormDate] = useState('');
  const [formMaxScore, setFormMaxScore] = useState('100');
  const [formPassingScore, setFormPassingScore] = useState('40');
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [classTeacherRes, subjectRes, examsRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, grade_level')
          .eq('teacher_id', user.id),
        supabase
          .from('teacher_subjects')
          .select('class_id, subjects(id, name), classes(id, name, grade_level)')
          .eq('teacher_id', user.id),
        supabase
          .from('exams')
          .select('*, classes(name), subjects(name)')
          .eq('school_id', profile?.school_id || '')
          .order('exam_date', { ascending: false }),
      ]);

      const classIds = new Set<string>();
      const merged: TeachClass[] = [];

      if (classTeacherRes.data) {
        for (const c of classTeacherRes.data) {
          classIds.add(c.id);
          merged.push({ id: c.id, name: c.name, grade_level: c.grade_level });
        }
      }

      const subjectSet = new Map<string, SubjectOption>();

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const ci = s.classes as any;
          const si = s.subjects as any;
          if (ci && !classIds.has(s.class_id)) {
            classIds.add(s.class_id);
            merged.push({ id: ci.id, name: ci.name, grade_level: ci.grade_level });
          }
          if (si) {
            subjectSet.set(si.id, { id: si.id, name: si.name });
          }
        }
      }

      setClasses(merged);
      setSubjects(Array.from(subjectSet.values()));

      const teacherClassIds = new Set(merged.map((c) => c.id));
      const examList: Exam[] = (examsRes.data || [])
        .filter((e: any) => teacherClassIds.has(e.class_id))
        .map((e: any) => ({
          id: e.id,
          name: e.name,
          term: e.term,
          exam_date: e.exam_date,
          max_score: e.max_score,
          passing_score: e.passing_score,
          class_id: e.class_id,
          subject_id: e.subject_id,
          created_by: e.created_by,
          class_name: e.classes?.name,
          subject_name: e.subjects?.name,
        }));

      setExams(examList);
    } catch (err) {
      console.error('Error fetching exams data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, profile?.school_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormName('');
    setFormTerm('Term 1');
    setFormDate('');
    setFormMaxScore('100');
    setFormPassingScore('40');
    setFormClassId('');
    setFormSubjectId('');
  };

  const handleCreateExam = async () => {
    if (!formName.trim() || !formDate.trim() || !formClassId || !formSubjectId) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const max = parseInt(formMaxScore, 10);
    const pass = parseInt(formPassingScore, 10);
    if (isNaN(max) || isNaN(pass) || max <= 0 || pass < 0) {
      Alert.alert('Invalid Scores', 'Please enter valid max and passing scores.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('exams').insert({
        name: formName.trim(),
        term: formTerm,
        exam_date: formDate.trim(),
        max_score: max,
        passing_score: pass,
        class_id: formClassId,
        subject_id: formSubjectId,
        school_id: profile?.school_id,
        created_by: user?.id,
      });

      if (error) throw error;

      Alert.alert('Success', 'Exam created successfully.');
      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResults = async (exam: Exam) => {
    setSelectedExam(exam);
    setShowResultsModal(true);
    setResultsLoading(true);

    try {
      const enrollmentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(full_name, roll_number)')
        .eq('class_id', exam.class_id);

      const resultsRes = await supabase
        .from('exam_results')
        .select('*')
        .eq('exam_id', exam.id);

      const resultsMap = new Map<string, any>();
      if (resultsRes.data) {
        for (const r of resultsRes.data) {
          resultsMap.set(r.student_id, r);
        }
      }

      const merged: ExamResult[] = (enrollmentRes.data || []).map((e: any) => {
        const r = resultsMap.get(e.student_id);
        const prof = e.profiles as any;
        return {
          id: r?.id || '',
          student_id: e.student_id,
          score: r?.score ?? 0,
          grade_letter: r?.grade_letter || '-',
          remarks: r?.remarks || '',
          full_name: prof?.full_name || 'Unknown',
          roll_number: prof?.roll_number || '',
        };
      });

      merged.sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || ''));
      setResults(merged);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setResultsLoading(false);
    }
  };

  const getScoreColor = (score: number, max: number, passing: number) => {
    const pct = (score / max) * 100;
    if (pct >= 75) return COLORS.success;
    if (pct >= passing / max * 100) return COLORS.warning;
    return COLORS.danger;
  };

  if (loading) return <LoadingScreen text="Loading exams..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <PageHeader
        title="Exams"
        subtitle="Manage and view exam results"
        right={
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.7}
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      {exams.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No Exams"
          subtitle="No exams have been created for your classes yet."
          action={{
            label: 'Create Exam',
            onPress: () => {
              resetForm();
              setShowCreateModal(true);
            },
          }}
        />
      ) : (
        <>
          <SectionHeader title="Recent Exams" />
          {exams.map((exam) => (
            <Card key={exam.id}>
              <View style={styles.examHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.examName}>{exam.name}</Text>
                  <Text style={styles.examSub}>
                    {exam.class_name} · {exam.subject_name}
                  </Text>
                </View>
                <Badge text={exam.term} color={COLORS.primary} />
              </View>
              <View style={styles.examMeta}>
                <InfoRow label="Date" value={exam.exam_date} icon="📅" />
                <InfoRow label="Max Score" value={`${exam.max_score}`} icon="📊" />
                <InfoRow label="Passing Score" value={`${exam.passing_score}`} icon="✅" />
              </View>
              {exam.created_by === user?.id && (
                <TouchableOpacity
                  style={styles.resultsBtn}
                  activeOpacity={0.7}
                  onPress={() => handleViewResults(exam)}
                >
                  <Text style={styles.resultsBtnText}>View Results</Text>
                </TouchableOpacity>
              )}
            </Card>
          ))}
        </>
      )}

      <View style={{ height: 32 }} />

      {/* Create Exam Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Exam</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Exam Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Midterm Math"
              placeholderTextColor={COLORS.textTertiary}
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.label}>Term</Text>
            <PillSelector items={TERMS} selected={formTerm} onSelect={setFormTerm} />

            <Text style={styles.label}>Exam Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textTertiary}
              value={formDate}
              onChangeText={setFormDate}
            />

            <Text style={styles.label}>Max Score</Text>
            <TextInput
              style={styles.input}
              placeholder="100"
              placeholderTextColor={COLORS.textTertiary}
              value={formMaxScore}
              onChangeText={setFormMaxScore}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Passing Score</Text>
            <TextInput
              style={styles.input}
              placeholder="40"
              placeholderTextColor={COLORS.textTertiary}
              value={formPassingScore}
              onChangeText={setFormPassingScore}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Class</Text>
            <View style={styles.optionRow}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.optionChip, formClassId === cls.id && styles.optionChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setFormClassId(cls.id)}
                >
                  <Text style={[styles.optionText, formClassId === cls.id && styles.optionTextActive]}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Subject</Text>
            <View style={styles.optionRow}>
              {subjects.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.optionChip, formSubjectId === sub.id && styles.optionChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setFormSubjectId(sub.id)}
                >
                  <Text style={[styles.optionText, formSubjectId === sub.id && styles.optionTextActive]}>
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton
              title="Create Exam"
              onPress={handleCreateExam}
              loading={submitting}
              disabled={submitting}
              icon="📝"
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Results Modal */}
      <Modal visible={showResultsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowResultsModal(false)}>
            <Text style={styles.modalCancel}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {selectedExam?.name || 'Results'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {resultsLoading ? (
            <LoadingScreen text="Loading results..." />
          ) : results.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No Results"
              subtitle="No students enrolled or no results entered yet."
            />
          ) : (
            <>
              <Card>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{results.length}</Text>
                    <Text style={styles.summaryLabel}>Students</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                      {results.filter((r) => (r.score / (selectedExam?.max_score || 1)) * 100 >= 75).length}
                    </Text>
                    <Text style={styles.summaryLabel}>Passed</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
                      {results.filter((r) => (r.score / (selectedExam?.max_score || 1)) * 100 < 75).length}
                    </Text>
                    <Text style={styles.summaryLabel}>Needs Work</Text>
                  </View>
                </View>
              </Card>

              {results.map((r) => (
                <Card key={r.student_id}>
                  <View style={styles.resultRow}>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{r.full_name}</Text>
                      {r.roll_number ? (
                        <Text style={styles.resultRoll}>Roll #{r.roll_number}</Text>
                      ) : null}
                    </View>
                    <View style={styles.resultScore}>
                      <Text
                        style={[
                          styles.resultScoreText,
                          {
                            color: getScoreColor(
                              r.score,
                              selectedExam?.max_score || 100,
                              selectedExam?.passing_score || 40,
                            ),
                          },
                        ]}
                      >
                        {r.score}/{selectedExam?.max_score}
                      </Text>
                      {r.grade_letter !== '-' && (
                        <Badge
                          text={r.grade_letter}
                          color={getScoreColor(
                            r.score,
                            selectedExam?.max_score || 100,
                            selectedExam?.passing_score || 40,
                          )}
                          size="md"
                        />
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: COLORS.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  examName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  examSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  examMeta: {
    marginBottom: 12,
  },
  resultsBtn: {
    backgroundColor: COLORS.primaryBg,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  resultsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Modal */
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  modalCancel: {
    fontSize: 15,
    color: COLORS.danger,
    fontWeight: '600',
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionChipActive: {
    backgroundColor: COLORS.primaryBg,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionTextActive: {
    color: COLORS.primary,
  },

  /* Results */
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  resultRoll: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultScore: {
    alignItems: 'flex-end',
    gap: 4,
  },
  resultScoreText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
