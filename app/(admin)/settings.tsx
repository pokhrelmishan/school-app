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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

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
  const [userCount, setUserCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.school_id) return;

      const [schoolRes, usersRes, classesRes, subjectsRes] = await Promise.all([
        supabase.from('schools').select('id, name, logo_url, created_at').eq('id', profile.school_id).single(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
        supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
      ]);

      if (schoolRes.data) {
        setSchool(schoolRes.data);
        setSchoolName(schoolRes.data.name);
      }
      setUserCount(usersRes.count ?? 0);
      setClassCount(classesRes.count ?? 0);
      setSubjectCount(subjectsRes.count ?? 0);
      setLoading(false);
    };

    fetchData();
  }, [profile?.school_id]);

  const handleSaveName = async () => {
    if (!school || !schoolName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from('schools')
      .update({ name: schoolName.trim() })
      .eq('id', school.id);
    setSavingName(false);
    if (error) {
      Alert.alert('Error', 'Failed to update school name.');
    } else {
      setSchool({ ...school, name: schoolName.trim() });
      Alert.alert('Saved', 'School name updated.');
    }
  };

  const handleUploadLogo = async () => {
    if (!school) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploadingLogo(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'png';
      const filePath = `school-logos/${school.id}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(filePath, blob, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('schools')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', school.id);

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
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUploadingLogo(true);
          await supabase.from('schools').update({ logo_url: null }).eq('id', school.id);
          setSchool({ ...school, logo_url: null });
          setUploadingLogo(false);
        },
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSeedData = () => {
    Alert.alert(
      'Seed Demo Data',
      'Run the following SQL in your Supabase SQL Editor:\n\nINSERT INTO classes (school_id, name) VALUES (...)\n\nOr contact your developer to run the seed script.',
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>School Logo</Text>
      <View style={[styles.card, SHADOWS.sm]}>
        <View style={styles.logoContainer}>
          {school?.logo_url ? (
            <Image source={{ uri: school.logo_url }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>
                {school?.name?.charAt(0)?.toUpperCase() ?? 'S'}
              </Text>
            </View>
          )}
        </View>
        {uploadingLogo ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 12 }} />
        ) : (
          <View style={styles.logoActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleUploadLogo}>
              <Text style={styles.primaryButtonText}>Upload Logo</Text>
            </TouchableOpacity>
            {school?.logo_url && (
              <TouchableOpacity style={styles.dangerOutlineButton} onPress={handleRemoveLogo}>
                <Text style={styles.dangerOutlineButtonText}>Remove Logo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>School Name</Text>
      <View style={[styles.card, SHADOWS.sm]}>
        <TextInput
          style={styles.input}
          value={schoolName}
          onChangeText={setSchoolName}
          placeholder="School name"
          placeholderTextColor={COLORS.textTertiary}
        />
        <TouchableOpacity
          style={[styles.primaryButton, savingName && { opacity: 0.6 }]}
          onPress={handleSaveName}
          disabled={savingName}
        >
          {savingName ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>School Info</Text>
      <View style={[styles.card, SHADOWS.sm]}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>School ID</Text>
          <Text style={styles.infoValue}>{school?.id.slice(0, 8) ?? '—'}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>
            {school?.created_at
              ? new Date(school.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Users</Text>
          <Text style={styles.infoValue}>{userCount}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Classes</Text>
          <Text style={styles.infoValue}>{classCount}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Subjects</Text>
          <Text style={styles.infoValue}>{subjectCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Danger Zone</Text>
      <View style={[styles.card, SHADOWS.sm]}>
        <TouchableOpacity style={styles.seedButton} onPress={handleSeedData}>
          <Text style={styles.seedButtonText}>Run Seed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={[styles.card, SHADOWS.sm]}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  logoPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerOutlineButton: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dangerOutlineButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 8,
  },
  seedButton: {
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  seedButtonText: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
