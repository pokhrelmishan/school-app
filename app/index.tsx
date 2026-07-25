import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const roles = ['admin', 'teacher', 'student'] as const;

export default function Dashboard() {
  const { user, loading, profile, logout } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [schoolName, setSchoolName] = useState('Elmwood Academy');
  const [gradeLevel, setGradeLevel] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [house, setHouse] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const createProfile = async () => {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      // Find or create school
      let schoolId: string | null = null;
      const { data: existingSchool, error: schoolLookupErr } = await supabase
        .from('schools')
        .select('id')
        .eq('name', schoolName)
        .single();

      if (schoolLookupErr && schoolLookupErr.code !== 'PGRST116') {
        setError('School lookup failed: ' + schoolLookupErr.message);
        return;
      }

      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        const { data: newSchool, error: schoolCreateErr } = await supabase
          .from('schools')
          .insert({ name: schoolName })
          .select('id')
          .single();

        if (schoolCreateErr) {
          setError('Could not create school: ' + schoolCreateErr.message);
          return;
        }
        schoolId = newSchool?.id ?? null;
      }

      if (!schoolId) {
        setError('No school ID available');
        return;
      }

      const profileData: Record<string, any> = {
        id: user.id,
        school_id: schoolId,
        role: selectedRole,
        full_name: user.email?.split('@')[0] ?? 'User',
        email: user.email ?? '',
      };
      if (selectedRole === 'student') {
        if (gradeLevel.trim()) profileData.grade_level = gradeLevel.trim();
        if (rollNumber.trim()) profileData.roll_number = rollNumber.trim();
        if (house.trim()) profileData.house = house.trim();
      }

      const { error: profileErr } = await supabase.from('profiles').insert(profileData);

      if (profileErr) {
        setError('Profile creation failed: ' + profileErr.message);
        return;
      }

      // Reload page — AuthGate will pick up the new profile and redirect
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Elmwood Academy</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set Up Your Profile</Text>
          <Text style={styles.cardText}>
            Your account ({user?.email}) doesn't have a role yet. Pick one below to get started.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>School Name</Text>
          <TextInput
            style={styles.input}
            value={schoolName}
            onChangeText={setSchoolName}
            placeholder="School name"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Your Role</Text>
          <View style={styles.roleRow}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleButton, selectedRole === r && styles.roleButtonActive]}
                onPress={() => setSelectedRole(r)}
              >
                <Text style={[styles.roleButtonText, selectedRole === r && styles.roleButtonTextActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedRole === 'student' && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Grade Level</Text>
              <TextInput
                style={styles.input}
                value={gradeLevel}
                onChangeText={setGradeLevel}
                placeholder="e.g. 10"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Roll Number</Text>
              <TextInput
                style={styles.input}
                value={rollNumber}
                onChangeText={setRollNumber}
                placeholder="e.g. 042"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>House</Text>
              <TextInput
                style={styles.input}
                value={house}
                onChangeText={setHouse}
                placeholder="e.g. Red"
              />
            </View>
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createButton, creating && { opacity: 0.6 }]}
          onPress={createProfile}
          disabled={creating}
        >
          <Text style={styles.createButtonText}>{creating ? 'Creating...' : 'Enter App'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Elmwood Academy</Text>
        <Text style={styles.subtitle}>Welcome, {user?.email}</Text>
        <Text style={styles.role}>Role: {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  role: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: COLORS.surface,
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  createButtonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: COLORS.danger + '15',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  logoutButton: {
    marginTop: 'auto',
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
