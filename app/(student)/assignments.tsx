import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  class?: { name: string };
  assignment_attachments?: { id: string; file_url: string; file_name: string }[];
}

export default function StudentAssignmentsScreen() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const fetchAssignments = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const { data } = await supabase
      .from('assignments')
      .select('id, title, description, due_date, created_at, class:classes(name), assignment_attachments(id, file_url, file_name)')
      .order('due_date', { ascending: true });
    if (data) setAssignments(data as unknown as Assignment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.id) fetchAssignments();
  }, [user?.id, fetchAssignments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments(true);
    setRefreshing(false);
  };

  const toggleDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDaysLeft = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: 'Today', overdue: false };
    if (diff <= 3) return { text: `${diff}d`, overdue: false };
    return { text: `${diff}d`, overdue: false };
  };

  const priorityDot = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (diff < 0) return COLORS.danger;
    if (diff <= 2) return COLORS.pencil;
    return COLORS.graphiteLight;
  };

  const pendingAssignments = assignments.filter((a) => !doneIds.has(a.id));
  const doneAssignments = assignments.filter((a) => doneIds.has(a.id));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) return <LoadingScreen text="Loading homework..." />;

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
      <ScreenHeader title="Homework" />

      <View style={styles.body}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.togglePill, !showDone && styles.togglePillActive]}
            activeOpacity={0.7}
            onPress={() => setShowDone(false)}
          >
            <Text style={[styles.toggleText, !showDone && styles.toggleTextActive]}>
              Pending ({pendingAssignments.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, showDone && styles.togglePillActive]}
            activeOpacity={0.7}
            onPress={() => setShowDone(true)}
          >
            <Text style={[styles.toggleText, showDone && styles.toggleTextActive]}>
              Done ({doneAssignments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {(!showDone ? pendingAssignments : doneAssignments).length === 0 ? (
          <NotebookCard>
            <EmptyState
              icon={showDone ? '✅' : '📄'}
              title={showDone ? 'No completed tasks' : 'No pending homework'}
              subtitle={showDone ? 'Complete tasks to see them here' : "You're all caught up!"}
            />
          </NotebookCard>
        ) : (
          (!showDone ? pendingAssignments : doneAssignments).map((item) => {
            const days = getDaysLeft(item.due_date);
            const isDone = doneIds.has(item.id);
            const className = Array.isArray(item.class)
              ? item.class[0]?.name
              : item.class?.name;
            const dot = priorityDot(item.due_date);

            return (
              <NotebookCard key={item.id}>
                <View style={styles.assignmentRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, isDone && styles.checkboxDone]}
                    activeOpacity={0.7}
                    onPress={() => toggleDone(item.id)}
                  >
                    {isDone && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentClass}>
                      {className || 'Class'}
                    </Text>
                    <Text
                      style={[
                        styles.assignmentTitle,
                        isDone && styles.assignmentTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={styles.assignmentDesc} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={styles.assignmentDue}>
                      Due {formatDate(item.due_date)}
                    </Text>
                  </View>
                  <View style={styles.assignmentRight}>
                    <View style={[styles.dot, { backgroundColor: dot }]} />
                    {days && !isDone && (
                      <BadgeCompact text={days.text} overdue={days.overdue} />
                    )}
                  </View>
                </View>
              </NotebookCard>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

function BadgeCompact({ text, overdue }: { text: string; overdue: boolean }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: overdue ? COLORS.dangerBg : COLORS.paperDim },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: overdue ? COLORS.danger : COLORS.graphite },
        ]}
      >
        {text}
      </Text>
    </View>
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

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  togglePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  togglePillActive: {
    backgroundColor: COLORS.cover,
    borderColor: COLORS.cover,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.graphite,
  },
  toggleTextActive: {
    color: COLORS.paper,
  },

  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: COLORS.chalk,
    borderColor: COLORS.chalk,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentClass: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.tape,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  assignmentTitleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.graphiteLight,
  },
  assignmentDesc: {
    fontSize: 12,
    color: COLORS.graphite,
    marginBottom: 2,
  },
  assignmentDue: {
    fontSize: 11,
    color: COLORS.graphiteLight,
  },
  assignmentRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
