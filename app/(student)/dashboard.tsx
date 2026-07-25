import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';

export default function StudentDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [recentGrades, setRecentGrades] = useState<any[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<any[]>([]);
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [attRes, gradeRes, assignRes, noticeRes] = await Promise.all([
        supabase.from('attendance_records').select('status').eq('student_id', user.id),
        supabase.from('grade_entries').select('id, title, score, max_score, term, created_at, class:classes(name)').eq('student_id', user.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('assignments').select('id, title, due_date, class:classes(name)').order('due_date', { ascending: true }).limit(4),
        supabase.from('notices').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(2),
      ]);

      if (attRes.data) {
        setAttendanceSummary({
          present: attRes.data.filter(r => r.status === 'present').length,
          absent: attRes.data.filter(r => r.status === 'absent').length,
          late: attRes.data.filter(r => r.status === 'late').length,
          total: attRes.data.length,
        });
      }

      if (gradeRes.data) {
        setRecentGrades(gradeRes.data.map((g: any) => ({
          ...g,
          class_name: Array.isArray(g.class) ? g.class[0]?.name : g.class?.name,
        })));
      }

      if (assignRes.data) {
        setUpcomingAssignments(assignRes.data.map((a: any) => ({
          ...a,
          class_name: Array.isArray(a.class) ? a.class[0]?.name : a.class?.name,
        })));
      }

      if (noticeRes.data) setRecentNotices(noticeRes.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const attendanceRate = attendanceSummary.total > 0
    ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
    : 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{profile?.full_name || 'Student'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.full_name || 'S')[0]}</Text>
        </View>
      </View>

      {/* Attendance Quick Stats */}
      <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(student)/attendance')} activeOpacity={0.7}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>Attendance Overview</Text>
          <Text style={styles.statLink}>View all →</Text>
        </View>
        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.primary }]}>{attendanceRate}%</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxAlt]}>
            <Text style={styles.statNumber}>{attendanceSummary.present}</Text>
            <Text style={styles.statLabel}>Days</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.danger }]}>{attendanceSummary.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxAlt]}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{attendanceSummary.late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Grades */}
      <TouchableOpacity style={styles.sectionCard} onPress={() => router.push('/(student)/grades')} activeOpacity={0.7}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Grades</Text>
          <Text style={styles.statLink}>View all →</Text>
        </View>
        {recentGrades.length === 0 ? (
          <Text style={styles.emptyText}>No grades yet</Text>
        ) : (
          recentGrades.map((grade) => {
            const pct = Math.round((grade.score / grade.max_score) * 100);
            return (
              <View key={grade.id} style={styles.gradeRow}>
                <View style={styles.gradeInfo}>
                  <Text style={styles.gradeTitle}>{grade.title}</Text>
                  <Text style={styles.gradeClass}>{grade.class_name}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: pct >= 70 ? COLORS.successBg : pct >= 50 ? COLORS.warningBg : COLORS.dangerBg }]}>
                  <Text style={[styles.pillText, { color: pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.danger }]}>
                    {pct}%
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </TouchableOpacity>

      {/* Assignments */}
      <TouchableOpacity style={styles.sectionCard} onPress={() => router.push('/(student)/assignments')} activeOpacity={0.7}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
          <Text style={styles.statLink}>View all →</Text>
        </View>
        {upcomingAssignments.length === 0 ? (
          <Text style={styles.emptyText}>No assignments posted</Text>
        ) : (
          upcomingAssignments.map((a) => {
            const daysLeft = a.due_date ? Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000) : null;
            const overdue = daysLeft !== null && daysLeft < 0;
            return (
              <View key={a.id} style={styles.gradeRow}>
                <View style={styles.gradeInfo}>
                  <Text style={styles.gradeTitle}>{a.title}</Text>
                  <Text style={styles.gradeClass}>{a.class_name}</Text>
                </View>
                {daysLeft !== null && (
                  <View style={[styles.pill, { backgroundColor: overdue ? COLORS.dangerBg : daysLeft <= 3 ? COLORS.warningBg : COLORS.surfaceAlt }]}>
                    <Text style={[styles.pillText, { color: overdue ? COLORS.danger : daysLeft <= 3 ? COLORS.warning : COLORS.textSecondary }]}>
                      {overdue ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </TouchableOpacity>

      {/* Notices */}
      <TouchableOpacity style={styles.sectionCard} onPress={() => router.push('/(student)/notices')} activeOpacity={0.7}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest Notices</Text>
          <Text style={styles.statLink}>View all →</Text>
        </View>
        {recentNotices.length === 0 ? (
          <Text style={styles.emptyText}>No notices</Text>
        ) : (
          recentNotices.map((n) => (
            <View key={n.id} style={styles.noticeItem}>
              <Text style={styles.noticeTitle}>{n.title}</Text>
              <Text style={styles.noticeBody} numberOfLines={2}>{n.body}</Text>
              <Text style={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        )}
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 28,
  },
  greeting: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },

  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statBoxAlt: {
    backgroundColor: COLORS.surfaceAlt,
    marginHorizontal: 6,
    borderRadius: 12,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { color: COLORS.textTertiary, fontSize: 14, fontStyle: 'italic' },

  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  gradeInfo: { flex: 1 },
  gradeTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  gradeClass: { fontSize: 13, color: COLORS.textSecondary },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillText: { fontSize: 13, fontWeight: '700' },

  noticeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  noticeTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 3 },
  noticeBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
  noticeDate: { fontSize: 11, color: COLORS.textTertiary },
});
