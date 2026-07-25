import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useFocusEffect } from 'expo-router';

interface Student {
  id: string;
  full_name: string;
  email?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [classId])
  );

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const classRes = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('id', classId)
        .single();

      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === user.id);
      }

      const studentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(id, full_name, email)')
        .eq('class_id', classId);

      if (studentRes.data) {
        const mapped: Student[] = studentRes.data
          .map((e: any) => {
            const profile = e.profiles;
            if (!profile) return null;
            return {
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
            };
          })
          .filter(Boolean) as Student[];
        setStudents(mapped);
      }
    } catch (err) {
      console.error('Error fetching class data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = () => {
    router.push(`/(teacher)/attendance/${classId}` as any);
  };

  const handleViewGrades = () => {
    router.push(`/(teacher)/grades/${classId}` as any);
  };

  const handleSendMessage = () => {
    router.push({
      pathname: '/(teacher)/messages' as any,
      params: { classId },
    });
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentRow}>
      <View style={[styles.studentAvatar, { backgroundColor: COLORS.primary + '18' }]}>
        <Text style={[styles.studentInitial, { color: COLORS.primary }]}>
          {item.full_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.full_name}</Text>
        {item.email ? <Text style={styles.studentEmail}>{item.email}</Text> : null}
      </View>
    </View>
  );

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
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={{ fontSize: 22, color: COLORS.text }}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerSection}>
              <Text style={styles.className}>{classInfo.name}</Text>
              <Text style={styles.gradeLevel}>Grade {classInfo.grade_level}</Text>
            </View>

            <View style={styles.actionsGrid}>
              {isClassTeacher && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleMarkAttendance}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 22, color: '#fff' }}>✓</Text>
                  <Text style={styles.actionBtnText}>Mark Attendance</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                onPress={handleViewGrades}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22, color: '#fff' }}>📊</Text>
                <Text style={styles.actionBtnText}>{isClassTeacher ? 'Enter Grades' : 'View Grades'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleSendMessage}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22, color: '#fff' }}>💬</Text>
                <Text style={styles.actionBtnText}>Send Message</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Enrolled Students</Text>
              <Text style={styles.studentCount}>{students.length}</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, color: COLORS.textSecondary }}>👥</Text>
            <Text style={styles.emptyText}>No students enrolled yet.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  backBtn: { marginBottom: 12, padding: 4 },
  headerSection: { marginBottom: 20 },
  className: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  gradeLevel: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  actionsGrid: { gap: 10, marginBottom: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, gap: 12, ...SHADOWS.sm },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  studentCount: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  list: { paddingBottom: 20 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 8, ...SHADOWS.sm },
  studentAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  studentInitial: { fontSize: 16, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  studentEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 12 },
  errorText: { fontSize: 16, color: COLORS.textSecondary },
});
