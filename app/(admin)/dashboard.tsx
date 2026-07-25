import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface School {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  teacher?: {
    full_name: string;
  } | null;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schools' | 'users' | 'classes'>('schools');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const errors: string[] = [];

      // Fetch schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      // Fetch classes with teacher info
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          teacher_id,
          teacher:profiles!classes_teacher_id_fkey(full_name)
        `)
        .order('name');

      if (schoolsError) {
        errors.push(schoolsError.message);
      } else if (schoolsData) {
        setSchools(schoolsData);
      }

      if (profilesError) {
        errors.push(profilesError.message);
      } else if (profilesData) {
        setProfiles(profilesData);
      }

      if (classesError) {
        errors.push(classesError.message);
      } else if (classesData) {
        const formattedClasses = classesData.map(cls => ({
          ...cls,
          teacher: cls.teacher ? (Array.isArray(cls.teacher) ? cls.teacher[0] : cls.teacher) : null,
        }));
        setClasses(formattedClasses);
      }

      if (errors.length > 0) {
        setErrorMsg(errors.join('; '));
      }

    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return COLORS.danger;
      case 'teacher':
        return COLORS.pencil;
      case 'student':
        return COLORS.chalk;
      case 'parent':
        return COLORS.graphite;
      default:
        return COLORS.ink;
    }
  };

  const getRoleDisplay = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const renderSchoolsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Schools</Text>
      {schools.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No schools found.</Text>
        </View>
      ) : (
        <FlatList
          data={schools}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardText}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
              <Text style={styles.cardText}>ID: {item.id}</Text>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderUsersTab = () => {
    const adminUsers = profiles.filter(p => p.role === 'admin');
    const teacherUsers = profiles.filter(p => p.role === 'teacher');
    const studentUsers = profiles.filter(p => p.role === 'student');
    const parentUsers = profiles.filter(p => p.role === 'parent');

    return (
      <View style={styles.tabContent}>
        <Text style={styles.tabTitle}>Users</Text>
        
        {adminUsers.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Admins ({adminUsers.length})</Text>
            {adminUsers.map(user => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.full_name}</Text>
                <Text style={styles.cardText}>Email: {user.email}</Text>
                <Text style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  {getRoleDisplay(user.role)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {teacherUsers.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Teachers ({teacherUsers.length})</Text>
            {teacherUsers.map(user => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.full_name}</Text>
                <Text style={styles.cardText}>Email: {user.email}</Text>
                <Text style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  {getRoleDisplay(user.role)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {studentUsers.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Students ({studentUsers.length})</Text>
            {studentUsers.map(user => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.full_name}</Text>
                <Text style={styles.cardText}>Email: {user.email}</Text>
                <Text style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  {getRoleDisplay(user.role)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {parentUsers.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Parents ({parentUsers.length})</Text>
            {parentUsers.map(user => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.full_name}</Text>
                <Text style={styles.cardText}>Email: {user.email}</Text>
                <Text style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  {getRoleDisplay(user.role)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderClassesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Classes</Text>
      {classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No classes found.</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardText}>Grade: {item.grade_level}</Text>
              <Text style={styles.cardText}>Teacher: {item.teacher?.full_name || 'Unassigned'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Admin Dashboard</Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'schools' && styles.tabButtonActive]}
          onPress={() => setActiveTab('schools')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'schools' && styles.tabButtonTextActive]}>Schools</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'users' && styles.tabButtonTextActive]}>Users</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'classes' && styles.tabButtonActive]}
          onPress={() => setActiveTab('classes')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'classes' && styles.tabButtonTextActive]}>Classes</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView>
          {activeTab === 'schools' && renderSchoolsTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'classes' && renderClassesTab()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: COLORS.paper,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    color: COLORS.graphite,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: COLORS.ink,
  },
  tabContent: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
    marginTop: 20,
  },
  loader: {
    marginTop: 32,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  errorText: {
    color: COLORS.danger,
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.cover,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.paper,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.graphite,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.graphite,
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
});