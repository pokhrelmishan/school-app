import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { COLORS } from '../lib/theme';

function AuthGate() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      const role = profile?.role;
      switch (role) {
        case 'admin':
          router.replace('/(admin)/dashboard');
          break;
        case 'teacher':
          router.replace('/(teacher)/classes');
          break;
        case 'parent':
          router.replace('/(parent)/attendance');
          break;
        case 'student':
          router.replace('/(student)/attendance');
          break;
        default:
          router.replace('/');
      }
    }
  }, [user, loading, profile, segments]);

  if (loading) {
    return (
      <View style={authStyles.center}>
        <ActivityIndicator size="large" color={COLORS.chalk} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.cover },
        headerTintColor: COLORS.paper,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: COLORS.paper },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
      <Stack.Screen name="(student)" options={{ headerShown: false }} />
      <Stack.Screen name="(parent)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={COLORS.cover} />
      <AuthGate />
    </AuthProvider>
  );
}

const authStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.paper,
  },
});
