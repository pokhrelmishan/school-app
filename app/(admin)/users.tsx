import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';

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

const ROLE_FILTERS = ['all', 'admin', 'teacher', 'student'] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  admin: { bg: COLORS.dangerBg, color: COLORS.danger },
  teacher: { bg: COLORS.primaryBg, color: COLORS.primary },
  student: { bg: COLORS.successBg, color: COLORS.success },
  parent: { bg: COLORS.surfaceAlt, color: COLORS.textSecondary },
};

export default function UsersScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'teacher' | 'student'>('student');
  const [formGrade, setFormGrade] = useState('');
  const [formRoll, setFormRoll] = useState('');
  const [formHouse, setFormHouse] = useState('');

  const fetchUsers = async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('role')
      .order('full_name');
    if (data) setUsers(data as UserProfile[]);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchUsers();
      setLoading(false);
    })();
  }, [profile?.school_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  const roleCounts = {
    all: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    teacher: users.filter((u) => u.role === 'teacher').length,
    student: users.filter((u) => u.role === 'student').length,
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
      Alert.alert('Success', 'Profile created. The user can sign up via Supabase auth.');
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

  const getInitial = (name: string) => (name || '?')[0].toUpperCase();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Users</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{users.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(admin)/profile')} activeOpacity={0.7}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{getInitial(profile?.full_name || '')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {ROLE_FILTERS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.filterPill, filter === r && styles.filterPillActive]}
              onPress={() => setFilter(r)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === r && styles.filterTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)} ({roleCounts[r]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          filtered.map((u) => {
            const badge = ROLE_BADGE[u.role] || ROLE_BADGE.parent;
            const isExpanded = expandedId === u.id;
            return (
              <TouchableOpacity key={u.id} style={styles.card} activeOpacity={0.8} onPress={() => toggleExpand(u.id)}>
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.avatarText, { color: badge.color }]}>{getInitial(u.full_name)}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{u.full_name}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{u.email}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: badge.color }]}>{u.role}</Text>
                  </View>
                </View>
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email</Text>
                      <Text style={styles.detailValue}>{u.email}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Role</Text>
                      <Text style={styles.detailValue}>{u.role}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>School ID</Text>
                      <Text style={styles.detailValue}>{u.school_id?.slice(0, 8)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Created</Text>
                      <Text style={styles.detailValue}>{new Date(u.created_at).toLocaleDateString()}</Text>
                    </View>
                    {u.role === 'student' && (
                      <>
                        {u.grade_level ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Grade</Text>
                            <Text style={styles.detailValue}>{u.grade_level}</Text>
                          </View>
                        ) : null}
                        {u.roll_number ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Roll No</Text>
                            <Text style={styles.detailValue}>{u.roll_number}</Text>
                          </View>
                        ) : null}
                        {u.house ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>House</Text>
                            <Text style={styles.detailValue}>{u.house}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(u)} activeOpacity={0.7}>
                      <Text style={styles.deleteBtnText}>Delete User</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create User</Text>
              <TouchableOpacity
                onPress={() => {
                  setFormVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.textTertiary}
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor={COLORS.textTertiary}
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Password (info only)</Text>
              <TextInput
                style={styles.input}
                placeholder="User sets this at signup"
                placeholderTextColor={COLORS.textTertiary}
                value={formPassword}
                onChangeText={setFormPassword}
                secureTextEntry
              />

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
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={COLORS.textTertiary}
                    value={formGrade}
                    onChangeText={setFormGrade}
                  />

                  <Text style={styles.inputLabel}>Roll Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 42"
                    placeholderTextColor={COLORS.textTertiary}
                    value={formRoll}
                    onChangeText={setFormRoll}
                  />

                  <Text style={styles.inputLabel}>House</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Red"
                    placeholderTextColor={COLORS.textTertiary}
                    value={formHouse}
                    onChangeText={setFormHouse}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Create User</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  countBadge: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginLeft: 10,
  },
  countText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },

  filterRow: { marginBottom: 16 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: COLORS.textTertiary, fontStyle: 'italic' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardEmail: { fontSize: 12, color: COLORS.textSecondary },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },

  deleteBtn: {
    marginTop: 8,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  fabText: { fontSize: 28, color: COLORS.white, fontWeight: '600', marginTop: -2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 22, color: COLORS.textSecondary, fontWeight: '600' },

  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
  },

  roleRow: { flexDirection: 'row', gap: 8 },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rolePillActive: {
    backgroundColor: COLORS.primaryBg,
    borderColor: COLORS.primary,
  },
  rolePillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  rolePillTextActive: { color: COLORS.primary },

  createBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
