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
import { useRouter } from 'expo-router';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
}

interface Student {
  id: string;
  full_name: string;
  class_id: string;
  class_name: string;
  grade_level?: string;
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

export default function TeacherMessagesScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [composing, setComposing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Student | null>(null);
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

  const fetchStudents = async () => {
    if (!user?.id) return;

    try {
      const classTeacherRes = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('teacher_id', user.id);

      const subjectRes = await supabase
        .from('teacher_subjects')
        .select('class_id, classes(id, name, grade_level)')
        .eq('teacher_id', user.id);

      const classIds = new Set<string>();
      const classMap: Record<string, { name: string; grade_level?: string }> = {};

      if (classTeacherRes.data) {
        for (const c of classTeacherRes.data) {
          classIds.add(c.id);
          classMap[c.id] = { name: c.name, grade_level: c.grade_level };
        }
      }

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const cls = s.classes as any;
          if (cls && !classIds.has(s.class_id)) {
            classIds.add(s.class_id);
            classMap[s.class_id] = { name: cls.name, grade_level: cls.grade_level };
          }
        }
      }

      if (classIds.size === 0) {
        setStudents([]);
        return;
      }

      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id, class_id')
        .in('class_id', Array.from(classIds));

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = enrollments.map((e: any) => e.student_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);

      const profileMap: Record<string, string> = {};
      if (profiles) {
        profiles.forEach((p: any) => {
          profileMap[p.id] = p.full_name || 'Unknown';
        });
      }

      const result: Student[] = enrollments.map((e: any) => ({
        id: e.student_id,
        full_name: profileMap[e.student_id] || 'Unknown',
        class_id: e.class_id,
        class_name: classMap[e.class_id]?.name || '',
        grade_level: classMap[e.class_id]?.grade_level,
      }));

      result.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.full_name.localeCompare(b.full_name));
      setStudents(result);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const handleOpenCompose = () => {
    setComposing(true);
    setSelectedRecipient(null);
    setMessageBody('');
    setSearchQuery('');
    fetchStudents();
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

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.class_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedStudents = filteredStudents.reduce<Record<string, Student[]>>((acc, s) => {
    const label = s.grade_level ? `${s.class_name} (Grade ${s.grade_level})` : s.class_name;
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.sender_id === user?.id;
    const otherName = isSent ? item.recipient_name : item.sender_name;
    const preview = item.body.length > 80 ? item.body.slice(0, 80) + '...' : item.body;
    const isUnread = !isSent;

    return (
      <TouchableOpacity style={styles.msgCard} activeOpacity={0.7}>
        <View style={styles.msgLeft}>
          <View style={styles.msgAvatar}>
            <Text style={styles.msgAvatarText}>{(otherName || '?')[0]}</Text>
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
        {isUnread && <View style={styles.unreadDot} />}
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
        <TouchableOpacity onPress={() => router.push('/(teacher)/profile')} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || 'T')[0]}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {composing ? (
        <KeyboardAvoidingView
          style={styles.composeContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!selectedRecipient ? (
            <View style={styles.pickerSection}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Recipient</Text>
                <TouchableOpacity onPress={() => setComposing(false)}>
                  <Text style={{ fontSize: 24, color: COLORS.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search students..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <FlatList
                data={Object.entries(groupedStudents)}
                keyExtractor={([label]) => label}
                renderItem={(item: any) => {
                  const [label, studs] = item.item as [string, Student[]];
                  return (
                  <View>
                    <Text style={styles.groupLabel}>{label}</Text>
                    {studs.map((s: any) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.studentRow}
                        activeOpacity={0.7}
                        onPress={() => setSelectedRecipient(s)}
                      >
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>{s.full_name[0]}</Text>
                        </View>
                        <Text style={styles.studentName}>{s.full_name}</Text>
                        <Text style={{ fontSize: 18, color: COLORS.textTertiary }}>➡️</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No students found</Text>
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
                Tap the button below to send your first message.
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
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
  msgAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
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
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    paddingLeft: 4,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    ...SHADOWS.sm,
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.successBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  studentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  studentName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
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
