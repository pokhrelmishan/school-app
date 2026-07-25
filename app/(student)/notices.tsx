import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
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

  const fetchNotices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('id, title, body, target_roles, created_at')
      .order('created_at', { ascending: false });
    if (data) setNotices(data);
    setLoading(false);
  };

  useEffect(() => { if (user?.id) fetchNotices(); }, [user?.id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Notices</Text>

      {notices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notices at the moment</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.dot} />
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                {item.target_roles?.length > 0 && (
                  <View style={styles.audiencePill}>
                    <Text style={styles.audienceText}>
                      {item.target_roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                    </Text>
                  </View>
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
    ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardBody: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, marginBottom: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12, color: COLORS.textTertiary },
  audiencePill: { backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  audienceText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
});
