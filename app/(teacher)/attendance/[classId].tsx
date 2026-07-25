import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

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

interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
}

const STATUS_OPTIONS: { key: AttendanceStatus; label: string; color: string; bg: string }[] = [
  { key: 'present', label: 'Present', color: COLORS.success, bg: COLORS.successBg },
  { key: 'absent', label: 'Absent', color: COLORS.danger, bg: COLORS.dangerBg },
  { key: 'late', label: 'Late', color: COLORS.warning, bg: COLORS.warningBg },
  { key: 'excused', label: 'Excused', color: COLORS.textSecondary, bg: COLORS.surfaceAlt },
];

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function TeacherAttendanceScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(true);

  const todayStr = getTodayString();

  const fetchData = useCallback(async () => {
    if (!classId || !user?.id) return;
    setLoading(true);

    try {
      const classRes = await supabase
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('id', classId)
        .single();

      if (!classRes.data) {
        setAuthorized(false);
        return;
      }

      if (classRes.data.teacher_id !== user.id) {
        setAuthorized(false);
        return;
      }

      setClassInfo(classRes.data);

      const studentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(id, full_name, email)')
        .eq('class_id', classId);

      if (studentRes.data) {
        const mapped: Student[] = studentRes.data
          .map((e: any) => {
            const profile = e.profiles;
            if (!profile) return null;
            return { id: profile.id, full_name: profile.full_name, email: profile.email };
          })
          .filter(Boolean) as Student[];
        setStudents(mapped);
      }

      const attendanceRes = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', todayStr);

      if (attendanceRes.data && attendanceRes.data.length > 0) {
        setIsReadOnly(true);
        setExistingRecords(attendanceRes.data as AttendanceRecord[]);
        const existingMap: Record<string, AttendanceStatus> = {};
        for (const rec of attendanceRes.data) {
          existingMap[rec.student_id] = rec.status as AttendanceStatus;
        }
        setStatuses(existingMap);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, [classId, user?.id, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isReadOnly) return;
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!classId || !user?.id) return;

    const unmarked = students.filter((s) => !statuses[s.id]);
    if (unmarked.length > 0) {
      Alert.alert(
        'Incomplete',
        `${unmarked.length} student(s) have no status selected. Please mark all students before saving.`
      );
      return;
    }

    setSaving(true);
    try {
      const rows = students.map((s) => ({
        class_id: classId,
        student_id: s.id,
        date: todayStr,
        status: statuses[s.id],
        marked_by: user.id,
      }));

      const { error } = await supabase
        .from('attendance_records')
        .upsert(rows, { onConflict: 'class_id,student_id,date' });

      if (error) {
        Alert.alert('Error', 'Failed to save attendance. Please try again.');
        console.error('Save error:', error);
      } else {
        Alert.alert('Saved', 'Attendance has been recorded successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!authorized || !classInfo) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 56, color: COLORS.textTertiary }}>🔒</Text>
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorText}>
          Only the class teacher for this class can mark attendance.
        </Text>
        <TouchableOpacity style={styles.backToHomeBtn} onPress={() => router.back()}>
          <Text style={styles.backToHomeText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getBadgeStyle = (status: AttendanceStatus) => {
    const opt = STATUS_OPTIONS.find((o) => o.key === status);
    return { backgroundColor: opt?.bg, color: opt?.color };
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: COLORS.text }}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.className}>{classInfo.name}</Text>
          <Text style={styles.dateText}>{getFormattedDate()}</Text>
          {isReadOnly && (
            <View style={styles.readOnlyBadge}>
              <Text style={{ fontSize: 14, color: COLORS.success }}>✓</Text>
              <Text style={styles.readOnlyText}>Attendance already recorded</Text>
            </View>
          )}
        </View>

        <Text style={styles.studentCountLabel}>
          {students.length} Student{students.length !== 1 ? 's' : ''}
        </Text>

        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, color: COLORS.textTertiary }}>👥</Text>
            <Text style={styles.emptyText}>No students enrolled in this class.</Text>
          </View>
        ) : (
          students.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {student.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.full_name}</Text>
                {student.email ? (
                  <Text style={styles.studentEmail}>{student.email}</Text>
                ) : null}
              </View>

              {isReadOnly ? (
                <View style={[styles.badge, { backgroundColor: getBadgeStyle(existingRecords.find((r) => r.student_id === student.id)?.status || 'present').backgroundColor }]}>
                  <Text
                    style={[
                      styles.badgeText,
                      { color: getBadgeStyle(existingRecords.find((r) => r.student_id === student.id)?.status || 'present').color },
                    ]}
                  >
                    {(existingRecords.find((r) => r.student_id === student.id)?.status || 'present').charAt(0).toUpperCase() +
                      (existingRecords.find((r) => r.student_id === student.id)?.status || 'present').slice(1)}
                  </Text>
                </View>
              ) : (
                <View style={styles.statusPills}>
                  {STATUS_OPTIONS.map((opt) => {
                    const selected = statuses[student.id] === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: selected ? opt.color : COLORS.surfaceAlt,
                          },
                        ]}
                        onPress={() => handleStatusChange(student.id, opt.key)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            { color: selected ? COLORS.white : COLORS.textSecondary },
                          ]}
                        >
                          {opt.label.charAt(0)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {!isReadOnly && students.length > 0 && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Attendance</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 32,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  backBtn: {
    marginBottom: 12,
    padding: 4,
  },

  headerSection: {
    marginBottom: 20,
  },
  className: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  readOnlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },

  studentCountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  statusPills: {
    flexDirection: 'row',
    gap: 5,
  },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
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

  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backToHomeBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backToHomeText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },

  saveContainer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.bg,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
