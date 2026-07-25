import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface GradeEntry {
  id: string;
  title: string;
  subject_name: string | null;
  theory_score: number | null;
  practical_score: number | null;
  theory_max: number;
  practical_max: number;
  score: number;
  max_score: number;
  term: string;
  created_at: string;
  class?: { name: string; grade_level: string };
}

export default function StudentGradesScreen() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const fetchGrades = async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    let q = supabase
      .from('grade_entries')
      .select('id, title, subject_name, theory_score, practical_score, theory_max, practical_max, score, max_score, term, created_at, class:classes(name, grade_level)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });
    if (selectedTerm) q = q.eq('term', selectedTerm);
    const { data } = await q;
    if (data) setGrades(data as unknown as GradeEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchGrades(); }, [user?.id, selectedTerm]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGrades(true);
    setRefreshing(false);
  };

  const getUniqueTerms = () => {
    return Array.from(new Set(grades.map(g => g.term))).sort((a, b) => b.localeCompare(a));
  };

  const getGradeStats = () => {
    if (grades.length === 0) return null;

    const bySubject: Record<string, { name: string; entries: GradeEntry[] }> = {};
    for (const g of grades) {
      const subName = g.subject_name ?? 'Unknown';
      const subId = subName;
      if (!bySubject[subId]) bySubject[subId] = { name: subName, entries: [] };
      bySubject[subId].entries.push(g);
    }

    const subjectTotals = Object.values(bySubject).map(s => {
      const total = s.entries.reduce((sum, e) => sum + (e.theory_score ?? e.score ?? 0) + (e.practical_score ?? 0), 0);
      const max = s.entries.reduce((sum, e) => sum + (e.theory_max + e.practical_max), 0);
      const gpa = max > 0 ? total / 10 : 0;
      return { name: s.name, total, max, gpa };
    });

    const overallTotal = subjectTotals.reduce((s, x) => s + x.total, 0);
    const overallMax = subjectTotals.reduce((s, x) => s + x.max, 0);
    const overallGpa = overallMax > 0 ? overallTotal / 10 : 0;

    return { subjectTotals, overallGpa, count: grades.length };
  };

  const gpaColor = (gpa: number) => gpa >= 7 ? COLORS.success : gpa >= 5 ? COLORS.warning : COLORS.danger;
  const gpaBg = (gpa: number) => gpa >= 7 ? COLORS.successBg : gpa >= 5 ? COLORS.warningBg : COLORS.dangerBg;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const stats = getGradeStats();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Grades</Text>

      {stats && stats.subjectTotals.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.gpaLabel}>Overall GPA</Text>
          <Text style={[styles.gpaValue, { color: gpaColor(stats.overallGpa) }]}>{stats.overallGpa.toFixed(1)}</Text>
          <Text style={styles.gpaSubLabel}>/ 10</Text>
          <View style={styles.summaryBar}>
            <View style={[styles.summaryBarFill, { width: `${Math.min(stats.overallGpa * 10, 100)}%`, backgroundColor: gpaColor(stats.overallGpa) }]} />
          </View>
        </View>
      )}

      {getUniqueTerms().length > 0 && (
        <View style={styles.termRow}>
          <TouchableOpacity style={[styles.termPill, !selectedTerm && styles.termPillActive]} onPress={() => setSelectedTerm(null)}>
            <Text style={[styles.termPillText, !selectedTerm && styles.termPillTextActive]}>All</Text>
          </TouchableOpacity>
          {getUniqueTerms().map(term => (
            <TouchableOpacity key={term} style={[styles.termPill, selectedTerm === term && styles.termPillActive]} onPress={() => setSelectedTerm(term)}>
              <Text style={[styles.termPillText, selectedTerm === term && styles.termPillTextActive]}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {grades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No grades yet</Text>
        </View>
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={stats && stats.subjectTotals.length > 0 ? (
            <View style={styles.subjectSummarySection}>
              <Text style={styles.sectionLabel}>Subjects</Text>
              {stats.subjectTotals.map((s, i) => (
                <View key={i} style={styles.subjectSummaryRow}>
                  <Text style={styles.subjectSummaryName}>{s.name}</Text>
                  <View style={styles.subjectSummaryScores}>
                    <Text style={styles.subjectScoreText}>{s.total}/{s.max}</Text>
                    <View style={[styles.gpaPill, { backgroundColor: gpaBg(s.gpa) }]}>
                      <Text style={[styles.gpaPillText, { color: gpaColor(s.gpa) }]}>{s.gpa.toFixed(1)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          renderItem={({ item }) => {
            const theory = item.theory_score ?? 0;
            const practical = item.practical_score ?? 0;
            const total = theory + practical;
            const max = (item.theory_max ?? 75) + (item.practical_max ?? 25);
            const pct = max > 0 ? Math.round((total / max) * 100) : 0;
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            const subjectName = item.subject_name ?? '';
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{subjectName ? `${subjectName} · ` : ''}{className} · {item.term}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: gpaBg(pct / 10) }]}>
                    <Text style={[styles.pillText, { color: gpaColor(pct / 10) }]}>{pct}%</Text>
                  </View>
                </View>
                <View style={styles.scoreBreakdown}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreItemLabel}>Theory</Text>
                    <Text style={styles.scoreItemValue}>{theory} / {item.theory_max ?? 75}</Text>
                  </View>
                  <View style={styles.scoreDivider} />
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreItemLabel}>Practical</Text>
                    <Text style={styles.scoreItemValue}>{practical} / {item.practical_max ?? 25}</Text>
                  </View>
                  <View style={styles.scoreDivider} />
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreItemLabel}>Total</Text>
                    <Text style={[styles.scoreItemValue, { color: gpaColor(total / 10) }]}>{total} / {max}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 20 },

  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  gpaLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  gpaValue: { fontSize: 52, fontWeight: '800', marginTop: 4 },
  gpaSubLabel: { fontSize: 15, color: COLORS.textSecondary, marginTop: 2 },
  summaryBar: { width: '100%', height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, marginTop: 16 },
  summaryBarFill: { height: 6, borderRadius: 3 },

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  termPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  termPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termPillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  termPillTextActive: { color: COLORS.textInverse },

  subjectSummarySection: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  subjectSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 6 },
  subjectSummaryName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  subjectSummaryScores: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectScoreText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  gpaPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gpaPillText: { fontSize: 14, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },

  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 10, ...SHADOWS.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  pillText: { fontSize: 14, fontWeight: '700' },
  scoreBreakdown: { flexDirection: 'row', alignItems: 'center' },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreItemLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 2 },
  scoreItemValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  scoreDivider: { width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 4 },
});
