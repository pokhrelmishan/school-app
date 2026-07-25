import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useFocusEffect } from 'expo-router';

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

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [user?.id])
  );

  const fetchClasses = async () => {
    if (!user?.id) return;
    setLoading(true);

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
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (classes.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You are not a class teacher of any class yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>Attendance</Text>
      <Text style={styles.subtitle}>Select a class to mark attendance</Text>

      {classes.map((cls) => (
        <TouchableOpacity
          key={cls.id}
          style={styles.classCard}
          onPress={() => router.push(`/(teacher)/attendance/${cls.id}` as any)}
          activeOpacity={0.8}
        >
          <View style={styles.classIcon}>
            <Text style={styles.classIconText}>{cls.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.className}>{cls.name}</Text>
            <Text style={styles.classMeta}>Grade {cls.grade_level} · {cls.student_count} students</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 20 },
  classCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16, marginBottom: 10, ...SHADOWS.sm,
  },
  classIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primaryBg,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  classIconText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  className: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  classMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 22, color: COLORS.textSecondary, fontWeight: '300' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },
});
