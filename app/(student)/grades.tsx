import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface GradeEntry {
  id: string;
  title: string;
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
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const fetchGrades = async () => {
    if (!user?.id) return;
    setLoading(true);
    let q = supabase
      .from('grade_entries')
      .select('id, title, score, max_score, term, created_at, class:classes(name, grade_level)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });
    if (selectedTerm) q = q.eq('term', selectedTerm);
    const { data } = await q;
    if (data) setGrades(data as unknown as GradeEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchGrades(); }, [user?.id, selectedTerm]);

  const getGradeStats = () => {
    if (grades.length === 0) return null;
    const total = grades.reduce((s, g) => s + g.score, 0);
    const max = grades.reduce((s, g) => s + g.max_score, 0);
    const pct = max > 0 ? (total / max) * 100 : 0;
    const letter = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
    return { pct, letter, count: grades.length };
  };

  const getUniqueTerms = () => {
    return Array.from(new Set(grades.map(g => g.term))).sort((a, b) => b.localeCompare(a));
  };

  const stats = getGradeStats();

  const gradeColor = (pct: number) => pct >= 90 ? COLORS.success : pct >= 70 ? COLORS.primary : pct >= 50 ? COLORS.warning : COLORS.danger;
  const gradeBg = (pct: number) => pct >= 90 ? COLORS.successBg : pct >= 70 ? COLORS.primaryBg : pct >= 50 ? COLORS.warningBg : COLORS.dangerBg;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Grades</Text>

      {stats && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={[styles.summaryGrade, { color: gradeColor(stats.pct) }]}>{stats.letter}</Text>
            <Text style={styles.summaryPct}>{stats.pct.toFixed(1)}%</Text>
            <Text style={styles.summaryCount}>{stats.count} assignments</Text>
          </View>
          <View style={styles.summaryBar}>
            <View style={[styles.summaryBarFill, { width: `${Math.min(stats.pct, 100)}%`, backgroundColor: gradeColor(stats.pct) }]} />
          </View>
        </View>
      )}

      {getUniqueTerms().length > 0 && (
        <View style={styles.termRow}>
          <TouchableOpacity
            style={[styles.termPill, !selectedTerm && styles.termPillActive]}
            onPress={() => setSelectedTerm(null)}
          >
            <Text style={[styles.termPillText, !selectedTerm && styles.termPillTextActive]}>All</Text>
          </TouchableOpacity>
          {getUniqueTerms().map(term => (
            <TouchableOpacity
              key={term}
              style={[styles.termPill, selectedTerm === term && styles.termPillActive]}
              onPress={() => setSelectedTerm(term)}
            >
              <Text style={[styles.termPillText, selectedTerm === term && styles.termPillTextActive]}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {grades.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No grades found</Text>
        </View>
      ) : (
        <FlatList
          data={grades}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const pct = Math.round((item.score / item.max_score) * 100);
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{className} · {item.term}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: gradeBg(pct) }]}>
                    <Text style={[styles.pillText, { color: gradeColor(pct) }]}>{pct}%</Text>
                  </View>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreText}>{item.score} / {item.max_score}</Text>
                  <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
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
  summaryLeft: { alignItems: 'center', marginBottom: 16 },
  summaryGrade: { fontSize: 52, fontWeight: '800' },
  summaryPct: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  summaryCount: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  summaryBar: { width: '100%', height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3 },
  summaryBarFill: { height: 6, borderRadius: 3 },

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  termPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  termPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termPillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  termPillTextActive: { color: COLORS.textInverse },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  pillText: { fontSize: 14, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dateText: { fontSize: 13, color: COLORS.textTertiary },
});
