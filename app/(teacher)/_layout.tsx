import { Tabs } from 'expo-router';
import { Text, StyleSheet, View } from 'react-native';
import { COLORS } from '../../lib/theme';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>{icon}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.tape + '18',
  },
  icon: { fontSize: 20, opacity: 0.4 },
  iconActive: { opacity: 1 },
});

export default function TeacherLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.tape,
        tabBarInactiveTintColor: COLORS.graphiteLight,
        tabBarStyle: {
          backgroundColor: COLORS.paper,
          borderTopColor: COLORS.line,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarIcon: ({ focused }) => <TabIcon icon="📚" focused={focused} /> }} />
      <Tabs.Screen name="timetable" options={{ title: 'Schedule', tabBarIcon: ({ focused }) => <TabIcon icon="🗓️" focused={focused} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} /> }} />
      <Tabs.Screen name="exams" options={{ title: 'Exams', tabBarIcon: ({ focused }) => <TabIcon icon="📝" focused={focused} /> }} />
      {/* Hidden */}
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="class/[classId]" options={{ href: null }} />
      <Tabs.Screen name="attendance/[classId]" options={{ href: null }} />
      <Tabs.Screen name="grades/[classId]" options={{ href: null }} />
    </Tabs>
  );
}
