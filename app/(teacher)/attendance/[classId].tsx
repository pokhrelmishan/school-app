import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Avatar,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  PrimaryButton,
} from '../../../lib/components';

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

const STATUS_OPTIONS: { key: AttendanceStatus; label: string; color: string }[] = [
  { key: 'present', label: 'P', color: COLORS.chalk },
  { key: 'absent', label: 'A', color: COLORS.danger },
  { key: 'late', label: 'L', color: COLORS.pencil },
  { key: 'excused', label: 'E', color: COLORS.graphite },
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
  const [refreshing, setRefreshing] = useState(false);

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

      if (!classRes.data) { setAuthorized(false); return; }
      if (classRes.data.teacher_id !== user.id) { setAuthorized(false); return; }

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
      setRefreshing(false);
    }
  }, [classId, user?.id, todayStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [fetchData]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isReadOnly) return;
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!classId || !user?.id) return;

    const unmarked = students.filter((s) => !statuses[s.id]);
    if (unmarked.length > 0) {
      Alert.alert('Incomplete', `${unmarked.length} student(s) have no status selected. Please mark all students before saving.`);
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
      } else {
        Alert.alert('Saved', 'Attendance has been recorded successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen text="Loading attendance..." />;

  if (!authorized || !classInfo) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="🔒"
          title="Access Denied"
          subtitle="Only the class teacher for this class can mark attendance."
          action={{ label: 'Go Back', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const getStudentStatus = (studentId: string): AttendanceStatus | null => {
    if (isReadOnly) {
      return existingRecords.find((r) => r.student_id === studentId)?.status || null;
    }
    return statuses[studentId] || null;
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Mark Attendance" subtitle={`${classInfo.name} · ${getFormattedDate()}`} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
      >
        {isReadOnly && (
          <View style={styles.readOnlyBadge}>
            <Text style={styles.readOnlyText}>✓ Attendance already recorded</Text>
          </View>
        )}

        <SectionHeader title={`${students.length} Student${students.length !== 1 ? 's' : ''}`} />

        {students.length === 0 ? (
          <EmptyState icon="👥" title="No students enrolled in this class." />
        ) : (
          students.map((student) => {
            const currentStatus = getStudentStatus(student.id);
            return (
              <NotebookCard key={student.id}>
                <View style={styles.studentTop}>
                  <Avatar name={student.full_name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.studentName}>{student.full_name}</Text>
                  </View>
                </View>

                {isReadOnly ? (
                  <View style={styles.readOnlyRow}>
                    {STATUS_OPTIONS.map((opt) => {
                      const isActive = currentStatus === opt.key;
                      return (
                        <View
                          key={opt.key}
                          style={[styles.statusPill, isActive && { backgroundColor: opt.color }]}
                        >
                          <Text style={[styles.statusPillText, isActive && { color: COLORS.paper }]}>
                            {opt.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map((opt) => {
                      const selected = statuses[student.id] === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.statusPill, { backgroundColor: selected ? opt.color : COLORS.paperDim }]}
                          onPress={() => handleStatusChange(student.id, opt.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.statusPillText, { color: selected ? COLORS.paper : COLORS.graphite }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </NotebookCard>
            );
          })
        )}
      </ScrollView>

      {!isReadOnly && students.length > 0 && (
        <View style={styles.saveContainer}>
          <PrimaryButton title="Save Attendance" onPress={handleSave} loading={saving} disabled={saving} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 32 },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chalkSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  readOnlyText: { fontSize: 13, fontWeight: '600', color: COLORS.chalk },
  studentTop: { flexDirection: 'row', alignItems: 'center' },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  readOnlyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statusPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
});
