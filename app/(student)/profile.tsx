import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useRouter } from 'expo-router';
import { getSavedAccounts, removeAccount, type SavedAccount } from '../../lib/accounts';
import {
  PageHeader,
  NotebookCard,
  Avatar,
  InfoRow,
  PrimaryButton,
  SectionHeader,
  LoadingScreen,
} from '../../lib/components';

export default function StudentProfileScreen() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await getSavedAccounts().then(setSavedAccounts);
    setRefreshing(false);
  };

  const otherAccounts = savedAccounts.filter((a) => a.email !== user?.email);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.tape}
          colors={[COLORS.tape]}
        />
      }
    >
      <View style={styles.body}>
        <PageHeader
          title="Profile"
          subtitle={user?.email}
        />

        <View style={styles.avatarSection}>
          <Avatar
            name={profile?.full_name || 'Student'}
            size={80}
            color={COLORS.tape}
          />
          <Text style={styles.name}>{profile?.full_name || 'Student'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <NotebookCard>
          <InfoRow label="Grade" value={profile?.grade_level || '—'} icon="📚" />
          <InfoRow label="Roll No." value={profile?.roll_number || '—'} icon="🔢" />
          <InfoRow label="House" value={profile?.house || '—'} icon="🏠" />
        </NotebookCard>

        {otherAccounts.length > 0 && (
          <>
            <SectionHeader title="Switch Account" />
            {otherAccounts.map((account) => (
              <TouchableOpacity
                key={account.email}
                style={styles.switchCard}
                onPress={() => {
                  Alert.alert('Switch Account', `Switch to ${account.full_name || account.email}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Switch', onPress: async () => { await logout(); } },
                  ]);
                }}
                onLongPress={() => handleRemoveAccount(account)}
                activeOpacity={0.7}
              >
                <Avatar
                  name={account.full_name || account.email}
                  size={36}
                  color={COLORS.graphite}
                />
                <View style={styles.switchInfo}>
                  <Text style={styles.switchName}>{account.full_name || account.email}</Text>
                  <Text style={styles.switchEmail}>{account.email}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            title="Log Out"
            onPress={handleLogout}
            variant="danger"
            icon="🚪"
          />
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    padding: 20,
  },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: COLORS.graphite,
  },

  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  switchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  switchName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
  },
  switchEmail: {
    fontSize: 12,
    color: COLORS.graphite,
    marginTop: 2,
  },
});
