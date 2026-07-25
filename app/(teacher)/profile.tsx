import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function TeacherProfileScreen() {
  const { user, profile, logout } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      const [subjectsRes, classesRes] = await Promise.all([
        supabase
          .from('teacher_subjects')
          .select('subjects(name)')
          .eq('teacher_id', user.id),
        supabase
          .from('classes')
          .select('name')
          .eq('teacher_id', user.id),
      ]);

      if (subjectsRes.data) {
        setSubjects(subjectsRes.data.map((s: any) => s.subjects?.name).filter(Boolean));
      }
      if (classesRes.data) {
        setClasses(classesRes.data.map((c: any) => c.name).filter(Boolean));
      }
    };

    fetchData();
  }, [user?.id]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{(profile?.full_name || 'T')[0]}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name || 'Teacher'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{profile?.role || 'Teacher'}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subjects</Text>
            <Text style={styles.infoValue}>
              {subjects.length > 0 ? subjects.join(', ') : '—'}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Classes</Text>
            <Text style={styles.infoValue}>
              {classes.length > 0 ? classes.join(', ') : '—'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
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
  content: { alignItems: 'center', padding: 24 },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: COLORS.primary },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  email: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    ...SHADOWS.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  infoDivider: { height: 1, backgroundColor: COLORS.borderLight },
  logoutButton: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    ...SHADOWS.sm,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: COLORS.danger },
});
