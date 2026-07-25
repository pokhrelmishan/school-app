import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../../lib/theme';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>
      {icon}
    </Text>
  );
}

const tabStyles = StyleSheet.create({
  icon: { fontSize: 22, opacity: 0.4 },
  iconActive: { opacity: 1 },
});

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.borderLight,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: 'Users', tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="classes"
        options={{ title: 'Classes', tabBarIcon: ({ focused }) => <TabIcon icon="📚" focused={focused} /> }}
      />
      <Tabs.Screen
        name="timetable"
        options={{ title: 'Timetable', tabBarIcon: ({ focused }) => <TabIcon icon="🗓️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="fees"
        options={{ title: 'Fees', tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} /> }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="subjects" options={{ href: null }} />
      <Tabs.Screen name="exams" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="class/[classId]" options={{ href: null }} />
    </Tabs>
  );
}
