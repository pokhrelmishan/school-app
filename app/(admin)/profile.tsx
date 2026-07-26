import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  PageHeader,
  NotebookCard,
  Avatar,
  InfoRow,
  Divider,
} from '../../lib/components';

export default function AdminProfile() {
  const { profile, logout } = useAuth();
  const [schoolName, setSchoolName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchool = async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('schools').select('name').eq('id', profile.school_id).single();
    if (data) setSchoolName(data.name);
  };

  useEffect(() => { fetchSchool(); }, [profile?.school_id]);

  const onRefresh = async () => { setRefreshing(true); await fetchSchool(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cover}>
        <PageHeader title="Profile" />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        <View style={styles.avatarSection}>
          <Avatar name={profile?.full_name || 'A'} size={80} />
          <Text style={styles.name}>{profile?.full_name ?? 'Admin'}</Text>
          <Text style={styles.school}>{schoolName || 'School Admin'}</Text>
        </View>

        <NotebookCard>
          <InfoRow label="Role" value="Admin" icon={'\u{1F451}'} />
          <InfoRow label="School" value={schoolName || '\u2014'} icon={'\u{1F3EB}'} />
          <InfoRow label="Joined" value={'\u2014'} icon={'\u{1F4C5}'} />
        </NotebookCard>

        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  cover: { backgroundColor: COLORS.cover, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  content: { padding: 16 },

  avatarSection: { alignItems: 'center', marginBottom: 20, marginTop: 12 },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginTop: 12, marginBottom: 2 },
  school: { fontSize: 13, color: COLORS.graphite },

  logoutCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.danger + '40',
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: COLORS.danger },
});
