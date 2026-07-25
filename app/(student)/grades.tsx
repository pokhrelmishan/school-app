import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface GradeEntry {
  id: string;
  title: string;
  subject_name: string | null;
  grade_letter: string | null;
  subject_gpa: number | null;
  overall_gpa: number | null;
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
      .select('id, title, subject_name, grade_letter, subject_gpa, overall_gpa, term, created_at, class:classes(name, grade_level)')
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

  const getOverallGpa = () => {
    const withGpa = grades.filter(g => g.overall_gpa != null);
    if (withGpa.length === 0) return null;
    return withGpa[0].overall_gpa;
  };

  const gpaColor = (g: number) => g >= 3.5 ? COLORS.success : g >= 2.5 ? COLORS.warning : COLORS.danger;
  const gpaBg = (g: number) => g >= 3.5 ? COLORS.successBg : g >= 2.5 ? COLORS.warningBg : COLORS.dangerBg;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const overallGpa = getOverallGpa();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Grades</Text>

      {overallGpa != null && (
        <View style={styles.summaryCard}>
          <Text style={styles.gpaLabel}>Overall GPA</Text>
          <Text style={[styles.gpaValue, { color: gpaColor(overallGpa) }]}>{Number(overallGpa).toFixed(1)}</Text>
          <Text style={styles.gpaSubLabel}>/ 4.0</Text>
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
          renderItem={({ item }) => {
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.subject_name ?? 'Subject'}</Text>
                    <Text style={styles.cardMeta}>{item.title} · {className} · {item.term}</Text>
                  </View>
                  <View style={styles.rightSection}>
                    {item.grade_letter ? (
                      <View style={[styles.gradePill, { backgroundColor: COLORS.primaryBg }]}>
                        <Text style={[styles.gradePillText, { color: COLORS.primary }]}>{item.grade_letter}</Text>
                      </View>
                    ) : null}
                    {item.subject_gpa != null ? (
                      <Text style={[styles.gpaSmall, { color: gpaColor(item.subject_gpa) }]}>{Number(item.subject_gpa).toFixed(1)}</Text>
                    ) : null}
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

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  termPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  termPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termPillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  termPillTextActive: { color: COLORS.textInverse },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },

  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 10, ...SHADOWS.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary },
  rightSection: { alignItems: 'flex-end', gap: 4 },
  gradePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  gradePillText: { fontSize: 15, fontWeight: '700' },
  gpaSmall: { fontSize: 14, fontWeight: '700' },
});
