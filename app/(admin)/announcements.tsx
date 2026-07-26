import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

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
    const { data } = await supabase.from('notices').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
    if (data) setNotices(data);
  }, [schoolId]);

  useEffect(() => { fetchNotices().finally(() => setLoading(false)); }, [fetchNotices]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchNotices(); setRefreshing(false); }, [fetchNotices]);

  const openModal = () => { setFormTitle(''); setFormBody(''); setModalVisible(true); };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formBody.trim()) { Alert.alert('Missing', 'Enter both title and body.'); return; }
    if (!schoolId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('notices').insert({ title: formTitle.trim(), body: formBody.trim(), school_id: schoolId });
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
    Alert.alert('Delete', `Delete "${notice.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('notices').delete().eq('id', notice.id); await fetchNotices(); } },
    ]);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <LoadingScreen text="Loading announcements..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Announcements" subtitle={`${notices.length} total`} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        {notices.length === 0 ? (
          <EmptyState icon={'\u{1F4E2}'} title="No Announcements" subtitle="Post an announcement visible to your school." action={{ label: 'Post Announcement', onPress: openModal }} />
        ) : (
          notices.map((notice) => (
            <TouchableOpacity key={notice.id} activeOpacity={0.7} onLongPress={() => handleDelete(notice)}>
              <NotebookCard accent={COLORS.pencil}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeBody}>{notice.body}</Text>
                <Text style={styles.noticeDate}>{formatDateTime(notice.created_at)}</Text>
              </NotebookCard>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} placeholder="Announcement title" placeholderTextColor={COLORS.graphiteLight} value={formTitle} onChangeText={setFormTitle} autoFocus />
            <Text style={styles.label}>Body</Text>
            <TextInput style={[styles.input, styles.bodyInput]} placeholder="Write your announcement here..." placeholderTextColor={COLORS.graphiteLight} value={formBody} onChangeText={setFormBody} multiline textAlignVertical="top" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Post" onPress={handleCreate} disabled={submitting} loading={submitting} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 16, paddingBottom: 100 },

  noticeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  noticeBody: { fontSize: 13, color: COLORS.graphite, lineHeight: 20 },
  noticeDate: { fontSize: 11, color: COLORS.graphiteLight, marginTop: 10 },

  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.cover, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: COLORS.paper, lineHeight: 30 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.graphite, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.ink, marginBottom: 12 },
  bodyInput: { height: 140 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surfaceAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.graphite },
});
