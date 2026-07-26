import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  NotebookCard,
  InfoRow,
  PrimaryButton,
  Divider,
} from '../../lib/components';

interface SchoolData {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

export default function AdminSettings() {
  const { profile, logout } = useAuth();
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);

  const fetchData = async () => {
    if (!profile?.school_id) return;
    const [schoolRes, usersRes, classesRes, subjectsRes] = await Promise.all([
      supabase.from('schools').select('id, name, logo_url, created_at').eq('id', profile.school_id).single(),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    ]);
    if (schoolRes.data) { setSchool(schoolRes.data); setSchoolName(schoolRes.data.name); }
    setUserCount(usersRes.count ?? 0);
    setClassCount(classesRes.count ?? 0);
    setSubjectCount(subjectsRes.count ?? 0);
  };

  useEffect(() => {
    (async () => { setLoading(true); await fetchData(); setLoading(false); })();
  }, [profile?.school_id]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleSaveName = async () => {
    if (!school || !schoolName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from('schools').update({ name: schoolName.trim() }).eq('id', school.id);
    setSavingName(false);
    if (error) { Alert.alert('Error', 'Failed to update school name.'); }
    else { setSchool({ ...school, name: schoolName.trim() }); Alert.alert('Saved', 'School name updated.'); }
  };

  const handleUploadLogo = async () => {
    if (!school) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingLogo(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'png';
      const filePath = `school-logos/${school.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('school-logos').upload(filePath, blob, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('schools').update({ logo_url: urlData.publicUrl }).eq('id', school.id);
      if (updateError) throw updateError;
      setSchool({ ...school, logo_url: urlData.publicUrl });
      Alert.alert('Success', 'Logo uploaded.');
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Something went wrong.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!school) return;
    Alert.alert('Remove Logo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setUploadingLogo(true);
        await supabase.from('schools').update({ logo_url: null }).eq('id', school.id);
        setSchool({ ...school, logo_url: null });
        setUploadingLogo(false);
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.cover} style={{ flex: 1, backgroundColor: COLORS.paper }} />;

  return (
    <View style={styles.container}>
      <View style={styles.cover}>
        <PageHeader title="Settings" />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cover} colors={[COLORS.cover]} />}
      >
        <Text style={styles.sectionLabel}>School Logo</Text>
        <NotebookCard>
          <View style={styles.logoContainer}>
            {school?.logo_url ? (
              <Image source={{ uri: school.logo_url }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>{school?.name?.charAt(0)?.toUpperCase() ?? 'S'}</Text>
              </View>
            )}
          </View>
          {uploadingLogo ? (
            <ActivityIndicator size="small" color={COLORS.cover} style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.logoActions}>
              <PrimaryButton title="Upload Logo" onPress={handleUploadLogo} />
              {school?.logo_url && (
                <PrimaryButton title="Remove Logo" variant="danger" onPress={handleRemoveLogo} />
              )}
            </View>
          )}
        </NotebookCard>

        <Text style={styles.sectionLabel}>School Name</Text>
        <NotebookCard>
          <TextInput style={styles.input} value={schoolName} onChangeText={setSchoolName} placeholder="School name" placeholderTextColor={COLORS.graphiteLight} />
          <PrimaryButton title="Save" onPress={handleSaveName} disabled={savingName} loading={savingName} />
        </NotebookCard>

        <Text style={styles.sectionLabel}>School Info</Text>
        <NotebookCard>
          <InfoRow label="School ID" value={school?.id.slice(0, 8) ?? '\u2014'} />
          <InfoRow label="Created" value={school?.created_at ? new Date(school.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014'} />
          <InfoRow label="Users" value={String(userCount)} />
          <InfoRow label="Classes" value={String(classCount)} />
          <InfoRow label="Subjects" value={String(subjectCount)} />
        </NotebookCard>

        <Text style={styles.sectionLabel}>Account</Text>
        <NotebookCard>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </NotebookCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  cover: { backgroundColor: COLORS.cover, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  content: { paddingBottom: 32 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.graphite,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, paddingHorizontal: 16,
  },

  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logoImage: { width: 100, height: 100, borderRadius: 50 },
  logoPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.paperDim,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.line,
  },
  logoPlaceholderText: { fontSize: 40, fontWeight: '700', color: COLORS.chalk },
  logoActions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },

  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.ink, marginBottom: 12,
  },

  logoutBtn: {
    backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  logoutText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
});
