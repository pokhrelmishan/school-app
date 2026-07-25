import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, PrimaryButton, EmptyState, LoadingScreen } from '../../lib/components';

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function AnnouncementsScreen() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');

  const schoolId = profile?.school_id;

  const fetchNotices = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (data) setNotices(data);
  }, [schoolId]);

  useEffect(() => {
    fetchNotices().finally(() => setLoading(false));
  }, [fetchNotices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotices();
    setRefreshing(false);
  }, [fetchNotices]);

  const openModal = () => {
    setFormTitle('');
    setFormBody('');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      Alert.alert('Missing fields', 'Please enter both title and body.');
      return;
    }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('notices').insert({
        title: formTitle.trim(),
        body: formBody.trim(),
        school_id: schoolId,
      });
      if (error) throw error;
      setModalVisible(false);
      await fetchNotices();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (notice: Notice) => {
    Alert.alert('Delete Announcement', `Delete "${notice.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('notices').delete().eq('id', notice.id);
          if (!error) fetchNotices();
        },
      },
    ]);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <LoadingScreen text="Loading announcements..." />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <PageHeader
          title="Announcements"
          subtitle={`${notices.length} total`}
          right={<PrimaryButton title="New" icon="+" onPress={openModal} />}
        />

        {notices.length === 0 ? (
          <EmptyState
            icon="📢"
            title="No Announcements"
            subtitle="Post an announcement visible to your entire school."
            action={{ label: 'Post Announcement', onPress: openModal }}
          />
        ) : (
          notices.map((notice) => (
            <Card key={notice.id} style={styles.noticeCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => handleDelete(notice)}
              >
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeBody}>{notice.body}</Text>
                <Text style={styles.noticeDate}>{formatDateTime(notice.created_at)}</Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Announcement</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Announcement title"
              placeholderTextColor={COLORS.textTertiary}
              value={formTitle}
              onChangeText={setFormTitle}
              autoFocus
            />

            <Text style={styles.label}>Body</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder="Write your announcement here..."
              placeholderTextColor={COLORS.textTertiary}
              value={formBody}
              onChangeText={setFormBody}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  content: {
    paddingBottom: 100,
  },
  noticeCard: {
    padding: 16,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  noticeBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  noticeDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  bodyInput: {
    height: 140,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
