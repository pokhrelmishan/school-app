import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../lib/theme';
import { getSavedAccounts, removeAccount, type SavedAccount } from '../../lib/accounts';

export default function StudentProfileScreen() {
  const { user, profile, logout } = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleRemoveAccount = (account: SavedAccount) => {
    Alert.alert('Remove Account', `Remove ${account.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeAccount(account.email);
          const accounts = await getSavedAccounts();
          setSavedAccounts(accounts);
        },
      },
    ]);
  };

  const otherAccounts = savedAccounts.filter(a => a.email !== user?.email);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{(profile?.full_name || 'S')[0]}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name || 'Student'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Grade</Text>
            <Text style={styles.infoValue}>{profile?.grade_level || '—'}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Roll No.</Text>
            <Text style={styles.infoValueMono}>{profile?.roll_number || '—'}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>House</Text>
            <Text style={styles.infoValue}>{profile?.house || '—'}</Text>
          </View>
        </View>

        {otherAccounts.length > 0 && (
          <View style={styles.switchSection}>
            <Text style={styles.sectionLabel}>Switch Account</Text>
            {otherAccounts.map((account) => (
              <TouchableOpacity
                key={account.email}
                style={styles.switchCard}
                onPress={() => {
                  Alert.alert('Switch Account', `Switch to ${account.full_name || account.email}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Switch',
                      onPress: async () => {
                        await logout();
                      },
                    },
                  ]);
                }}
                onLongPress={() => handleRemoveAccount(account)}
                activeOpacity={0.7}
              >
                <View style={styles.switchAvatar}>
                  <Text style={styles.switchAvatarText}>{(account.full_name || account.email)[0].toUpperCase()}</Text>
                </View>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchName}>{account.full_name || account.email}</Text>
                  <Text style={styles.switchEmail}>{account.email}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
  infoValueMono: { fontSize: 14, fontWeight: '600', color: COLORS.text, fontFamily: 'Courier' },
  infoDivider: { height: 1, backgroundColor: COLORS.borderLight },
  switchSection: {
    width: '100%',
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  switchAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  switchInfo: { flex: 1 },
  switchName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  switchEmail: { fontSize: 12, color: COLORS.textSecondary },
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
