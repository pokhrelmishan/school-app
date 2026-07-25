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
  class?: { name: string; grade_level: string };
}

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function StudentAttendanceScreen() {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const [attResult, evtResult] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, class_id, student_id, date, status, notes, class:classes(name, grade_level)')
          .eq('student_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('events')
          .select('id, title, event_date, event_type'),
      ]);

      if (attResult.error) {
        setErrorMsg(attResult.error.message);
        return;
      }

      if (attResult.data) {
        setAttendanceRecords(attResult.data as unknown as AttendanceRecord[]);
      }

      if (evtResult.data) {
        setEvents(evtResult.data as CalendarEvent[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const navigateMonth = (dir: number) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  const getStatusForDate = (dateStr: string) => {
    const rec = attendanceRecords.find(r => r.date === dateStr);
    return rec?.status || null;
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter(e => e.event_date === dateStr);
  };

  const getMonthStats = () => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthRecords = attendanceRecords.filter(r => r.date.startsWith(prefix));
    return {
      present: monthRecords.filter(r => r.status === 'present').length,
      absent: monthRecords.filter(r => r.status === 'absent').length,
      late: monthRecords.filter(r => r.status === 'late').length,
      total: monthRecords.length,
    };
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayStr = today.toISOString().split('T')[0];
    const cells: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const stat = getMonthStats();

    return (
      <View style={styles.calendarSection}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayLabelsRow}>
          {DAYS.map(d => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`empty-${idx}`} style={styles.cell} />;

            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = getStatusForDate(dateStr);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;
            const isAbsent = status === 'absent';
            const isLate = status === 'late';

            let cellBg = 'transparent';
            let textColor = COLORS.ink;
            let dotColor: string | null = null;

            if (isAbsent) {
              cellBg = COLORS.danger + '25';
              textColor = COLORS.danger;
              dotColor = COLORS.danger;
            } else if (isLate) {
              cellBg = COLORS.ink + '15';
              textColor = COLORS.ink;
              dotColor = COLORS.ink;
            } else if (status === 'present') {
              cellBg = COLORS.chalk + '15';
              textColor = COLORS.chalk;
              dotColor = COLORS.chalk;
            }

            if (dayEvents.length > 0 && !dotColor) {
              dotColor = COLORS.pencil;
            }

            return (
              <View
                key={dateStr}
                style={[
                  styles.cell,
                  { backgroundColor: cellBg },
                  isToday && styles.cellToday,
                ]}
              >
                <Text style={[styles.cellDay, { color: textColor }, isToday && styles.cellDayToday]}>
                  {day}
                </Text>
                {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.chalk }]} /><Text style={styles.legendText}>Present</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} /><Text style={styles.legendText}>Absent</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.ink }]} /><Text style={styles.legendText}>Late</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.pencil }]} /><Text style={styles.legendText}>Event</Text></View>
        </View>

        <View style={styles.monthStats}>
          <Text style={styles.monthStatsText}>
            Present: {stat.present} | Absent: {stat.absent} | Late: {stat.late}
          </Text>
        </View>
      </View>
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return COLORS.chalk;
      case 'absent': return COLORS.danger;
      case 'late': return COLORS.ink;
      case 'excused': return COLORS.pencil;
      default: return COLORS.graphite;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.chalk} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>My Attendance</Text>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {renderCalendar()}

      <Text style={styles.sectionTitle}>Attendance History</Text>

      {attendanceRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attendance records yet.</Text>
        </View>
      ) : (
        <FlatList
          data={attendanceRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{className || 'Unknown Class'}</Text>
                    <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.statusBadgeText}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                  </View>
                </View>
                {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              </View>
            );
          }}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.paper,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 16,
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
  calendarSection: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  navBtnText: {
    fontSize: 24,
    color: COLORS.cover,
    fontWeight: 'bold',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.graphite,
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
    borderRadius: 6,
    marginVertical: 1,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: COLORS.cover,
  },
  cellDay: {
    fontSize: 14,
    fontWeight: '500',
  },
  cellDayToday: {
    fontWeight: 'bold',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.graphite,
  },
  monthStats: {
    marginTop: 10,
    alignItems: 'center',
  },
  monthStatsText: {
    fontSize: 13,
    color: COLORS.graphite,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: COLORS.graphite,
    fontSize: 16,
  },
  card: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: COLORS.paper,
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardNotes: {
    fontSize: 13,
    color: COLORS.graphite,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
