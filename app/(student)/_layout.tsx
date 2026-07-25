import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../lib/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '▦',
    Attendance: '✓',
    Grades: '★',
    Assignments: '◎',
    Notices: '◉',
  };
  return (
    <Text style={{ fontSize: 20, color: focused ? COLORS.pencil : COLORS.graphiteLight, opacity: focused ? 1 : 0.6 }}>
      {icons[label] || '●'}
    </Text>
  );
}

export default function StudentLayout() {
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
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused }) => <TabIcon label="Attendance" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="grades"
        options={{
          title: 'Grades',
          tabBarIcon: ({ focused }) => <TabIcon label="Grades" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Assignments',
          tabBarIcon: ({ focused }) => <TabIcon label="Assignments" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: 'Notices',
          tabBarIcon: ({ focused }) => <TabIcon label="Notices" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
