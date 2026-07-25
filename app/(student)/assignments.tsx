import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

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

  const fetchAssignments = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const { data } = await supabase
      .from('assignments')
      .select('id, title, description, due_date, created_at, class:classes(name), assignment_attachments(id, file_url, file_name)')
      .order('due_date', { ascending: true });
    if (data) setAssignments(data as unknown as Assignment[]);
    setLoading(false);
  };

  useEffect(() => { if (user?.id) fetchAssignments(); }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments(true);
    setRefreshing(false);
  };

  const getDaysLeft = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true, dueSoon: false };
    if (diff === 0) return { text: 'Due today', overdue: false, dueSoon: true };
    if (diff <= 3) return { text: `${diff}d left`, overdue: false, dueSoon: true };
    return { text: `${diff}d left`, overdue: false, dueSoon: false };
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Assignments</Text>

      {assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No assignments posted yet</Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            const days = getDaysLeft(item.due_date);
            const attachments = item.assignment_attachments || [];

            return (
              <View style={[styles.card, days?.overdue && styles.cardOverdue, days?.dueSoon && !days?.overdue && styles.cardDueSoon]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardClass}>{className}</Text>
                  </View>
                  {days && (
                    <View style={[styles.badge, { backgroundColor: days.overdue ? COLORS.dangerBg : days.dueSoon ? COLORS.warningBg : COLORS.successBg }]}>
                      <Text style={[styles.badgeText, { color: days.overdue ? COLORS.danger : days.dueSoon ? COLORS.warning : COLORS.success }]}>{days.text}</Text>
                    </View>
                  )}
                </View>

                {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

                <View style={styles.metaRow}>
                  {item.due_date && <Text style={styles.metaText}>Due {new Date(item.due_date).toLocaleDateString()}</Text>}
                  <Text style={styles.metaText}>Posted {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                {attachments.length > 0 && (
                  <View style={styles.attachSection}>
                    <Text style={styles.attachLabel}>Attachments</Text>
                    {attachments.map(att => (
                      <TouchableOpacity key={att.id} onPress={() => Linking.openURL(att.file_url)}>
                        <Text style={styles.attachLink}>📎 {att.file_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  cardOverdue: { borderLeftColor: COLORS.danger },
  cardDueSoon: { borderLeftColor: COLORS.warning },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardClass: { fontSize: 13, color: COLORS.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  desc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaText: { fontSize: 12, color: COLORS.textTertiary },
  attachSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  attachLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  attachLink: { fontSize: 14, color: COLORS.primary, marginBottom: 4, fontWeight: '500' },
});
