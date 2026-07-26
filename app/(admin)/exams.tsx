import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  PillSelector,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

interface ExamItem {
  id: string; name: string; term: string; exam_date: string; max_score: number; passing_score: number;
  class_id: string; subject_id: string; class_name: string; subject_name: string;
}
interface ClassItem { id: string; name: string; }
interface SubjectItem { id: string; name: string; }
interface ExamResult {
  id: string; exam_id: string; student_id: string; score: number; grade_letter: string; remarks: string; student_name: string;
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
    if (classRes.data) for (const c of classRes.data) classMap[c.id] = c.name;
    const subjectMap: Record<string, string> = {};
    if (subjectRes.data) for (const s of subjectRes.data) subjectMap[s.id] = s.name;

    const { data: examData } = await supabase.from('exams').select('*').eq('school_id', schoolId).order('exam_date', { ascending: false });
    if (examData) {
      setExams(examData.map((e) => ({ ...e, class_name: classMap[e.class_id] || 'Unknown', subject_name: subjectMap[e.subject_id] || 'Unknown' })));
    }
  }, [schoolId]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  const filteredExams = selectedTerm === 'All' ? exams : exams.filter((e) => e.term === selectedTerm);

  const groupedByClass: Record<string, ExamItem[]> = {};
  for (const e of filteredExams) {
    if (!groupedByClass[e.class_name]) groupedByClass[e.class_name] = [];
    groupedByClass[e.class_name].push(e);
  }

  const openCreateModal = () => {
    setFormName(''); setFormTerm('Term 1'); setFormDate(''); setFormMaxScore('100'); setFormPassingScore('40');
    setFormClassId(null); setFormSubjectId(null);
    setCreateModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) { Alert.alert('Missing', 'Enter exam name.'); return; }
    if (!formClassId || !formSubjectId) { Alert.alert('Missing', 'Select class and subject.'); return; }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('exams').insert({
        name: formName.trim(), term: formTerm, exam_date: formDate.trim() || null,
        max_score: Number(formMaxScore) || 100, passing_score: Number(formPassingScore) || 40,
        class_id: formClassId, subject_id: formSubjectId, school_id: schoolId, created_by: user?.id ?? null,
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

    const { data: resultData } = await supabase.from('exam_results').select('*').eq('exam_id', exam.id);
    if (resultData) {
      const studentIds = [...new Set(resultData.map((r) => r.student_id))];
      let studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
        if (profiles) for (const p of profiles) studentMap[p.id] = p.full_name;
      }
      setExamResults(resultData.map((r) => ({ ...r, student_name: studentMap[r.student_id] || 'Unknown' })));
    } else {
      setExamResults([]);
    }
    setResultsLoading(false);
  };

  const handleDeleteExam = (exam: ExamItem) => {
    Alert.alert('Delete Exam', `Delete "${exam.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('exam_results').delete().eq('exam_id', exam.id);
        await supabase.from('exams').delete().eq('id', exam.id);
        await fetchData();
      }},
    ]);
  };

  if (loading) return <LoadingScreen text="Loading exams..." />;

  const termPills = ['All', ...TERMS];
  const classNames = Object.keys(groupedByClass);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Exams" subtitle={`${exams.length} total`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        <PillSelector items={termPills} selected={selectedTerm} onSelect={setSelectedTerm} />

        {filteredExams.length === 0 ? (
          <EmptyState icon={'\u{1F4DD}'} title="No Exams Found" subtitle="Create your first exam." action={{ label: 'Create Exam', onPress: openCreateModal }} />
        ) : (
          classNames.map((className) => (
            <View key={className} style={styles.section}>
              <SectionHeader title={className} />
              {groupedByClass[className].map((exam) => (
                <TouchableOpacity key={exam.id} activeOpacity={0.7} onLongPress={() => handleDeleteExam(exam)}>
                  <NotebookCard accent={COLORS.tape}>
                    <View style={styles.examRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.examHeader}>
                          <Text style={styles.examName}>{exam.name}</Text>
                          <Badge text={exam.term} color={COLORS.chalk} />
                        </View>
                        <Text style={styles.examMeta}>{exam.subject_name}{exam.exam_date ? ` \u00B7 ${exam.exam_date}` : ''}</Text>
                        <Text style={styles.examScore}>Max: {exam.max_score} \u00B7 Pass: {exam.passing_score}</Text>
                      </View>
                      <PrimaryButton title="Results" onPress={() => openResults(exam)} />
                    </View>
                  </NotebookCard>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Exam</Text>
            <Text style={styles.label}>Exam Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Mid-Term Exam" placeholderTextColor={COLORS.graphiteLight} value={formName} onChangeText={setFormName} autoFocus />
            <Text style={styles.label}>Term</Text>
            <PillSelector items={TERMS} selected={formTerm} onSelect={setFormTerm} />
            <Text style={styles.label}>Exam Date</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.graphiteLight} value={formDate} onChangeText={setFormDate} />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Max Score</Text>
                <TextInput style={styles.input} placeholder="100" placeholderTextColor={COLORS.graphiteLight} value={formMaxScore} onChangeText={setFormMaxScore} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Passing Score</Text>
                <TextInput style={styles.input} placeholder="40" placeholderTextColor={COLORS.graphiteLight} value={formPassingScore} onChangeText={setFormPassingScore} keyboardType="number-pad" />
              </View>
            </View>
            <Text style={styles.label}>Class</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Class', undefined, [{ text: 'Cancel', style: 'cancel' }, ...classes.map((c) => ({ text: c.name, onPress: () => setFormClassId(c.id) }))])}>
              <Text style={[styles.pickerText, !formClassId && { color: COLORS.graphiteLight }]}>{formClassId ? classes.find((c) => c.id === formClassId)?.name || 'Unknown' : 'Tap to select'}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Subject</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => Alert.alert('Select Subject', undefined, [{ text: 'Cancel', style: 'cancel' }, ...subjects.map((s) => ({ text: s.name, onPress: () => setFormSubjectId(s.id) }))])}>
              <Text style={[styles.pickerText, !formSubjectId && { color: COLORS.graphiteLight }]}>{formSubjectId ? subjects.find((s) => s.id === formSubjectId)?.name || 'Unknown' : 'Tap to select'}</Text>
              <Text style={styles.pickerChevron}>{'\u25BC'}</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Create Exam" onPress={handleCreate} disabled={submitting} loading={submitting} />
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
              <EmptyState icon={''} title="Loading results..." />
            ) : examResults.length === 0 ? (
              <EmptyState icon={'\u{1F4CB}'} title="No results recorded yet." />
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
                        color={r.score >= (selectedExam?.passing_score ?? 0) ? COLORS.chalk : COLORS.danger}
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
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 16, paddingBottom: 100 },

  section: { marginBottom: 12 },
  examRow: { flexDirection: 'row', alignItems: 'center' },
  examHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  examName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  examMeta: { fontSize: 12, color: COLORS.graphite },
  examScore: { fontSize: 11, color: COLORS.graphiteLight, marginTop: 4 },

  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.cover, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: COLORS.paper, lineHeight: 30 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.graphite, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.ink, marginBottom: 12 },
  row: { flexDirection: 'row' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  pickerText: { fontSize: 14, color: COLORS.ink },
  pickerChevron: { fontSize: 12, color: COLORS.graphiteLight },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.graphite },

  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  resultName: { fontSize: 13, fontWeight: '500', color: COLORS.ink },
  resultRemarks: { fontSize: 11, color: COLORS.graphite, marginTop: 2 },
  resultScoreCol: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  resultScore: { fontSize: 15, fontWeight: '700', color: COLORS.ink, minWidth: 30, textAlign: 'right' },
});
