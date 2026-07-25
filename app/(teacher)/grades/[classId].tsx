import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
}

interface SubjectAssignment {
  id: string;
  subject_id: string;
  subject_name: string;
}

interface GradeEntry {
  id: string;
  title: string;
  score: number;
  max_score: number;
  term: string;
  subject_id: string;
  student_id: string;
  created_at: string;
  student?: { full_name: string } | null;
}

interface StudentGrades {
  studentId: string;
  studentName: string;
  grades: GradeEntry[];
  avgPct: number;
}

export default function TeacherGradesViewScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [subjects, setSubjects] = useState<SubjectAssignment[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [classId]);

  const fetchData = async () => {
    if (!classId || !user?.id) return;
    setLoading(true);

    try {
      const classRes = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('id', classId)
        .single();

      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === user.id);
      }

      const subjectRes = await supabase
        .from('teacher_subjects')
        .select('id, subject_id, subjects(name)')
        .eq('teacher_id', user.id)
        .eq('class_id', classId);

      if (subjectRes.data) {
        setSubjects(
          subjectRes.data.map((s: any) => ({
            id: s.id,
            subject_id: s.subject_id,
            subject_name: s.subjects?.name ?? '',
          }))
        );
      }

      let gradesQuery = supabase
        .from('grade_entries')
        .select('id, title, score, max_score, term, subject_id, student_id, created_at, student:profiles(full_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (!classRes.data?.teacher_id || classRes.data.teacher_id !== user.id) {
        const subjectIds = subjectRes.data?.map((s: any) => s.subject_id) ?? [];
        if (subjectIds.length > 0) {
          gradesQuery = gradesQuery.in('subject_id', subjectIds);
        } else {
          gradesQuery = gradesQuery.eq('student_id', '__none__');
        }
      }

      const { data: gradesData } = await gradesQuery;
      if (gradesData) {
        setGrades(gradesData as unknown as GradeEntry[]);
      }
    } catch (err) {
      console.error('Error fetching grades data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueTerms = () => {
    return Array.from(new Set(grades.map((g) => g.term))).sort((a, b) =>
      b.localeCompare(a)
    );
  };

  const getFilteredGrades = () => {
    if (!selectedTerm) return grades;
    return grades.filter((g) => g.term === selectedTerm);
  };

  const getStudentGrades = (): StudentGrades[] => {
    const filtered = getFilteredGrades();
    const map = new Map<string, StudentGrades>();

    for (const g of filtered) {
      if (!map.has(g.student_id)) {
        const profile = g.student as any;
        map.set(g.student_id, {
          studentId: g.student_id,
          studentName: profile?.full_name ?? 'Unknown',
          grades: [],
          avgPct: 0,
        });
      }
      map.get(g.student_id)!.grades.push(g);
    }

    for (const sg of map.values()) {
      if (sg.grades.length > 0) {
        const totalPct = sg.grades.reduce(
          (sum, g) => sum + (g.score / g.max_score) * 100,
          0
        );
        sg.avgPct = totalPct / sg.grades.length;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  };

  const getOverallStats = () => {
    const filtered = getFilteredGrades();
    if (filtered.length === 0) return null;
    const totalScore = filtered.reduce((s, g) => s + g.score, 0);
    const totalMax = filtered.reduce((s, g) => s + g.max_score, 0);
    const avgPct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    return {
      avgPct,
      totalEntries: filtered.length,
      totalStudents: new Set(filtered.map((g) => g.student_id)).size,
    };
  };

  const toggleExpand = (studentId: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const pctBadgeStyle = (pct: number) => {
    if (pct >= 70) return { bg: COLORS.successBg, color: COLORS.success };
    if (pct >= 50) return { bg: COLORS.warningBg, color: COLORS.warning };
    return { bg: COLORS.dangerBg, color: COLORS.danger };
  };

  const stats = getOverallStats();
  const studentGrades = getStudentGrades();
  const terms = getUniqueTerms();
  const subjectNames = subjects.map((s) => s.subject_name).join(', ');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!classInfo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Class not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={studentGrades}
        keyExtractor={(item) => item.studentId}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Text
                style={{ fontSize: 22, color: COLORS.text }}
              >←</Text>
            </TouchableOpacity>

            <View style={styles.headerSection}>
              <Text style={styles.className}>{classInfo.name}</Text>
              <Text style={styles.gradeLevel}>
                Grade {classInfo.grade_level}
              </Text>
            </View>

            {isClassTeacher ? (
              <View style={[styles.badge, { backgroundColor: COLORS.primaryBg }]}>
                <Text
                  style={{ fontSize: 16, color: COLORS.primary }}
                >🛡️</Text>
                <Text style={[styles.badgeText, { color: COLORS.primary }]}>
                  Class Teacher - All Subjects
                </Text>
              </View>
            ) : (
              subjectNames && (
                <View
                  style={[styles.badge, { backgroundColor: COLORS.successBg }]}
                >
                  <Text
                    style={{ fontSize: 16, color: COLORS.success }}
                  >📖</Text>
                  <Text
                    style={[styles.badgeText, { color: COLORS.success }]}
                  >
                    Subjects: {subjectNames}
                  </Text>
                </View>
              )
            )}

            {stats && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: pctBadgeStyle(stats.avgPct).color },
                      ]}
                    >
                      {stats.avgPct.toFixed(1)}%
                    </Text>
                    <Text style={styles.summaryLabel}>Class Average</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {stats.totalEntries}
                    </Text>
                    <Text style={styles.summaryLabel}>Total Entries</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {stats.totalStudents}
                    </Text>
                    <Text style={styles.summaryLabel}>Students</Text>
                  </View>
                </View>
                <View style={styles.summaryBar}>
                  <View
                    style={[
                      styles.summaryBarFill,
                      {
                        width: `${Math.min(stats.avgPct, 100)}%`,
                        backgroundColor: pctBadgeStyle(stats.avgPct).color,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {terms.length > 0 && (
              <View style={styles.termRow}>
                <TouchableOpacity
                  style={[
                    styles.termPill,
                    !selectedTerm && styles.termPillActive,
                  ]}
                  onPress={() => setSelectedTerm(null)}
                >
                  <Text
                    style={[
                      styles.termPillText,
                      !selectedTerm && styles.termPillTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {terms.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.termPill,
                      selectedTerm === term && styles.termPillActive,
                    ]}
                    onPress={() => setSelectedTerm(term)}
                  >
                    <Text
                      style={[
                        styles.termPillText,
                        selectedTerm === term && styles.termPillTextActive,
                      ]}
                    >
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const expanded = expandedStudents.has(item.studentId);
          const badge = pctBadgeStyle(item.avgPct);
          return (
            <View style={styles.studentCard}>
              <TouchableOpacity
                style={styles.studentHeader}
                onPress={() => toggleExpand(item.studentId)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.studentAvatar,
                    { backgroundColor: COLORS.primaryBg },
                  ]}
                >
                  <Text style={[styles.studentInitial, { color: COLORS.primary }]}>
                    {item.studentName.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.studentName}</Text>
                  <Text style={styles.studentMeta}>
                    {item.grades.length} grade{item.grades.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={[styles.avgBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.avgBadgeText, { color: badge.color }]}>
                    {item.avgPct.toFixed(1)}%
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 18, color: COLORS.textSecondary }}
                >{expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.gradesList}>
                  {item.grades.map((g) => {
                    const pct = Math.round((g.score / g.max_score) * 100);
                    const gBadge = pctBadgeStyle(pct);
                    return (
                      <View key={g.id} style={styles.gradeRow}>
                        <View style={styles.gradeInfo}>
                          <Text style={styles.gradeTitle}>{g.title}</Text>
                          <Text style={styles.gradeMeta}>
                            {g.term}
                          </Text>
                        </View>
                        <Text style={styles.gradeScore}>
                          {g.score}/{g.max_score}
                        </Text>
                        <View
                          style={[styles.pctBadge, { backgroundColor: gBadge.bg }]}
                        >
                          <Text
                            style={[styles.pctBadgeText, { color: gBadge.color }]}
                          >
                            {pct}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text
              style={{ fontSize: 48, color: COLORS.textSecondary }}
            >📄</Text>
            <Text style={styles.emptyText}>No grades found</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    marginBottom: 12,
    padding: 4,
  },
  headerSection: {
    marginBottom: 16,
  },
  className: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  gradeLevel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  summaryBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 3,
  },
  summaryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  termRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  termPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  termPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  termPillTextActive: {
    color: COLORS.textInverse,
  },
  list: {
    paddingBottom: 20,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  studentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avgBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  avgBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gradesList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  gradeInfo: {
    flex: 1,
  },
  gradeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  gradeMeta: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  gradeScore: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 10,
  },
  pctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pctBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
