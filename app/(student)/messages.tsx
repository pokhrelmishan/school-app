import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
}

interface Teacher {
  id: string;
  full_name: string;
  role_label: string;
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

export default function StudentMessagesScreen() {
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [composing, setComposing] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Teacher | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const msgs = data || [];

      const otherIds = new Set<string>();
      msgs.forEach((m: Message) => {
        if (m.sender_id !== user.id) otherIds.add(m.sender_id);
        if (m.recipient_id !== user.id) otherIds.add(m.recipient_id);
      });

      let nameMap: Record<string, string> = {};
      if (otherIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(otherIds));

        if (profiles) {
          profiles.forEach((p: any) => {
            nameMap[p.id] = p.full_name || 'Unknown';
          });
        }
      }

      const enriched = msgs.map((m: Message) => ({
        ...m,
        sender_name: m.sender_id === user.id ? 'You' : nameMap[m.sender_id] || 'Unknown',
        recipient_name: m.recipient_id === user.id ? 'You' : nameMap[m.recipient_id] || 'Unknown',
      }));

      setMessages(enriched);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const fetchTeachers = async () => {
    if (!user?.id) return;

    try {
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id);

      if (!enrollments || enrollments.length === 0) {
        setTeachers([]);
        return;
      }

      const classIds = enrollments.map((e: any) => e.class_id);

      const { data: classes } = await supabase
        .from('classes')
        .select('id, teacher_id')
        .in('id', classIds);

      const teacherIds = new Set<string>();
      if (classes) {
        classes.forEach((c: any) => {
          if (c.teacher_id) teacherIds.add(c.teacher_id);
        });
      }

      const { data: tsData } = await supabase
        .from('teacher_subjects')
        .select('teacher_id')
        .in('class_id', classIds);

      if (tsData) {
        tsData.forEach((ts: any) => {
          if (ts.teacher_id) teacherIds.add(ts.teacher_id);
        });
      }

      if (teacherIds.size === 0) {
        setTeachers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(teacherIds));

      const result: Teacher[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Unknown Teacher',
        role_label: 'Teacher',
      }));

      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setTeachers(result);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

  const handleOpenCompose = () => {
    setComposing(true);
    setSelectedRecipient(null);
    setMessageBody('');
    setSearchQuery('');
    fetchTeachers();
  };

  const handleSend = async () => {
    if (!user?.id || !selectedRecipient || !messageBody.trim()) return;
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: selectedRecipient.id,
        body: messageBody.trim(),
      });

      if (error) throw error;

      setComposing(false);
      setSelectedRecipient(null);
      setMessageBody('');
      fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredTeachers = teachers.filter((t) =>
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.sender_id === user?.id;
    const otherName = isSent ? item.recipient_name : item.sender_name;
    const preview = item.body.length > 80 ? item.body.slice(0, 80) + '...' : item.body;

    return (
      <TouchableOpacity style={styles.msgCard} activeOpacity={0.7}>
        <View style={styles.msgLeft}>
          <View style={[styles.msgAvatar, isSent && styles.msgAvatarSent]}>
            <Text style={[styles.msgAvatarText, isSent && styles.msgAvatarTextSent]}>
              {(otherName || '?')[0]}
            </Text>
          </View>
          <View style={styles.msgContent}>
            <View style={styles.msgTopRow}>
              <Text style={styles.msgName} numberOfLines={1}>
                {isSent ? `To: ${otherName}` : otherName}
              </Text>
              <Text style={styles.msgTime}>{timeAgo(item.created_at)}</Text>
            </View>
            <Text style={styles.msgPreview} numberOfLines={2}>
              {preview}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {composing ? (
        <KeyboardAvoidingView
          style={styles.composeContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!selectedRecipient ? (
            <View style={styles.pickerSection}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Teacher</Text>
                <TouchableOpacity onPress={() => setComposing(false)}>
                  <Text style={{ fontSize: 24, color: COLORS.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search teachers..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <FlatList
                data={filteredTeachers}
                keyExtractor={(item) => item.id}
                renderItem={({ item: t }) => (
                  <TouchableOpacity
                    style={styles.teacherRow}
                    activeOpacity={0.7}
                    onPress={() => setSelectedRecipient(t)}
                  >
                    <View style={styles.teacherAvatar}>
                      <Text style={styles.teacherAvatarText}>{t.full_name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teacherName}>{t.full_name}</Text>
                      <Text style={styles.teacherRole}>{t.role_label}</Text>
                    </View>
                    <Text style={{ fontSize: 18, color: COLORS.textTertiary }}>➡️</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No teachers found in your classes</Text>
                }
              />
            </View>
          ) : (
            <View style={styles.composeSection}>
              <View style={styles.composeHeader}>
                <TouchableOpacity
                  onPress={() => setSelectedRecipient(null)}
                  style={styles.backBtn}
                >
                  <Text style={{ fontSize: 22, color: COLORS.primary }}>←</Text>
                </TouchableOpacity>
                <Text style={styles.composeTo} numberOfLines={1}>
                  To: {selectedRecipient.full_name}
                </Text>
                <TouchableOpacity onPress={() => setComposing(false)}>
                  <Text style={{ fontSize: 24, color: COLORS.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.bodyInput}
                placeholder="Type your message..."
                placeholderTextColor={COLORS.textTertiary}
                value={messageBody}
                onChangeText={setMessageBody}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!messageBody.trim() || sending) && styles.sendBtnDisabled,
                ]}
                activeOpacity={0.7}
                onPress={handleSend}
                disabled={!messageBody.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={COLORS.textInverse} />
                ) : (
                  <Text style={styles.sendBtnText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : (
        <>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 64, color: COLORS.textTertiary }}>💬</Text>
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptySubtitle}>
                Tap the button below to message a teacher.
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={handleOpenCompose}>
            <Text style={{ fontSize: 28, color: COLORS.textInverse }}>✉️</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  list: {
    paddingBottom: 80,
  },
  msgCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  msgLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  msgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  msgAvatarSent: {
    backgroundColor: COLORS.successBg,
  },
  msgAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  msgAvatarTextSent: {
    color: COLORS.success,
  },
  msgContent: {
    flex: 1,
  },
  msgTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  msgName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  msgTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  msgPreview: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },

  composeContainer: {
    flex: 1,
  },
  pickerSection: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    ...SHADOWS.sm,
  },
  teacherAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  teacherRole: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textTertiary,
    marginTop: 32,
    fontSize: 15,
  },

  composeSection: {
    flex: 1,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    marginRight: 10,
  },
  composeTo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  bodyInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 120,
    marginBottom: 12,
    lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: COLORS.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
