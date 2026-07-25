import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface AttendanceRecord {
  id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  class?: {
    name: string;
    grade_level: string;
    teacher?: {
      full_name: string;
    };
  };
}

export default function StudentAttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchAttendance = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          class_id,
          student_id,
          date,
          status,
          notes,
          class:classes(name, grade_level, teacher:profiles!classes_teacher_id_fkey(full_name))
        `)
        .eq('student_id', user?.id)
        .gte('date', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
        .order('date', { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setRecords(data as unknown as AttendanceRecord[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAttendance();
    }
  }, [user?.id, selectedMonth, selectedYear]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return COLORS.chalk;
      case 'absent':
        return COLORS.danger;
      case 'late':
        return COLORS.pencil;
      case 'excused':
        return COLORS.graphite;
      default:
        return COLORS.ink;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Late';
      case 'excused':
        return 'Excused';
      default:
        return status;
    }
  };

  const getAttendanceStats = () => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const excused = records.filter(r => r.status === 'excused').length;
    
    const percentage = total > 0 ? (present / total) * 100 : 0;
    
    return { total, present, absent, late, excused, percentage };
  };

  const stats = getAttendanceStats();

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>My Attendance</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.percentage.toFixed(1)}%</Text>
          <Text style={styles.statLabel}>Present Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{stats.absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.pencil }]}>{stats.late}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity 
          style={styles.monthButton}
          onPress={() => {
            if (selectedMonth > 1) {
              setSelectedMonth(selectedMonth - 1);
            } else {
              setSelectedMonth(12);
              setSelectedYear(selectedYear - 1);
            }
          }}
        >
          <Text style={styles.monthButtonText}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.monthText}>
          {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        
        <TouchableOpacity 
          style={styles.monthButton}
          onPress={() => {
            if (selectedMonth < 12) {
              setSelectedMonth(selectedMonth + 1);
            } else {
              setSelectedMonth(1);
              setSelectedYear(selectedYear + 1);
            }
          }}
        >
          <Text style={styles.monthButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAttendance}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attendance records found for this period.</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.className}>{item.class?.name || 'Unknown Class'}</Text>
                  <Text style={styles.gradeLevel}>{item.class?.grade_level || ''}</Text>
                </View>
                
                <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.badgeText}>{getStatusText(item.status)}</Text>
                </View>
              </View>

              <Text style={styles.dateText}>Date: {item.date}</Text>
              
              {item.class?.teacher?.full_name && (
                <Text style={styles.teacherText}>Teacher: {item.class.teacher.full_name}</Text>
              )}

              {item.notes ? (
                <Text style={styles.notesText}>Notes: {item.notes}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.graphite,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  monthButton: {
    padding: 8,
    backgroundColor: COLORS.paper,
    borderRadius: 4,
  },
  monthButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
  },
  loader: {
    marginTop: 32,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  errorText: {
    color: COLORS.danger,
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.cover,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.paper,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.graphite,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.cover,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  gradeLevel: {
    fontSize: 14,
    color: COLORS.graphite,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  badgeText: {
    color: COLORS.paper,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 14,
    color: COLORS.graphite,
    marginTop: 2,
  },
  teacherText: {
    fontSize: 13,
    color: COLORS.ink,
    marginTop: 4,
    fontStyle: 'italic',
  },
  notesText: {
    fontSize: 13,
    color: COLORS.ink,
    marginTop: 4,
    fontStyle: 'italic',
  },
});