import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface ClassWithGrades {
  id: string;
  name: string;
  grade_level: number;
  grade_count: number;
  average_score: number | null;
}

interface TermOption {
  term: string;
  count: number;
}

export default function AdminGradesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassWithGrades[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: gradeEntries, error: gradeError } = await supabase
        .from('grade_entries')
        .select('class_id, score, max_score, term');

      if (gradeError) throw gradeError;

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name, grade_level');

      if (classError) throw classError;

      const termMap = new Map<string, number>();
      gradeEntries?.forEach((entry) => {
        termMap.set(entry.term, (termMap.get(entry.term) || 0) + 1);
      });
      const termOptions: TermOption[] = Array.from(termMap.entries())
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.term.localeCompare(a.term));
      setTerms(termOptions);

      if (!selectedTerm && termOptions.length > 0) {
        setSelectedTerm(termOptions[0].term);
      }

      const filteredEntries = selectedTerm
        ? gradeEntries?.filter((e) => e.term === selectedTerm)
        : gradeEntries;

      const classMap = new Map<string, { name: string; grade_level: number }>();
      classData?.forEach((c) => {
        classMap.set(c.id, { name: c.name, grade_level: c.grade_level });
      });

      const classGradesMap = new Map<string, { count: number; totalPct: number }>();
      filteredEntries?.forEach((entry) => {
        const existing = classGradesMap.get(entry.class_id) || { count: 0, totalPct: 0 };
        const pct = entry.max_score > 0 ? (entry.score / entry.max_score) * 100 : 0;
        classGradesMap.set(entry.class_id, {
          count: existing.count + 1,
          totalPct: existing.totalPct + pct,
        });
      });

      const classesWithGrades: ClassWithGrades[] = (classData || []).map((c) => {
        const gradeInfo = classGradesMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          grade_level: c.grade_level,
          grade_count: gradeInfo?.count || 0,
          average_score:
            gradeInfo && gradeInfo.count > 0
              ? Math.round((gradeInfo.totalPct / gradeInfo.count) * 10) / 10
              : null,
        };
      });

      classesWithGrades.sort((a, b) => a.name.localeCompare(b.name));
      setClasses(classesWithGrades);
    } catch (error) {
      console.error('Error fetching grade data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const totalGrades = classes.reduce((sum, c) => sum + c.grade_count, 0);

  const classesWithScores = classes.filter((c) => c.average_score !== null);
  const schoolAverage =
    classesWithScores.length > 0
      ? Math.round(
          (classesWithScores.reduce((sum, c) => sum + (c.average_score || 0), 0) /
            classesWithScores.length) *
            10
        ) / 10
      : null;

  const lowestClass = classesWithScores.reduce(
    (lowest, c) =>
      !lowest || (c.average_score !== null && c.average_score < (lowest.average_score || Infinity))
        ? c
        : lowest,
    null as ClassWithGrades | null
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.screenTitle}>Grade Management</Text>

        <View style={styles.termFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {terms.map((t) => (
              <TouchableOpacity
                key={t.term}
                style={[
                  styles.termPill,
                  selectedTerm === t.term && styles.termPillActive,
                ]}
                onPress={() => setSelectedTerm(t.term)}
              >
                <Text
                  style={[
                    styles.termPillText,
                    selectedTerm === t.term && styles.termPillTextActive,
                  ]}
                >
                  {t.term}
                </Text>
                <View
                  style={[
                    styles.termBadge,
                    selectedTerm === t.term && styles.termBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.termBadgeText,
                      selectedTerm === t.term && styles.termBadgeTextActive,
                    ]}
                  >
                    {t.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalGrades}</Text>
            <Text style={styles.statLabel}>Grades Entered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {schoolAverage !== null ? `${schoolAverage}%` : '--'}
            </Text>
            <Text style={styles.statLabel}>School Average</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue} numberOfLines={1}>
              {lowestClass ? lowestClass.name : '--'}
            </Text>
            <Text style={styles.statLabel}>Lowest Class</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Classes</Text>

        {classes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No classes found</Text>
          </View>
        ) : (
          classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={styles.classCard}
              onPress={() => router.push(`/(admin)/grades/${cls.id}`)}
            >
              <View style={styles.classCardHeader}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{cls.name}</Text>
                  <Text style={styles.classLevel}>Grade {cls.grade_level}</Text>
                </View>
                <View style={styles.classStats}>
                  <Text style={styles.classGradeCount}>{cls.grade_count} entries</Text>
                  <Text style={styles.classAverage}>
                    {cls.average_score !== null ? `${cls.average_score}%` : 'No grades'}
                  </Text>
                </View>
              </View>
              {cls.average_score !== null && (
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${Math.min(cls.average_score, 100)}%` },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  termFilterContainer: {
    marginBottom: 20,
  },
  termPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  termPillActive: {
    backgroundColor: COLORS.primaryBg,
  },
  termPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  termPillTextActive: {
    color: COLORS.primary,
  },
  termBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  termBadgeActive: {
    backgroundColor: COLORS.primary + '20',
  },
  termBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  termBadgeTextActive: {
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    ...SHADOWS.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 14,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  classCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  classLevel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  classStats: {
    alignItems: 'flex-end',
  },
  classGradeCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  classAverage: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
