import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
}

export default function TeacherClassesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchClasses = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Get classes for the current teacher
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('name');

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setClasses(data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchClasses();
    }
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>My Classes</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchClasses}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No classes found. Contact admin to assign you to a class.</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.className}>{item.name}</Text>
              <Text style={styles.gradeLevel}>Grade: {item.grade_level}</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.attendanceButton]}
                  onPress={() => {
                    // Navigate to attendance screen for this class
                    router.push(`/(teacher)/attendance/${item.id}`);
                  }}
                >
                  <Text style={styles.actionButtonText}>Mark Attendance</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.gradesButton]}
                  onPress={() => {
                    // Navigate to grades screen for this class
                    router.push(`/(teacher)/grades/${item.id}`);
                  }}
                >
                  <Text style={styles.actionButtonText}>Enter Grades</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  loader: {
    marginTop: 32,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.surfaceAlt,
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
    backgroundColor: COLORS.primaryDark,
    borderRadius: 6,
  },
  retryText: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  gradeLevel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  attendanceButton: {
    backgroundColor: COLORS.primary,
  },
  gradesButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 14,
  },
});