import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface AttendanceRecord {
  id: string;
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

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function StudentAttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [attRes, evtRes] = await Promise.all([
      supabase.from('attendance_records').select('id, date, status, notes, class:classes(name, grade_level)').eq('student_id', user.id).order('date', { ascending: false }),
      supabase.from('events').select('id, title, event_date, event_type'),
    ]);
    if (attRes.data) setRecords(attRes.data as unknown as AttendanceRecord[]);
    if (evtRes.data) setEvents(evtRes.data as CalendarEvent[]);
    setLoading(false);
  };

  useEffect(() => { if (user?.id) fetchData(); }, [user?.id]);

  const navigateMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const getStatusForDate = (dateStr: string) => records.find(r => r.date === dateStr)?.status || null;
  const getEventsForDate = (dateStr: string) => events.filter(e => e.event_date === dateStr);

  const getMonthStats = () => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const m = records.filter(r => r.date.startsWith(prefix));
    return { present: m.filter(r => r.status === 'present').length, absent: m.filter(r => r.status === 'absent').length, late: m.filter(r => r.status === 'late').length };
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
      <View style={styles.calendarCard}>
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
            const dayEvts = getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;

            let bg = 'transparent';
            let color = COLORS.text;
            if (status === 'absent') { bg = COLORS.dangerBg; color = COLORS.danger; }
            else if (status === 'late') { bg = COLORS.warningBg; color = COLORS.warning; }
            else if (status === 'present') { bg = COLORS.successBg; color = COLORS.success; }

            return (
              <View key={dateStr} style={[styles.cell, { backgroundColor: bg }, isToday && styles.cellToday]}>
                <Text style={[styles.cellDay, { color }, isToday && styles.cellDayToday]}>{day}</Text>
                {(status === 'absent' || status === 'late' || dayEvts.length > 0) && (
                  <View style={[styles.dot, { backgroundColor: status === 'absent' ? COLORS.danger : status === 'late' ? COLORS.warning : COLORS.primary }]} />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.success }]} /><Text style={styles.legendText}>Present</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} /><Text style={styles.legendText}>Absent</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} /><Text style={styles.legendText}>Late</Text></View>
        </View>

        <View style={styles.monthSummary}>
          <Text style={styles.monthSummaryText}>
            {stat.present} present · {stat.absent} absent · {stat.late} late
          </Text>
        </View>
      </View>
    );
  };

  const statusColor = (s: string) => {
    if (s === 'present') return COLORS.success;
    if (s === 'absent') return COLORS.danger;
    if (s === 'late') return COLORS.warning;
    return COLORS.textSecondary;
  };

  const statusBg = (s: string) => {
    if (s === 'present') return COLORS.successBg;
    if (s === 'absent') return COLORS.dangerBg;
    if (s === 'late') return COLORS.warningBg;
    return COLORS.surfaceAlt;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Attendance</Text>

      {renderCalendar()}

      <Text style={styles.sectionTitle}>History</Text>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No records yet</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            return (
              <View style={styles.recordCard}>
                <View style={styles.recordRow}>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordClass}>{className || 'Class'}</Text>
                    <Text style={styles.recordDate}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusBg(item.status) }]}>
                    <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                  </View>
                </View>
                {item.notes ? <Text style={styles.recordNotes}>{item.notes}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 20 },

  calendarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.md,
  },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: COLORS.surfaceAlt },
  navText: { fontSize: 22, fontWeight: '600', color: COLORS.text },
  monthTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  dayLabels: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textTertiary, paddingVertical: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginVertical: 1 },
  cellToday: { borderWidth: 2, borderColor: COLORS.primary },
  cellDay: { fontSize: 14, fontWeight: '500' },
  cellDayToday: { fontWeight: '800' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  monthSummary: { marginTop: 12, alignItems: 'center' },
  monthSummaryText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 24 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },

  recordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordInfo: { flex: 1 },
  recordClass: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  recordDate: { fontSize: 13, color: COLORS.textSecondary },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  recordNotes: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, fontStyle: 'italic' },
});
