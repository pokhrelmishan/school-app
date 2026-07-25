import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface Notice {
  id: string;
  title: string;
  body: string;
  target_roles: string[];
  created_at: string;
}

export default function StudentNoticesScreen() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNotices = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('id, title, body, target_roles, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setNotices(data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchNotices();
  }, [user?.id]);

  const getNoticeTypeColor = (roles: string[]) => {
    if (roles?.includes('admin') && roles.length === 1) return COLORS.danger;
    if (roles?.length === 1) return COLORS.pencil;
    return COLORS.chalk;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Notices</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotices}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notices at the moment.</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.typeDot, { backgroundColor: getNoticeTypeColor(item.target_roles) }]} />
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                {item.target_roles && item.target_roles.length > 0 && (
                  <Text style={styles.audienceText}>
                    For: {item.target_roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                  </Text>
                )}
              </View>
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
    borderLeftColor: COLORS.chalk,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.ink,
    flex: 1,
  },
  cardBody: {
    fontSize: 14,
    color: COLORS.graphite,
    lineHeight: 21,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
  audienceText: {
    fontSize: 12,
    color: COLORS.graphite,
    fontStyle: 'italic',
  },
});
