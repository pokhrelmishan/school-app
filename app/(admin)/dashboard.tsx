import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface School {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  teacher?: { full_name: string } | null;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'classes'>('overview');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const errors: string[] = [];

      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name, logo_url, created_at')
        .order('name');

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id, name, grade_level, teacher_id,
          teacher:profiles!classes_teacher_id_fkey(full_name)
        `)
        .order('name');

      if (schoolsError) errors.push(schoolsError.message);
      else if (schoolsData) setSchools(schoolsData);

      if (profilesError) errors.push(profilesError.message);
      else if (profilesData) setProfiles(profilesData);

      if (classesError) errors.push(classesError.message);
      else if (classesData) {
        setClasses(classesData.map(cls => ({
          ...cls,
          teacher: cls.teacher ? (Array.isArray(cls.teacher) ? cls.teacher[0] : cls.teacher) : null,
        })));
      }

      if (errors.length > 0) setErrorMsg(errors.join('; '));
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const teacherCount = profiles.filter(p => p.role === 'teacher').length;
  const studentCount = profiles.filter(p => p.role === 'student').length;
  const parentCount = profiles.filter(p => p.role === 'parent').length;

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  const OverviewTab = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.statGrid}>
        <StatCard label="Schools" value={schools.length} color={COLORS.danger} />
        <StatCard label="Teachers" value={teacherCount} color={COLORS.primary} />
        <StatCard label="Students" value={studentCount} color={COLORS.success} />
        <StatCard label="Parents" value={parentCount} color={COLORS.textSecondary} />
      </View>

      <SectionHeader title="Schools" />
      {schools.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏫</Text>
          <Text style={styles.emptyText}>No schools yet</Text>
          <Text style={styles.emptyHint}>Create your first school in the Schools tab</Text>
        </View>
      ) : (
        schools.map(school => (
          <View key={school.id} style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.danger }]} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{school.name}</Text>
              <Text style={styles.cardMeta}>Created {new Date(school.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        ))
      )}

      <SectionHeader title="Recent Users" />
      {profiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>No users yet</Text>
          <Text style={styles.emptyHint}>Users will appear here once they sign up</Text>
        </View>
      ) : (
        profiles.slice(0, 5).map(user => (
          <View key={user.id} style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: getRoleColor(user.role) }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{user.full_name}</Text>
                <View style={[styles.badge, { backgroundColor: getRoleColor(user.role) + '20' }]}>
                  <Text style={[styles.badgeText, { color: getRoleColor(user.role) }]}>{getRoleDisplay(user.role)}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>{user.email}</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const UsersTab = () => {
    const grouped = [
      { role: 'admin', users: profiles.filter(p => p.role === 'admin'), color: COLORS.danger },
      { role: 'teacher', users: profiles.filter(p => p.role === 'teacher'), color: COLORS.primary },
      { role: 'student', users: profiles.filter(p => p.role === 'student'), color: COLORS.success },
      { role: 'parent', users: profiles.filter(p => p.role === 'parent'), color: COLORS.textSecondary },
    ];

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {grouped.map(({ role, users, color }) => (
          users.length > 0 && (
            <View key={role} style={{ marginBottom: 24 }}>
              <SectionHeader title={`${getRoleDisplay(role)}s (${users.length})`} />
              {users.map(u => (
                <View key={u.id} style={styles.card}>
                  <View style={[styles.cardAccent, { backgroundColor: color }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardTitle}>{u.full_name}</Text>
                      <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.badgeText, { color }]}>{getRoleDisplay(u.role)}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>{u.email}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        ))}
        {profiles.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No users yet</Text>
            <Text style={styles.emptyHint}>Users will appear once they sign up and create a profile</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const ClassesTab = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {classes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>No classes yet</Text>
          <Text style={styles.emptyHint}>Create classes from the Classes tab</Text>
        </View>
      ) : (
        classes.map(cls => (
          <View key={cls.id} style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.primary }]} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{cls.name}</Text>
              <Text style={styles.cardMeta}>Grade {cls.grade_level}</Text>
              <Text style={styles.cardMeta}>Teacher: {cls.teacher?.full_name || 'Unassigned'}</Text>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return COLORS.danger;
      case 'teacher': return COLORS.primary;
      case 'student': return COLORS.success;
      case 'parent': return COLORS.textSecondary;
      default: return COLORS.text;
    }
  };

  const getRoleDisplay = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

  const primarySchool = schools[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {primarySchool?.logo_url ? (
            <Image source={{ uri: primarySchool.logo_url }} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogoPlaceholder}>
              <Text style={styles.headerLogoText}>{primarySchool?.name?.charAt(0) || 'E'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{primarySchool?.name || 'Dashboard'}</Text>
            <Text style={styles.headerSubtitle}>Welcome back</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {(['overview', 'users', 'classes'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'classes' && <ClassesTab />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primaryDark,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.surface,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
  },
  headerLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.surface,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textTertiary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: COLORS.surface,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  statAccent: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  cardAccent: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.danger,
    marginBottom: 10,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.surface,
    fontWeight: '700',
  },
});
