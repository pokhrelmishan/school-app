import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import {
  ScreenHeader,
  NotebookCard,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  Avatar,
} from '../../lib/components';

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  student_count?: number;
}

export default function TeacherAttendanceTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('classes')
      .select('id, name, grade_level')
      .eq('teacher_id', user.id)
      .order('name');

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (c) => {
          const { count } = await supabase
            .from('class_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id);
          return { ...c, student_count: count ?? 0 };
        })
      );
      setClasses(withCounts);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [fetchClasses])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClasses();
  }, [fetchClasses]);

  if (loading) return <LoadingScreen text="Loading classes..." />;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Attendance" subtitle="Mark daily attendance" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        {classes.length === 0 ? (
          <EmptyState icon="📋" title="No Classes" subtitle="You are not a class teacher of any class yet." />
        ) : (
          <>
            <SectionHeader title="Select a class to mark attendance" />
            {classes.map((cls) => (
              <NotebookCard
                key={cls.id}
                accent={COLORS.chalk}
                onPress={() => router.push(`/(teacher)/attendance/${cls.id}` as any)}
              >
                <View style={styles.classRow}>
                  <Avatar name={cls.name} size={44} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <Text style={styles.classMeta}>Grade {cls.grade_level} · {cls.student_count} students</Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </View>
              </NotebookCard>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  classRow: { flexDirection: 'row', alignItems: 'center' },
  className: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  classMeta: { fontSize: 13, color: COLORS.graphite, marginTop: 2 },
  arrow: { fontSize: 22, color: COLORS.graphiteLight, fontWeight: '300' },
});
