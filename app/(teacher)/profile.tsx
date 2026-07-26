import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  PageHeader,
  NotebookCard,
  Avatar,
  InfoRow,
  PrimaryButton,
  Divider,
} from '../../lib/components';

export default function TeacherProfileScreen() {
  const { user, profile, logout } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      const [subjectsRes, classesRes] = await Promise.all([
        supabase.from('teacher_subjects').select('subjects(name)').eq('teacher_id', user.id),
        supabase.from('classes').select('name').eq('teacher_id', user.id),
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
    <View style={styles.root}>
      <PageHeader title="Profile" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.avatarSection}>
          <Avatar name={profile?.full_name || 'T'} size={88} />
          <Text style={styles.name}>{profile?.full_name || 'Teacher'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <NotebookCard>
          <InfoRow label="Role" value={profile?.role || 'Teacher'} icon="👤" />
          <Divider />
          <InfoRow label="Subjects" value={subjects.length > 0 ? subjects.join(', ') : '—'} icon="📚" />
          <Divider />
          <InfoRow label="Classes" value={classes.length > 0 ? classes.join(', ') : '—'} icon="🏫" />
        </NotebookCard>

        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Log Out" variant="danger" onPress={handleLogout} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24, marginTop: 12 },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginTop: 12, marginBottom: 4 },
  email: { fontSize: 14, color: COLORS.graphite },
});
