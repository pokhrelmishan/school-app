import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string;
  role: 'class_teacher' | 'subject';
  subject_name?: string;
  student_count: number;
}

export default function TeacherClassesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [classTeacherRes, subjectRes] = await Promise.all([
        supabase.from('classes').select('id, name, grade_level').eq('teacher_id', user.id),
        supabase.from('teacher_subjects').select('class_id, classes(id, name, grade_level), subjects(name)').eq('teacher_id', user.id),
      ]);

      const classTeacherIds = new Set<string>();
      const merged: ClassItem[] = [];

      if (classTeacherRes.data) {
        for (const c of classTeacherRes.data) {
          classTeacherIds.add(c.id);
          merged.push({
            id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            role: 'class_teacher',
            student_count: 0,
          });
        }
      }

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const classInfo = s.classes as any;
          const subjectInfo = s.subjects as any;
          if (!classInfo) continue;
          if (!classTeacherIds.has(s.class_id)) {
            classTeacherIds.add(s.class_id);
            merged.push({
              id: classInfo.id,
              name: classInfo.name,
              grade_level: classInfo.grade_level,
              role: 'subject',
              subject_name: subjectInfo?.name,
              student_count: 0,
            });
          } else {
            const existing = merged.find((m) => m.id === s.class_id);
            if (existing) {
              existing.subject_name = subjectInfo?.name;
            }
          }
        }
      }

      if (merged.length > 0) {
        const counts = await Promise.all(
          merged.map(async (c) => {
            const { count } = await supabase
              .from('class_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', c.id);
            return { id: c.id, count: count ?? 0 };
          })
        );
        counts.forEach(({ id, count }) => {
          const cls = merged.find((m) => m.id === id);
          if (cls) cls.student_count = count;
        });
      }

      setClasses(merged);
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClasses();
  }, [fetchClasses]);

  if (loading) return <LoadingScreen text="Loading classes..." />;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Classes" subtitle={user?.id ? 'Teacher' : ''} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        {classes.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No Classes Found"
            subtitle="You are not associated with any classes yet."
          />
        ) : (
          <>
            <SectionHeader title={`${classes.length} Class${classes.length !== 1 ? 'es' : ''}`} />
            {classes.map((item) => {
              const isClassTeacher = item.role === 'class_teacher';
              const accentColor = isClassTeacher ? COLORS.chalk : COLORS.tape;

              return (
                <NotebookCard
                  key={item.id}
                  accent={accentColor}
                  onPress={() => router.push(`/(teacher)/class/${item.id}` as any)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.className}>{item.name}</Text>
                    <Badge
                      text={isClassTeacher ? 'Class Teacher' : `Subject: ${item.subject_name}`}
                      color={isClassTeacher ? COLORS.chalk : COLORS.tape}
                    />
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.gradeLevel}>Grade {item.grade_level}</Text>
                    <Text style={styles.studentCount}>{item.student_count} students</Text>
                  </View>
                </NotebookCard>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  className: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gradeLevel: { fontSize: 13, color: COLORS.graphite },
  studentCount: { fontSize: 13, color: COLORS.graphiteLight },
});
