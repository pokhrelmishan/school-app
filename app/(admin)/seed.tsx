import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';

interface Counts {
  teachers: number;
  students: number;
  parents: number;
  classes: number;
  enrollments: number;
  attendance: number;
  grades: number;
}

export default function AdminSeedScreen() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const [teachers, students, parents, classes, enrollments, attendance, grades] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'parent'),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('class_enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('*', { count: 'exact', head: true }),
        supabase.from('grade_entries').select('*', { count: 'exact', head: true }),
      ]);
      setCounts({
        teachers: teachers.count || 0,
        students: students.count || 0,
        parents: parents.count || 0,
        classes: classes.count || 0,
        enrollments: enrollments.count || 0,
        attendance: attendance.count || 0,
        grades: grades.count || 0,
      });
    } catch {
      // counts stay null
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCounts(); }, []);

  const isSeeded = counts && counts.students > 0;

  const CountRow = ({ label, value }: { label: string; value: number }) => (
    <View style={styles.countRow}>
      <Text style={styles.countLabel}>{label}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seed Data</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.chalk} style={{ marginTop: 32 }} />
        ) : isSeeded ? (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Demo data is loaded</Text>
            </View>

            <Text style={styles.sectionLabel}>Database</Text>
            <View style={styles.countsCard}>
              <CountRow label="Teachers" value={counts!.teachers} />
              <View style={styles.divider} />
              <CountRow label="Students" value={counts!.students} />
              <View style={styles.divider} />
              <CountRow label="Parents" value={counts!.parents} />
              <View style={styles.divider} />
              <CountRow label="Classes" value={counts!.classes} />
              <View style={styles.divider} />
              <CountRow label="Enrollments" value={counts!.enrollments} />
              <View style={styles.divider} />
              <CountRow label="Attendance Records" value={counts!.attendance} />
              <View style={styles.divider} />
              <CountRow label="Grade Entries" value={counts!.grades} />
            </View>

            <Text style={styles.sectionLabel}>Demo Accounts</Text>
            <Text style={styles.hint}>All passwords: password123</Text>
            <View style={styles.accountsCard}>
              <Text style={styles.accountRole}>Teachers</Text>
              <Text style={styles.accountEmail}>sarah.jones@edify.demo</Text>
              <Text style={styles.accountEmail}>james.wilson@edify.demo</Text>
              <View style={styles.accountDivider} />
              <Text style={styles.accountRole}>Students</Text>
              <Text style={styles.accountEmail}>aisha.patel@edify.demo</Text>
              <Text style={styles.accountEmail}>omar.hassan@edify.demo</Text>
              <Text style={styles.accountEmail}>lily.chen@edify.demo</Text>
              <Text style={styles.accountEmail}>rajan.sharma@edify.demo</Text>
              <Text style={styles.accountEmail}>emma.brown@edify.demo</Text>
              <View style={styles.accountDivider} />
              <Text style={styles.accountRole}>Parents</Text>
              <Text style={styles.accountEmail}>priya.patel@edify.demo</Text>
              <Text style={styles.accountEmail}>yusuf.hassan@edify.demo</Text>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={fetchCounts}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No demo data yet</Text>
              <Text style={styles.emptyText}>
                Run the seed script in Supabase SQL Editor to populate demo users, classes, attendance, and grades.
              </Text>
              <Text style={styles.emptyStep}>1. Go to Supabase Dashboard {'\u2192'} SQL Editor</Text>
              <Text style={styles.emptyStep}>2. Paste the contents of supabase/seed.sql</Text>
              <Text style={styles.emptyStep}>3. Click Run</Text>
              <Text style={styles.emptyStep}>4. Come back and tap Refresh below</Text>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={fetchCounts}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.cover,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.paper,
    letterSpacing: -0.5,
  },
  content: {
    padding: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chalk + '15',
    borderWidth: 1,
    borderColor: COLORS.chalk + '30',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.chalk,
  },
  statusText: {
    color: COLORS.chalk,
    fontWeight: '700',
    fontSize: 15,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  countsCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  countLabel: {
    fontSize: 15,
    color: COLORS.ink,
  },
  countBadge: {
    backgroundColor: COLORS.pencil + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.pencil,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.line,
  },
  hint: {
    fontSize: 13,
    color: COLORS.graphite,
    marginBottom: 10,
  },
  accountsCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  accountRole: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  accountEmail: {
    fontSize: 14,
    color: COLORS.ink,
    fontFamily: 'Courier',
    marginBottom: 2,
  },
  accountDivider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.graphite,
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyStep: {
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 6,
    paddingLeft: 8,
  },
  refreshButton: {
    backgroundColor: COLORS.chalk,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  refreshText: {
    color: COLORS.paper,
    fontWeight: '700',
    fontSize: 15,
  },
});
