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
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Avatar,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

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
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function StudentMessagesScreen() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

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

  if (loading) return <LoadingScreen text="Loading messages..." />;

  if (composing) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="New Message" />
        <KeyboardAvoidingView
          style={styles.composeContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.body}>
            {!selectedRecipient ? (
              <>
                <TouchableOpacity
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  onPress={() => setComposing(false)}
                >
                  <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search teachers..."
                  placeholderTextColor={COLORS.graphiteLight}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {filteredTeachers.length === 0 ? (
                  <NotebookCard>
                    <EmptyState
                      icon="👩‍🏫"
                      title="No teachers found"
                      subtitle="No teachers in your classes"
                    />
                  </NotebookCard>
                ) : (
                  filteredTeachers.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.teacherRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedRecipient(t)}
                    >
                      <Avatar name={t.full_name} size={38} color={COLORS.tape} />
                      <View style={styles.teacherInfo}>
                        <Text style={styles.teacherName}>{t.full_name}</Text>
                        <Text style={styles.teacherRole}>{t.role_label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </>
            ) : (
              <>
                <View style={styles.composeHeader}>
                  <TouchableOpacity
                    onPress={() => setSelectedRecipient(null)}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.composeTo} numberOfLines={1}>
                    To: {selectedRecipient.full_name}
                  </Text>
                  <TouchableOpacity onPress={() => setComposing(false)}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.bodyInput}
                  placeholder="Type your message..."
                  placeholderTextColor={COLORS.graphiteLight}
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
                    <ActivityIndicator size="small" color={COLORS.paper} />
                  ) : (
                    <Text style={styles.sendBtnText}>Send</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Messages" />
      <View style={styles.body}>
        <FlatList
          data={messages}
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
              icon="✉️"
              title="No Messages"
              subtitle="Tap the button below to message a teacher"
            />
          }
          renderItem={({ item }) => {
            const isSent = item.sender_id === user?.id;
            const otherName = isSent ? item.recipient_name : item.sender_name;
            const preview =
              item.body.length > 80 ? item.body.slice(0, 80) + '...' : item.body;

            return (
              <NotebookCard>
                <View style={styles.msgRow}>
                  <Avatar
                    name={otherName || '?'}
                    size={40}
                    color={isSent ? COLORS.chalk : COLORS.tape}
                  />
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
              </NotebookCard>
            );
          }}
        />
      </View>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={handleOpenCompose}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
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
  composeContainer: {
    flex: 1,
  },
  list: {
    paddingBottom: 80,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.tape,
  },

  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 12,
  },

  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  teacherInfo: {
    marginLeft: 12,
    flex: 1,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  teacherRole: {
    fontSize: 12,
    color: COLORS.graphiteLight,
    marginTop: 2,
  },

  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    marginRight: 10,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.tape,
  },
  composeTo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
  },

  bodyInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.line,
    minHeight: 120,
    marginBottom: 12,
    lineHeight: 20,
  },

  sendBtn: {
    backgroundColor: COLORS.cover,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: COLORS.paper,
    fontSize: 16,
    fontWeight: '700',
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  msgContent: {
    flex: 1,
    marginLeft: 12,
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
    color: COLORS.ink,
    flex: 1,
    marginRight: 8,
  },
  msgTime: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
  msgPreview: {
    fontSize: 13,
    color: COLORS.graphite,
    lineHeight: 18,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 24,
  },
});
