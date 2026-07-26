import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
  PillSelector,
  SectionHeader,
} from '../../lib/components';

interface Exam {
  id: string;
  name: string;
  term: string;
  exam_date: string;
  max_score: number;
  passing_score: number;
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

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);

    const [examRes, resultRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, name, term, exam_date, max_score, passing_score, subject:subjects(name)')
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
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const terms = Array.from(
    new Set<string>([
      ...exams.map((e) => e.term),
      ...results.map((r) => r.exam?.term).filter((t): t is string => !!t),
    ])
  );
  const [selectedTerm, setSelectedTerm] = useState('All');
  const allTerms = ['All', ...terms];

  const resultIds = new Set(results.map((r) => r.exam_id));
  const upcoming = exams.filter(
    (e) => !resultIds.has(e.id) && new Date(e.exam_date) >= new Date(new Date().toDateString())
  );
  const completed = results;

  const filteredUpcoming =
    selectedTerm === 'All' ? upcoming : upcoming.filter((e) => e.term === selectedTerm);
  const filteredCompleted =
    selectedTerm === 'All' ? completed : completed.filter((r) => r.exam?.term === selectedTerm);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.tape}
          colors={[COLORS.tape]}
        />
      }
    >
      <ScreenHeader title="Exams" />

      <View style={styles.body}>
        {allTerms.length > 1 && (
          <PillSelector
            items={allTerms}
            selected={selectedTerm}
            onSelect={setSelectedTerm}
          />
        )}

        <SectionHeader title="Upcoming" />
        {filteredUpcoming.length === 0 ? (
          <NotebookCard>
            <EmptyState icon="📝" title="No upcoming exams" subtitle={"You're all caught up!"} />
          </NotebookCard>
        ) : (
          filteredUpcoming.map((exam) => {
            const d = daysUntil(exam.exam_date);
            const urgent = d !== 'Past' && d !== 'Today' && parseInt(d) <= 7;
            return (
              <NotebookCard key={exam.id} accent={COLORS.blue}>
                <View style={styles.examTop}>
                  <View style={styles.examInfo}>
                    <Text style={styles.examName}>{exam.name}</Text>
                    <Text style={styles.examMeta}>
                      {exam.subject?.name || 'Subject'} · {exam.term}
                    </Text>
                    <Text style={styles.examDate}>{formatDate(exam.exam_date)}</Text>
                  </View>
                  <View style={styles.examRight}>
                    <Badge
                      text={d}
                      color={
                        d === 'Today'
                          ? COLORS.danger
                          : urgent
                          ? COLORS.pencil
                          : COLORS.graphite
                      }
                      size="md"
                    />
                  </View>
                </View>
                <View style={styles.examStats}>
                  <View style={styles.examStat}>
                    <Text style={styles.examStatLabel}>Max Score</Text>
                    <Text style={styles.examStatValue}>{exam.max_score}</Text>
                  </View>
                  <View style={styles.examStatDivider} />
                  <View style={styles.examStat}>
                    <Text style={styles.examStatLabel}>Passing</Text>
                    <Text style={styles.examStatValue}>{exam.passing_score}</Text>
                  </View>
                </View>
              </NotebookCard>
            );
          })
        )}

        <SectionHeader title="Results" />
        {filteredCompleted.length === 0 ? (
          <NotebookCard>
            <EmptyState icon="📊" title="No results yet" subtitle="Results appear after exams" />
          </NotebookCard>
        ) : (
          filteredCompleted.map((result) => {
            const maxScore = result.exam?.max_score || 100;
            const pct = Math.round((result.score / maxScore) * 100);
            const c =
              pct >= 70 ? COLORS.chalk : pct >= 50 ? COLORS.pencil : COLORS.danger;

            return (
              <NotebookCard key={result.id} accent={c}>
                <View style={styles.resultTop}>
                  <View style={[styles.gradeSquare, { borderColor: c }]}>
                    <Text style={[styles.gradeLetter, { color: c }]}>
                      {result.grade_letter || '—'}
                    </Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>
                      {result.exam?.name || 'Exam'}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {result.exam?.subject?.name || 'Subject'} · {result.exam?.term}
                    </Text>
                  </View>
                  <Badge
                    text={`${pct}%`}
                    color={c}
                    size="md"
                  />
                </View>
                <View style={styles.resultStats}>
                  <View style={styles.examStat}>
                    <Text style={styles.examStatLabel}>Score</Text>
                    <Text style={styles.examStatValue}>
                      {result.score} / {maxScore}
                    </Text>
                  </View>
                  <View style={styles.examStatDivider} />
                  <View style={styles.examStat}>
                    <Text style={styles.examStatLabel}>Status</Text>
                    <Badge
                      text={result.score >= Math.round(maxScore * 0.5) ? 'Pass' : 'Fail'}
                      color={
                        result.score >= Math.round(maxScore * 0.5)
                          ? COLORS.chalk
                          : COLORS.danger
                      }
                      size="md"
                    />
                  </View>
                </View>
                {result.remarks ? (
                  <Text style={styles.remarks}>{result.remarks}</Text>
                ) : null}
              </NotebookCard>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    padding: 20,
  },

  examTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  examMeta: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  examDate: {
    fontSize: 12,
    color: COLORS.graphiteLight,
    marginTop: 2,
  },
  examRight: {
    marginLeft: 12,
  },

  examStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperDim,
    borderRadius: 10,
    paddingVertical: 10,
  },
  examStat: {
    flex: 1,
    alignItems: 'center',
  },
  examStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  examStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  examStatDivider: {
    width: 1,
    backgroundColor: COLORS.line,
  },

  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginRight: 12,
  },
  gradeLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  resultMeta: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  resultStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperDim,
    borderRadius: 10,
    paddingVertical: 10,
  },

  remarks: {
    fontSize: 13,
    color: COLORS.graphite,
    marginTop: 10,
    fontStyle: 'italic',
  },
});
