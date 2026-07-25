import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, Badge, PillSelector, EmptyState, LoadingScreen } from '../../lib/components';

interface Exam {
  id: string;
  name: string;
  term: string;
  exam_date: string;
  max_score: number;
  passing_score: number;
  class?: { name: string };
  subject?: { name: string };
}

interface ExamResult {
  id: string;
  exam_id: string;
  score: number;
  grade_letter: string;
  remarks: string;
  exam?: { name: string; term: string; max_score: number; subject?: { name: string } };
}

export default function StudentExamsScreen() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming');

  const fetchData = async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const [examRes, resultRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, name, term, exam_date, max_score, passing_score, class:classes(name), subject:subjects(name)')
        .order('exam_date', { ascending: true }),
      supabase
        .from('exam_results')
        .select('id, exam_id, score, grade_letter, remarks, exam:exams(name, term, max_score, subject:subjects(name))')
        .eq('student_id', user.id)
        .order('exam_id'),
    ]);

    if (examRes.data) {
      setExams(
        examRes.data.map((e: any) => ({
          ...e,
          class: Array.isArray(e.class) ? e.class[0] : e.class,
          subject: Array.isArray(e.subject) ? e.subject[0] : e.subject,
        }))
      );
    }

    if (resultRes.data) {
      setResults(
        resultRes.data.map((r: any) => ({
          ...r,
          exam: (() => {
            const e = Array.isArray(r.exam) ? r.exam[0] : r.exam;
            if (!e) return undefined;
            return {
              ...e,
              subject: Array.isArray(e.subject) ? e.subject[0] : e.subject,
            };
          })(),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const resultIds = new Set(results.map((r) => r.exam_id));
  const upcomingExams = exams.filter(
    (e) => !resultIds.has(e.id) && new Date(e.exam_date) >= new Date(new Date().toDateString())
  );
  const pastExams = exams.filter(
    (e) => resultIds.has(e.id) || new Date(e.exam_date) < new Date(new Date().toDateString())
  );

  const terms = Array.from(new Set<string>([...exams.map((e) => e.term), ...results.map((r) => r.exam?.term).filter((t): t is string => !!t)]));
  const [selectedTerm, setSelectedTerm] = useState<string>('All');
  const allTerms = ['All', ...terms];

  const filteredUpcoming = selectedTerm === 'All' ? upcomingExams : upcomingExams.filter((e) => e.term === selectedTerm);
  const filteredResults = selectedTerm === 'All' ? results : results.filter((r) => r.exam?.term === selectedTerm);

  const scoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 70) return COLORS.success;
    if (pct >= 50) return COLORS.warning;
    return COLORS.danger;
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntil = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Past';
    if (diff === 0) return 'Today';
    return `${diff}d`;
  };

  if (loading) return <LoadingScreen text="Loading exams..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
    >
      <PageHeader title="Exams" subtitle={`${exams.length} total · ${results.length} completed`} />

      {terms.length > 0 && (
        <PillSelector items={allTerms} selected={selectedTerm} onSelect={setSelectedTerm} />
      )}

      <View style={styles.tabRow}>
        <View
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]} onPress={() => setTab('upcoming')}>
            Upcoming ({filteredUpcoming.length})
          </Text>
        </View>
        <View
          style={[styles.tab, tab === 'results' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'results' && styles.tabTextActive]} onPress={() => setTab('results')}>
            Results ({filteredResults.length})
          </Text>
        </View>
      </View>

      {tab === 'upcoming' && (
        filteredUpcoming.length === 0 ? (
          <EmptyState icon="📝" title="No upcoming exams" subtitle="You're all caught up!" />
        ) : (
          filteredUpcoming.map((exam) => {
            const d = daysUntil(exam.exam_date);
            const urgent = d !== 'Past' && d !== 'Today' && parseInt(d) <= 7;
            return (
              <Card key={exam.id} style={styles.examCard}>
                <View style={styles.examTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.examName}>{exam.name}</Text>
                    <Text style={styles.examMeta}>{exam.subject?.name || 'Subject'} · {exam.term}</Text>
                  </View>
                  <Badge
                    text={d}
                    color={d === 'Today' ? COLORS.danger : urgent ? COLORS.warning : COLORS.textSecondary}
                    size="md"
                  />
                </View>
                <View style={styles.examDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{formatDate(exam.exam_date)}</Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Max Score</Text>
                    <Text style={styles.detailValue}>{exam.max_score}</Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Passing</Text>
                    <Text style={styles.detailValue}>{exam.passing_score}</Text>
                  </View>
                </View>
              </Card>
            );
          })
        )
      )}

      {tab === 'results' && (
        filteredResults.length === 0 ? (
          <EmptyState icon="📊" title="No results yet" subtitle="Results will appear after exams" />
        ) : (
          filteredResults.map((result) => {
            const maxScore = result.exam?.max_score || 100;
            const pct = Math.round((result.score / maxScore) * 100);
            const c = scoreColor(result.score, maxScore);
            return (
              <Card key={result.id} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{result.exam?.name || 'Exam'}</Text>
                    <Text style={styles.resultMeta}>{result.exam?.subject?.name || 'Subject'} · {result.exam?.term}</Text>
                  </View>
                  <View style={[styles.scoreCircle, { borderColor: c }]}>
                    <Text style={[styles.scoreText, { color: c }]}>{pct}%</Text>
                  </View>
                </View>
                <View style={styles.resultRow}>
                  <View style={styles.resultCol}>
                    <Text style={styles.resultLabel}>Score</Text>
                    <Text style={styles.resultValue}>{result.score} / {maxScore}</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultCol}>
                    <Text style={styles.resultLabel}>Grade</Text>
                    <Badge text={result.grade_letter || '—'} color={c} size="md" />
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultCol}>
                    <Text style={styles.resultLabel}>Status</Text>
                    <Badge
                      text={result.score >= (result.exam?.max_score ? Math.round(result.exam.max_score * 0.5) : 0) ? 'Pass' : 'Fail'}
                      color={result.score >= (result.exam?.max_score ? Math.round(result.exam.max_score * 0.5) : 0) ? COLORS.success : COLORS.danger}
                      size="md"
                    />
                  </View>
                </View>
                {result.remarks ? (
                  <Text style={styles.remarks}>💬 {result.remarks}</Text>
                ) : null}
              </Card>
            );
          })
        )
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },

  examCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  examTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  examName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  examMeta: { fontSize: 13, color: COLORS.textSecondary },
  examDetails: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 12,
  },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  detailDivider: { width: 1, backgroundColor: COLORS.border },

  resultCard: { borderLeftWidth: 4, borderLeftColor: COLORS.success },
  resultTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  resultMeta: { fontSize: 13, color: COLORS.textSecondary },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  scoreText: { fontSize: 16, fontWeight: '800' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 12,
  },
  resultCol: { flex: 1, alignItems: 'center' },
  resultLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  resultValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  resultDivider: { width: 1, backgroundColor: COLORS.border },
  remarks: { fontSize: 13, color: COLORS.textSecondary, marginTop: 10, fontStyle: 'italic' },
});
