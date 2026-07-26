import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/theme';
import { getSavedAccounts, saveAccount, removeAccount, type SavedAccount } from '../../lib/accounts';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = await login(email, password);
      await saveAccount({ email: email.toLowerCase().trim(), password, full_name: p?.full_name, role: p?.role });
      const accounts = await getSavedAccounts();
      setSavedAccounts(accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (account: SavedAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setLoading(true);
    setError(null);
    try {
      await login(account.email, account.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          {/* Cover header */}
          <View style={styles.cover}>
            <View style={styles.tapeStrip}>
              <Text style={styles.tapeText}>EDIFY</Text>
            </View>
            <Text style={styles.schoolLabel}>EDIFY INTERNATIONAL SCHOOL</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {savedAccounts.length > 0 && (
            <View style={styles.accountsSection}>
              <Text style={styles.accountsLabel}>Saved Accounts</Text>
              {savedAccounts.map((account) => (
                <TouchableOpacity
                  key={account.email}
                  style={styles.accountCard}
                  onPress={() => handleQuickLogin(account)}
                  disabled={loading}
                  onLongPress={() => handleRemoveAccount(account)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountAvatar}>
                    <Text style={styles.accountAvatarText}>{(account.full_name || account.email)[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName} numberOfLines={1}>{account.full_name || account.email}</Text>
                    <Text style={styles.accountRole} numberOfLines={1}>{account.role || account.email}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.formCard}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.graphiteLight}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.graphiteLight}
                secureTextEntry
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>International School Management System</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  cover: {
    backgroundColor: COLORS.cover,
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tapeStrip: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: COLORS.tape,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 2,
    transform: [{ rotate: '-1.5deg' }],
    zIndex: 10,
  },
  tapeText: { color: COLORS.white, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  schoolLabel: { fontSize: 10, color: COLORS.graphiteLight, letterSpacing: 1.5, fontWeight: '600', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.paper, marginTop: 4 },
  subtitle: { fontSize: 13, color: COLORS.graphiteLight, marginTop: 4 },
  accountsSection: { marginBottom: 20 },
  accountsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.graphite, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  accountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.chalkSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.chalk },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  accountRole: { fontSize: 12, color: COLORS.graphite, textTransform: 'capitalize' },
  formCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: 20,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.paperDim,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: COLORS.ink,
  },
  inputFocused: { borderColor: COLORS.cover, backgroundColor: COLORS.surface },
  errorBanner: { backgroundColor: COLORS.dangerBg, borderRadius: 8, padding: 10, marginBottom: 16 },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  button: {
    backgroundColor: COLORS.cover,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLORS.paper, fontSize: 15, fontWeight: '700' },
  footer: { textAlign: 'center', color: COLORS.graphiteLight, fontSize: 12, marginTop: 24 },
});

export default Login;
