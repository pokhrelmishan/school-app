import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';

export default function StudentDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [recentGrades, setRecentGrades] = useState<any[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<any[]>([]);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // Attendance
      const { data: attData } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', user.id);

      if (attData) {
        setAttendanceSummary({
          present: attData.filter(r => r.status === 'present').length,
          absent: attData.filter(r => r.status === 'absent').length,
          late: attData.filter(r => r.status === 'late').length,
          total: attData.length,
        });
      }

      // Recent grades
      const { data: gradeData } = await supabase
        .from('grade_entries')
        .select('id, title, score, max_score, term, created_at, class:classes(name)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (gradeData) {
        setRecentGrades(gradeData.map((g: any) => ({
          ...g,
          class_name: Array.isArray(g.class) ? g.class[0]?.name : g.class?.name,
        })));
      }

      // Upcoming assignments
      const { data: assignData } = await supabase
        .from('assignments')
        .select('id, title, due_date, class:classes(name)')
        .order('due_date', { ascending: true })
        .limit(5);

      if (assignData) {
        setUpcomingAssignments(assignData.map((a: any) => ({
          ...a,
          class_name: Array.isArray(a.class) ? a.class[0]?.name : a.class?.name,
        })));
      }

      // Recent notices
      const { data: noticeData } = await supabase
        .from('notices')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (noticeData) {
        setRecentNotices(noticeData);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user?.id]);

  const attendanceRate = attendanceSummary.total > 0
    ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
    : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.chalk} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.studentName}>{profile?.full_name || 'Student'}</Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Attendance Summary */}
      <TouchableOpacity style={styles.card} onPress={() => router.push('/(student)/attendance')}>
        <Text style={styles.cardTitle}>Attendance</Text>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.chalk }]}>{attendanceRate}%</Text>
            <Text style={styles.statLabel}>Present Rate</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attendanceSummary.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.danger }]}>{attendanceSummary.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.ink }]}>{attendanceSummary.late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
        </View>
        <Text style={styles.cardFooter}>Tap to view full attendance →</Text>
      </TouchableOpacity>

      {/* Recent Grades */}
      <TouchableOpacity style={styles.card} onPress={() => router.push('/(student)/grades')}>
        <Text style={styles.cardTitle}>Recent Grades</Text>
        {recentGrades.length === 0 ? (
          <Text style={styles.emptyText}>No grades yet</Text>
        ) : (
          recentGrades.map((grade) => {
            const pct = Math.round((grade.score / grade.max_score) * 100);
            return (
              <View key={grade.id} style={styles.gradeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gradeTitle}>{grade.title}</Text>
                  <Text style={styles.gradeClass}>{grade.class_name}</Text>
                </View>
                <View style={[styles.gradeBadge, { backgroundColor: pct >= 70 ? COLORS.chalk : pct >= 50 ? COLORS.ink : COLORS.danger }]}>
                  <Text style={styles.gradeBadgeText}>{pct}%</Text>
                </View>
              </View>
            );
          })
        )}
        <Text style={styles.cardFooter}>Tap to view full report card →</Text>
      </TouchableOpacity>

      {/* Upcoming Assignments */}
      <TouchableOpacity style={styles.card} onPress={() => router.push('/(student)/assignments')}>
        <Text style={styles.cardTitle}>Assignments</Text>
        {upcomingAssignments.length === 0 ? (
          <Text style={styles.emptyText}>No assignments posted</Text>
        ) : (
          upcomingAssignments.map((a) => (
            <View key={a.id} style={styles.assignmentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>{a.title}</Text>
                <Text style={styles.assignmentClass}>{a.class_name}</Text>
              </View>
              <Text style={styles.assignmentDue}>
                {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No due date'}
              </Text>
            </View>
          ))
        )}
        <Text style={styles.cardFooter}>Tap to view all assignments →</Text>
      </TouchableOpacity>

      {/* Recent Notices */}
      <TouchableOpacity style={styles.card} onPress={() => router.push('/(student)/notices')}>
        <Text style={styles.cardTitle}>Notices</Text>
        {recentNotices.length === 0 ? (
          <Text style={styles.emptyText}>No notices</Text>
        ) : (
          recentNotices.map((n) => (
            <View key={n.id} style={styles.noticeRow}>
              <Text style={styles.noticeTitle}>{n.title}</Text>
              <Text style={styles.noticeBody} numberOfLines={2}>{n.body}</Text>
              <Text style={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        )}
        <Text style={styles.cardFooter}>Tap to view all notices →</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.paper,
  },
  header: {
    marginBottom: 20,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.graphite,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  errorBanner: {
    backgroundColor: COLORS.danger + '15',
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
  },
  card: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 12,
  },
  cardFooter: {
    fontSize: 13,
    color: COLORS.graphite,
    marginTop: 12,
    fontStyle: 'italic',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.graphite,
  },
  emptyText: {
    color: COLORS.graphite,
    fontSize: 14,
    fontStyle: 'italic',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
  },
  gradeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  gradeClass: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gradeBadgeText: {
    color: COLORS.paper,
    fontWeight: 'bold',
    fontSize: 13,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  assignmentClass: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  assignmentDue: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  noticeRow: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 13,
    color: COLORS.graphite,
    marginBottom: 2,
  },
  noticeDate: {
    fontSize: 11,
    color: COLORS.graphiteLight,
  },
});
