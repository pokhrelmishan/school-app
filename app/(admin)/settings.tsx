import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface School {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function AdminSettingsScreen() {
  const { user, logout } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSchool = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, logo_url')
        .limit(1)
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setSchool(data);
        setSchoolName(data.name);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load school');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchool(); }, []);

  const handleSaveName = async () => {
    if (!school || !schoolName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ name: schoolName.trim() })
        .eq('id', school.id);

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSchool({ ...school, name: schoolName.trim() });
        setSuccessMsg('School name updated');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to upload a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await uploadLogo(asset.uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await uploadLogo(asset.uri);
  };

  const uploadLogo = async (uri: string) => {
    if (!school) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() || 'png';
      const filePath = `${school.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(filePath, blob, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) {
        setErrorMsg('Upload failed: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('school-logos')
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('schools')
        .update({ logo_url: logoUrl })
        .eq('id', school.id);

      if (updateError) {
        setErrorMsg('Failed to save logo URL: ' + updateError.message);
      } else {
        setSchool({ ...school, logo_url: logoUrl });
        setSuccessMsg('Logo uploaded successfully');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!school) return;
    Alert.alert('Remove Logo', 'Are you sure you want to remove the school logo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          const { error } = await supabase
            .from('schools')
            .update({ logo_url: null })
            .eq('id', school.id);
          if (!error) {
            setSchool({ ...school, logo_url: null });
          }
          setSaving(false);
        },
      },
    ]);
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.scroll}>
        {/* Logo Section */}
        <Text style={styles.sectionLabel}>School Logo</Text>
        <View style={styles.logoSection}>
          {school?.logo_url ? (
            <View style={styles.logoPreview}>
              <Image source={{ uri: school.logo_url }} style={styles.logoImage} />
            </View>
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>
                {schoolName ? schoolName.charAt(0).toUpperCase() : 'E'}
              </Text>
            </View>
          )}

          <View style={styles.logoActions}>
            <TouchableOpacity
              style={styles.logoButton}
              onPress={pickImage}
              disabled={uploading}
            >
              <Text style={styles.logoButtonText}>
                {school?.logo_url ? 'Change Logo' : 'Upload Logo'}
              </Text>
            </TouchableOpacity>

            {school?.logo_url && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={removeLogo}
                disabled={saving}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {uploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>

        {/* Name Section */}
        <Text style={styles.sectionLabel}>School Name</Text>
        <View style={styles.nameSection}>
          <TextInput
            style={styles.nameInput}
            value={schoolName}
            onChangeText={setSchoolName}
            placeholder="School name"
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveName}
            disabled={saving || schoolName.trim() === school?.name}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {successMsg && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {/* School Info */}
        <Text style={styles.sectionLabel}>School Info</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>School ID</Text>
            <Text style={styles.infoValue}>{school?.id?.slice(0, 8)}...</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>—</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Log Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: () => logout() },
            ]);
          }}
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
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
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },
  logoSection: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 24,
    ...SHADOWS.sm,
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoPlaceholderText: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.primary,
  },
  logoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  logoButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  logoButtonText: {
    color: COLORS.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  removeButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  removeButtonText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  uploadingText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  nameSection: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: COLORS.danger + '10',
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  successBox: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  successText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Courier',
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 15,
  },
});
