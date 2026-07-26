import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  class?: { name: string; grade_level: string };
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function StudentAttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    const { data } = await supabase
      .from('attendance_records')
      .select('id, date, status, notes, class:classes(name, grade_level)')
      .eq('student_id', user.id)
      .order('date', { ascending: false });
    if (data) setRecords(data as unknown as AttendanceRecord[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id, fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const navigateMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const getStatusForDate = (dateStr: string) =>
    records.find((r) => r.date === dateStr)?.status || null;

  const getMonthStats = () => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const m = records.filter((r) => r.date.startsWith(prefix));
    return {
      present: m.filter((r) => r.status === 'present').length,
      absent: m.filter((r) => r.status === 'absent').length,
      late: m.filter((r) => r.status === 'late').length,
    };
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const todayStr = today.toISOString().split('T')[0];
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const stat = getMonthStats();

    return (
      <NotebookCard>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
            <Text style={styles.navText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
            <Text style={styles.navText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayLabels}>
          {DAYS.map((d, i) => (
            <Text key={i} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={styles.cell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = getStatusForDate(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <View key={dateStr} style={[styles.cell, isToday && styles.cellToday]}>
                <Text style={[styles.cellDay, isToday && styles.cellDayToday]}>{day}</Text>
                {status && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          status === 'present'
                            ? COLORS.chalk
                            : status === 'absent'
                            ? COLORS.danger
                            : status === 'late'
                            ? COLORS.pencil
                            : COLORS.graphiteLight,
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.chalk }]} />
            <Text style={styles.legendText}>Present</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
            <Text style={styles.legendText}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.pencil }]} />
            <Text style={styles.legendText}>Late</Text>
          </View>
        </View>

        <View style={styles.monthSummary}>
          <Text style={styles.monthSummaryText}>
            {stat.present} present · {stat.absent} absent · {stat.late} late
          </Text>
        </View>
      </NotebookCard>
    );
  };

  const statusColor = (s: string) => {
    if (s === 'present') return COLORS.chalk;
    if (s === 'absent') return COLORS.danger;
    if (s === 'late') return COLORS.pencil;
    return COLORS.graphite;
  };

  if (loading) return <LoadingScreen text="Loading attendance..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.tape}
          colors={[COLORS.tape]}
        />
      }
    >
      <ScreenHeader title="Attendance" />

      <View style={styles.body}>
        {renderCalendar()}

        <Text style={styles.sectionTitle}>History</Text>

        {records.length === 0 ? (
          <NotebookCard>
            <EmptyState icon="📋" title="No records yet" />
          </NotebookCard>
        ) : (
          records.slice(0, 20).map((item) => {
            const className = Array.isArray(item.class)
              ? item.class[0]?.name
              : item.class?.name;
            return (
              <NotebookCard key={item.id}>
                <View style={styles.recordRow}>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordClass}>{className || 'Class'}</Text>
                    <Text style={styles.recordDate}>
                      {new Date(item.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Badge
                    text={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    color={statusColor(item.status)}
                    size="md"
                  />
                </View>
                {item.notes ? (
                  <Text style={styles.recordNotes}>{item.notes}</Text>
                ) : null}
              </NotebookCard>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    padding: 20,
  },

  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.paperDim,
  },
  navText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
  },

  dayLabels: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.graphiteLight,
    paddingVertical: 4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 1,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: COLORS.tape,
  },
  cellDay: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.ink,
  },
  cellDayToday: {
    fontWeight: '800',
    color: COLORS.tape,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.graphite,
    fontWeight: '500',
  },

  monthSummary: {
    marginTop: 12,
    alignItems: 'center',
  },
  monthSummaryText: {
    fontSize: 13,
    color: COLORS.graphite,
    fontWeight: '500',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 16,
  },

  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
  },
  recordClass: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  recordNotes: {
    fontSize: 13,
    color: COLORS.graphiteLight,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
