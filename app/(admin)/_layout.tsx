import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../lib/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '▦',
    Users: '♟',
    Classes: '▤',
    Reports: '◈',
    Settings: '⚙',
    Seed: '✦',
  };
  return (
    <Text style={{ fontSize: 20, color: focused ? COLORS.pencil : COLORS.graphiteLight, opacity: focused ? 1 : 0.6 }}>
      {icons[label] || '●'}
    </Text>
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.cover,
          borderTopColor: COLORS.graphite,
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.pencil,
        tabBarInactiveTintColor: COLORS.graphiteLight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ focused }) => <TabIcon label="Users" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ focused }) => <TabIcon label="Classes" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon label="Reports" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="seed"
        options={{
          title: 'Seed',
          tabBarIcon: ({ focused }) => <TabIcon label="Seed" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
