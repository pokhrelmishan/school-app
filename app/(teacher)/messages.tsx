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
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  NotebookCard,
  Avatar,
  EmptyState,
  LoadingScreen,
  PrimaryButton,
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
  const [refreshing, setRefreshing] = useState(false);

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
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(otherIds));
        if (profiles) profiles.forEach((p: any) => { nameMap[p.id] = p.full_name || 'Unknown'; });
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
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMessages();
  }, [fetchMessages]);

  const fetchStudents = async () => {
    if (!user?.id) return;

    try {
      const classTeacherRes = await supabase.from('classes').select('id, name, grade_level').eq('teacher_id', user.id);
      const subjectRes = await supabase.from('teacher_subjects').select('class_id, classes(id, name, grade_level)').eq('teacher_id', user.id);

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

      if (classIds.size === 0) { setStudents([]); return; }

      const { data: enrollments } = await supabase.from('class_enrollments').select('student_id, class_id').in('class_id', Array.from(classIds));
      if (!enrollments || enrollments.length === 0) { setStudents([]); return; }

      const studentIds = enrollments.map((e: any) => e.student_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
      const profileMap: Record<string, string> = {};
      if (profiles) profiles.forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });

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
        sender_id: user.id, recipient_id: selectedRecipient.id, body: messageBody.trim(),
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

  if (loading) return <LoadingScreen text="Loading messages..." />;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Messages" subtitle="Send messages to students" />
      <View style={styles.container}>
        {composing ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {!selectedRecipient ? (
              <View style={styles.pickerSection}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Recipient</Text>
                  <TouchableOpacity onPress={() => setComposing(false)}>
                    <Text style={{ fontSize: 24, color: COLORS.graphite }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search students..."
                  placeholderTextColor={COLORS.graphiteLight}
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
                          <NotebookCard key={s.id} accent={COLORS.chalk} onPress={() => setSelectedRecipient(s)}>
                            <View style={styles.studentRow}>
                              <Avatar name={s.full_name} size={34} />
                              <Text style={styles.studentName}>{s.full_name}</Text>
                            </View>
                          </NotebookCard>
                        ))}
                      </View>
                    );
                  }}
                  ListEmptyComponent={<EmptyState icon="🔍" title="No students found" />}
                />
              </View>
            ) : (
              <View style={styles.composeSection}>
                <View style={styles.composeHeader}>
                  <TouchableOpacity onPress={() => setSelectedRecipient(null)} style={styles.backBtn}>
                    <Text style={{ fontSize: 22, color: COLORS.tape }}>←</Text>
                  </TouchableOpacity>
                  <Text style={styles.composeTo} numberOfLines={1}>To: {selectedRecipient.full_name}</Text>
                  <TouchableOpacity onPress={() => setComposing(false)}>
                    <Text style={{ fontSize: 24, color: COLORS.graphite }}>✕</Text>
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
                <PrimaryButton title="Send" onPress={handleSend} loading={sending} disabled={!messageBody.trim() || sending} />
              </View>
            )}
          </KeyboardAvoidingView>
        ) : (
          <>
            {messages.length === 0 ? (
              <EmptyState
                icon="💬"
                title="No Messages"
                subtitle="Tap the button below to send your first message."
                action={{ label: 'Compose', onPress: handleOpenCompose }}
              />
            ) : (
              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} />}
                renderItem={({ item }) => {
                  const isSent = item.sender_id === user?.id;
                  const otherName = isSent ? item.recipient_name : item.sender_name;
                  const preview = item.body.length > 80 ? item.body.slice(0, 80) + '...' : item.body;

                  return (
                    <NotebookCard accent={isSent ? COLORS.graphiteLight : COLORS.tape}>
                      <View style={styles.msgLeft}>
                        <Avatar name={otherName || '?'} size={40} />
                        <View style={styles.msgContent}>
                          <View style={styles.msgTopRow}>
                            <Text style={styles.msgName} numberOfLines={1}>
                              {isSent ? `To: ${otherName}` : otherName}
                            </Text>
                            <Text style={styles.msgTime}>{timeAgo(item.created_at)}</Text>
                          </View>
                          <Text style={styles.msgPreview} numberOfLines={2}>{preview}</Text>
                        </View>
                      </View>
                    </NotebookCard>
                  );
                }}
              />
            )}

            <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={handleOpenCompose}>
              <Text style={styles.fabText}>✉</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  list: { paddingBottom: 80 },
  msgLeft: { flexDirection: 'row', alignItems: 'center' },
  msgContent: { flex: 1, marginLeft: 12 },
  msgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  msgName: { fontSize: 15, fontWeight: '600', color: COLORS.ink, flex: 1, marginRight: 8 },
  msgTime: { fontSize: 12, color: COLORS.graphiteLight },
  msgPreview: { fontSize: 13, color: COLORS.graphite, lineHeight: 18 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.cover, justifyContent: 'center',
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  fabText: { fontSize: 24, color: COLORS.paper },
  composeContainer: { flex: 1 },
  pickerSection: { flex: 1 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  searchInput: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, fontSize: 15,
    color: COLORS.ink, borderWidth: 1, borderColor: COLORS.line, marginBottom: 12,
  },
  groupLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.graphite, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 12, marginBottom: 6, paddingLeft: 4,
  },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  studentName: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.ink, marginLeft: 10 },
  composeSection: { flex: 1 },
  composeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { marginRight: 10 },
  composeTo: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  bodyInput: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15,
    color: COLORS.ink, borderWidth: 1, borderColor: COLORS.line, minHeight: 120,
    marginBottom: 12, lineHeight: 20,
  },
});
