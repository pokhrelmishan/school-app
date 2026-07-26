import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
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

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function StudentNoticesScreen() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotices = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false });
    if (data) setNotices(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.id) fetchNotices();
  }, [user?.id, fetchNotices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotices(true);
    setRefreshing(false);
  };

  if (loading) return <LoadingScreen text="Loading news..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="News" />
      <View style={styles.body}>
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.tape}
              colors={[COLORS.tape]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="📢"
              title="No news yet"
              subtitle="Announcements will appear here"
            />
          }
          renderItem={({ item }) => (
            <NotebookCard>
              <View style={styles.noticeHeader}>
                <View style={styles.fromTag}>
                  <Text style={styles.fromTagText}>SCHOOL</Text>
                </View>
                <Text style={styles.noticeTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={styles.noticeTitle}>{item.title}</Text>
              <Text style={styles.noticeBody}>{item.body}</Text>
            </NotebookCard>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  list: {
    paddingBottom: 24,
  },

  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fromTag: {
    backgroundColor: COLORS.tape,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fromTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  noticeTime: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 14,
    color: COLORS.graphite,
    lineHeight: 21,
  },
});
