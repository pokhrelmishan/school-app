import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
} from '../../lib/components';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

interface ExamItem {
  id: string;
  name: string;
  term: string;
  exam_date: string;
  max_score: number;
  passing_score: number;
  class_id: string;
  subject_id: string;
  class_name: string;
  subject_name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  grade_letter: string;
  remarks: string;
  student_name: string;
}

export default function ExamsScreen() {
  const { profile, user } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('All');

  const [formName, setFormName] = useState('');
  const [formTerm, setFormTerm] = useState('Term 1');
  const [formDate, setFormDate] = useState('');
  const [formMaxScore, setFormMaxScore] = useState('100');
  const [formPassingScore, setFormPassingScore] = useState('40');
  const [formClassId, setFormClassId] = useState<string | null>(null);
  const [formSubjectId, setFormSubjectId] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  const fetchData = useCallback(async () => {
    if (!schoolId) return;

    const [classRes, subjectRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    ]);

    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);

    const classMap: Record<string, string> = {};
    if (classRes.data) {
      for (const c of classRes.data) classMap[c.id] = c.name;
    }
    const subjectMap: Record<string, string> = {};
    if (subjectRes.data) {
      for (const s of subjectRes.data) subjectMap[s.id] = s.name;
    }

    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', schoolId)
      .order('exam_date', { ascending: false });

    if (examData) {
      setExams(
        examData.map((e) => ({
          ...e,
          class_name: classMap[e.class_id] || 'Unknown',
          subject_name: subjectMap[e.subject_id] || 'Unknown',
        }))
      );
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const filteredExams =
    selectedTerm === 'All' ? exams : exams.filter((e) => e.term === selectedTerm);

  const groupedByClass: Record<string, ExamItem[]> = {};
  for (const e of filteredExams) {
    if (!groupedByClass[e.class_name]) groupedByClass[e.class_name] = [];
    groupedByClass[e.class_name].push(e);
  }

  const openCreateModal = () => {
    setFormName('');
    setFormTerm('Term 1');
    setFormDate('');
    setFormMaxScore('100');
    setFormPassingScore('40');
    setFormClassId(null);
    setFormSubjectId(null);
    setCreateModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      Alert.alert('Missing fields', 'Please enter an exam name.');
      return;
    }
    if (!formClassId || !formSubjectId) {
      Alert.alert('Missing fields', 'Please select a class and subject.');
      return;
    }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('exams').insert({
        name: formName.trim(),
        term: formTerm,
        exam_date: formDate.trim() || null,
        max_score: Number(formMaxScore) || 100,
        passing_score: Number(formPassingScore) || 40,
        class_id: formClassId,
        subject_id: formSubjectId,
        school_id: schoolId,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setCreateModalVisible(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const openResults = async (exam: ExamItem) => {
    setSelectedExam(exam);
    setResultsLoading(true);
    setResultsModalVisible(true);

    const { data: resultData } = await supabase
      .from('exam_results')
      .select('*')
      .eq('exam_id', exam.id);

    if (resultData) {
      const studentIds = [...new Set(resultData.map((r) => r.student_id))];
      let studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);
        if (profiles) {
          for (const p of profiles) studentMap[p.id] = p.full_name;
        }
      }
      setExamResults(
        resultData.map((r) => ({
          ...r,
          student_name: studentMap[r.student_id] || 'Unknown',
        }))
      );
    } else {
      setExamResults([]);
    }
    setResultsLoading(false);
  };

  const handleDeleteExam = (exam: ExamItem) => {
    Alert.alert('Delete Exam', `Delete "${exam.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('exam_results').delete().eq('exam_id', exam.id);
          await supabase.from('exams').delete().eq('id', exam.id);
          fetchData();
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen text="Loading exams..." />;

  const termPills = ['All', ...TERMS];
  const classNames = Object.keys(groupedByClass);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <PageHeader
          title="Exams"
          subtitle={`${exams.length} total`}
          right={<PrimaryButton title="New" icon="+" onPress={openCreateModal} />}
        />

        <PillSelector items={termPills} selected={selectedTerm} onSelect={setSelectedTerm} />

        {filteredExams.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No Exams Found"
            subtitle="Create your first exam to get started."
            action={{ label: 'Create Exam', onPress: openCreateModal }}
          />
        ) : (
          classNames.map((className) => (
            <View key={className} style={styles.section}>
              <Text style={styles.sectionTitle}>{className}</Text>
              {groupedByClass[className].map((exam) => (
                <Card key={exam.id} style={styles.examCard}>
                  <TouchableOpacity
                    style={styles.examRow}
                    activeOpacity={0.7}
                    onLongPress={() => handleDeleteExam(exam)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.examHeader}>
                        <Text style={styles.examName}>{exam.name}</Text>
                        <Badge text={exam.term} color={COLORS.primary} />
                      </View>
                      <Text style={styles.examMeta}>
                        {exam.subject_name}
                        {exam.exam_date ? ` · ${exam.exam_date}` : ''}
                      </Text>
                      <Text style={styles.examScore}>
                        Max: {exam.max_score} · Pass: {exam.passing_score}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resultsBtn}
                      onPress={() => openResults(exam)}
                    >
                      <Text style={styles.resultsBtnText}>Results</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Exam Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Exam</Text>

            <Text style={styles.label}>Exam Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mid-Term Exam"
              placeholderTextColor={COLORS.textTertiary}
              value={formName}
              onChangeText={setFormName}
              autoFocus
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

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Max Score</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  placeholderTextColor={COLORS.textTertiary}
                  value={formMaxScore}
                  onChangeText={setFormMaxScore}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Passing Score</Text>
                <TextInput
                  style={styles.input}
                  placeholder="40"
                  placeholderTextColor={COLORS.textTertiary}
                  value={formPassingScore}
                  onChangeText={setFormPassingScore}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Class</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => {
                Alert.alert('Select Class', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  ...classes.map((c) => ({
                    text: c.name,
                    onPress: () => setFormClassId(c.id),
                  })),
                ]);
              }}
            >
              <Text style={[styles.pickerText, !formClassId && { color: COLORS.textTertiary }]}>
                {formClassId ? classes.find((c) => c.id === formClassId)?.name || 'Unknown' : 'Tap to select'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Subject</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => {
                Alert.alert('Select Subject', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  ...subjects.map((s) => ({
                    text: s.name,
                    onPress: () => setFormSubjectId(s.id),
                  })),
                ]);
              }}
            >
              <Text style={[styles.pickerText, !formSubjectId && { color: COLORS.textTertiary }]}>
                {formSubjectId ? subjects.find((s) => s.id === formSubjectId)?.name || 'Unknown' : 'Tap to select'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Create Exam</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Results Modal */}
      <Modal visible={resultsModalVisible} animationType="slide" transparent onRequestClose={() => setResultsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setResultsModalVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{selectedExam?.name} Results</Text>

            {resultsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
            ) : examResults.length === 0 ? (
              <Text style={styles.emptyResults}>No results recorded yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                {examResults.map((r) => (
                  <View key={r.id} style={styles.resultRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{r.student_name}</Text>
                      {r.remarks ? <Text style={styles.resultRemarks}>{r.remarks}</Text> : null}
                    </View>
                    <View style={styles.resultScoreCol}>
                      <Text style={styles.resultScore}>{r.score}</Text>
                      <Badge
                        text={r.grade_letter || '-'}
                        color={r.score >= (selectedExam?.passing_score ?? 0) ? COLORS.success : COLORS.danger}
                        size="md"
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setResultsModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  examCard: {
    padding: 14,
  },
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  examName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  examMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  examScore: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  resultsBtn: {
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  resultsBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  pickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  pickerChevron: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  emptyResults: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  resultRemarks: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultScoreCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  resultScore: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'right',
  },
});
