import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  Avatar,
  PillSelector,
  EmptyState,
  LoadingScreen,
  PrimaryButton,
} from '../../lib/components';

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
  created_at: string;
  grade_level?: string;
  roll_number?: string;
  house?: string;
};

const ROLE_FILTERS = ['All', 'Teachers', 'Students'] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const ROLE_BADGE: Record<string, { color: string }> = {
  admin: { color: COLORS.tape },
  teacher: { color: COLORS.chalk },
  student: { color: COLORS.blue },
};

export default function UsersScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>('All');

  const [formVisible, setFormVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'teacher' | 'student'>('student');
  const [formGrade, setFormGrade] = useState('');
  const [formRoll, setFormRoll] = useState('');
  const [formHouse, setFormHouse] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('role')
      .order('full_name');
    if (data) setUsers(data as UserProfile[]);
  }, [profile?.school_id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchUsers();
      setLoading(false);
    })();
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const filtered = filter === 'All' ? users : users.filter((u) => u.role === filter.toLowerCase().slice(0, -1));

  const roleCounts: Record<RoleFilter, number> = {
    All: users.length,
    Teachers: users.filter((u) => u.role === 'teacher').length,
    Students: users.filter((u) => u.role === 'student').length,
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('student');
    setFormGrade('');
    setFormRoll('');
    setFormHouse('');
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      Alert.alert('Error', 'Name and email are required.');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, any> = {
        full_name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        school_id: profile?.school_id,
      };
      if (formRole === 'student') {
        payload.grade_level = formGrade.trim();
        payload.roll_number = formRoll.trim();
        payload.house = formHouse.trim();
      }
      const { error } = await supabase.from('profiles').insert(payload);
      if (error) throw error;
      Alert.alert('Success', 'Profile created.');
      setFormVisible(false);
      resetForm();
      await fetchUsers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (u: UserProfile) => {
    Alert.alert('Delete User', `Remove ${u.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('profiles').delete().eq('id', u.id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setUsers((prev) => prev.filter((p) => p.id !== u.id));
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen text="Loading users..." />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Users" subtitle={`${users.length} total`} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        <View style={styles.pills}>
          <PillSelector
            items={ROLE_FILTERS as unknown as string[]}
            selected={filter}
            onSelect={(item) => setFilter(item as RoleFilter)}
          />
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon={'\u{1F465}'} title="No users found" subtitle="Create users to get started" />
        ) : (
          filtered.map((u) => {
            const badge = ROLE_BADGE[u.role] || { color: COLORS.graphite };
            return (
              <TouchableOpacity
                key={u.id}
                activeOpacity={0.7}
                onLongPress={() => handleDelete(u)}
              >
                <NotebookCard>
                  <View style={styles.cardRow}>
                    <Avatar name={u.full_name} size={42} />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName} numberOfLines={1}>{u.full_name}</Text>
                      <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
                    </View>
                    <Badge text={u.role} color={badge.color} size="md" />
                  </View>
                  {u.role === 'student' && (u.grade_level || u.house) ? (
                    <View style={styles.metaRow}>
                      {u.grade_level ? <Badge text={`Grade ${u.grade_level}`} color={COLORS.pencil} /> : null}
                      {u.house ? <Badge text={u.house} color={COLORS.tape} /> : null}
                    </View>
                  ) : null}
                </NotebookCard>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setFormVisible(true)} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={formVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setFormVisible(false); resetForm(); }} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create User</Text>
              <TouchableOpacity onPress={() => { setFormVisible(false); resetForm(); }}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={COLORS.graphiteLight} value={formName} onChangeText={setFormName} />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor={COLORS.graphiteLight} value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.inputLabel}>Password (info only)</Text>
              <TextInput style={styles.input} placeholder="User sets this at signup" placeholderTextColor={COLORS.graphiteLight} value={formPassword} onChangeText={setFormPassword} secureTextEntry />

              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleRow}>
                {(['admin', 'teacher', 'student'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rolePill, formRole === r && styles.rolePillActive]}
                    onPress={() => setFormRole(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rolePillText, formRole === r && styles.rolePillTextActive]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {formRole === 'student' && (
                <>
                  <Text style={styles.inputLabel}>Grade Level</Text>
                  <TextInput style={styles.input} placeholder="e.g. 10" placeholderTextColor={COLORS.graphiteLight} value={formGrade} onChangeText={setFormGrade} />
                  <Text style={styles.inputLabel}>Roll Number</Text>
                  <TextInput style={styles.input} placeholder="e.g. 42" placeholderTextColor={COLORS.graphiteLight} value={formRoll} onChangeText={setFormRoll} />
                  <Text style={styles.inputLabel}>House</Text>
                  <TextInput style={styles.input} placeholder="e.g. Red" placeholderTextColor={COLORS.graphiteLight} value={formHouse} onChangeText={setFormHouse} />
                </>
              )}

              <PrimaryButton
                title="Create User"
                onPress={handleCreate}
                disabled={creating}
                loading={creating}
              />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { flex: 1, padding: 16 },
  pills: { marginBottom: 12 },

  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 10 },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 2 },
  cardEmail: { fontSize: 12, color: COLORS.graphite },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 8 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cover,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: COLORS.paper, fontWeight: '600', marginTop: -2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1 },
  modalCard: {
    backgroundColor: COLORS.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  modalClose: { fontSize: 20, color: COLORS.graphite, fontWeight: '600' },

  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.graphite, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.ink,
  },

  roleRow: { flexDirection: 'row', gap: 8 },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  rolePillActive: { backgroundColor: COLORS.cover, borderColor: COLORS.cover },
  rolePillText: { fontSize: 13, fontWeight: '600', color: COLORS.graphite },
  rolePillTextActive: { color: COLORS.paper },
});
