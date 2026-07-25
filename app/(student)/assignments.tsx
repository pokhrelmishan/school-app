import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface AssignmentAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  class?: { name: string };
  assignment_attachments?: AssignmentAttachment[];
}

export default function StudentAssignmentsScreen() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAssignments = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id, title, description, due_date, created_at,
          class:classes(name),
          assignment_attachments(id, file_url, file_name, file_type)
        `)
        .order('due_date', { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setAssignments(data as unknown as Assignment[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchAssignments();
  }, [user?.id]);

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Due today';
    return `${diff}d left`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Assignments</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAssignments}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No assignments posted yet.</Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const class_name = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            const overdue = isOverdue(item.due_date);
            const daysLeft = getDaysUntilDue(item.due_date);
            const attachments = item.assignment_attachments || [];

            return (
              <View style={[styles.card, overdue && styles.cardOverdue]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardClass}>{class_name}</Text>
                  </View>
                  {daysLeft && (
                    <View style={[styles.dueBadge, overdue && styles.dueBadgeOverdue]}>
                      <Text style={[styles.dueBadgeText, overdue && styles.dueBadgeTextOverdue]}>{daysLeft}</Text>
                    </View>
                  )}
                </View>

                {item.description ? (
                  <Text style={styles.description}>{item.description}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  {item.due_date && (
                    <Text style={styles.metaText}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
                  )}
                  <Text style={styles.metaText}>Posted: {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                {attachments.length > 0 && (
                  <View style={styles.attachmentsSection}>
                    <Text style={styles.attachmentsTitle}>Attachments</Text>
                    {attachments.map((att) => (
                      <TouchableOpacity
                        key={att.id}
                        style={styles.attachmentLink}
                        onPress={() => Linking.openURL(att.file_url)}
                      >
                        <Text style={styles.attachmentText}>📄 {att.file_name}</Text>
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
  },
  card: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  cardOverdue: {
    borderLeftColor: COLORS.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 2,
  },
  cardClass: {
    fontSize: 14,
    color: COLORS.graphite,
  },
  dueBadge: {
    backgroundColor: COLORS.chalk + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dueBadgeOverdue: {
    backgroundColor: COLORS.danger + '20',
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.chalk,
  },
  dueBadgeTextOverdue: {
    color: COLORS.danger,
  },
  description: {
    fontSize: 14,
    color: COLORS.graphite,
    marginBottom: 10,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
  attachmentsSection: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.line,
    paddingTop: 10,
  },
  attachmentsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 6,
  },
  attachmentLink: {
    paddingVertical: 4,
  },
  attachmentText: {
    fontSize: 14,
    color: COLORS.cover,
    textDecorationLine: 'underline',
  },
});
