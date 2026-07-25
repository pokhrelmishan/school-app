import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Modal } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

interface School {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  teacher?: {
    full_name: string;
  } | null;
  school?: {
    name: string;
  } | null;
}

export default function AdminClassesScreen() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClass, setNewClass] = useState({
    name: '',
    grade_level: '',
    teacher_id: '',
    school_id: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .order('name');

      // Fetch teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'teacher')
        .order('full_name');

      // Fetch classes with teacher and school info
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          teacher_id,
          teacher:profiles!classes_teacher_id_fkey(full_name),
          school:schools(name)
        `)
        .order('name');

      if (schoolsError) {
        setErrorMsg(schoolsError.message);
      } else if (schoolsData) {
        setSchools(schoolsData);
      }

      if (teachersError) {
        setErrorMsg(teachersError.message);
      } else if (teachersData) {
        setTeachers(teachersData);
      }

      if (classesError) {
        setErrorMsg(classesError.message);
      } else if (classesData) {
        const formattedClasses = classesData.map(cls => ({
          ...cls,
          teacher: cls.teacher ? (Array.isArray(cls.teacher) ? cls.teacher[0] : cls.teacher) : null,
          school: cls.school ? (Array.isArray(cls.school) ? cls.school[0] : cls.school) : null
        }));
        setClasses(formattedClasses);
      }

    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClass.name || !newClass.grade_level || !newClass.teacher_id || !newClass.school_id) {
      setErrorMsg('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: newClass.name,
          grade_level: newClass.grade_level,
          teacher_id: newClass.teacher_id,
          school_id: newClass.school_id,
        })
        .select(`
          id,
          name,
          grade_level,
          teacher_id,
          teacher:profiles!classes_teacher_id_fkey(id, full_name),
          school:schools(id, name)
        `)
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        const formattedClass = {
          ...data,
          teacher: data.teacher ? (Array.isArray(data.teacher) ? data.teacher[0] : data.teacher) : null,
          school: data.school ? (Array.isArray(data.school) ? data.school[0] : data.school) : null
        };
        setClasses(prev => [...prev, formattedClass]);
        
        // Reset form
        setNewClass({
          name: '',
          grade_level: '',
          teacher_id: '',
          school_id: ''
        });
        setShowAddModal(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred adding class');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Class Management</Text>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>Add New Class</Text>
      </TouchableOpacity>

      {loading && classes.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : classes.length === 0 ? (
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
              <Text style={styles.cardText}>School: {item.school?.name || 'Unknown'}</Text>
            </View>
          )}
        />
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Class</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Class Name"
              value={newClass.name}
              onChangeText={(text) => setNewClass(prev => ({ ...prev, name: text }))}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Grade Level"
              value={newClass.grade_level}
              onChangeText={(text) => setNewClass(prev => ({ ...prev, grade_level: text }))}
            />
            
            <View style={styles.modalSelectContainer}>
              <Text style={styles.modalLabel}>Teacher:</Text>
              <View style={styles.teacherSelector}>
                {teachers.map(teacher => (
                  <TouchableOpacity
                    key={teacher.id}
                    style={[styles.teacherOption, newClass.teacher_id === teacher.id && styles.teacherOptionSelected]}
                    onPress={() => setNewClass(prev => ({ ...prev, teacher_id: teacher.id }))}
                  >
                    <Text style={[styles.teacherOptionText, newClass.teacher_id === teacher.id && styles.teacherOptionTextSelected]}>
                      {teacher.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalSelectContainer}>
              <Text style={styles.modalLabel}>School:</Text>
              <View style={styles.schoolSelector}>
                {schools.map(school => (
                  <TouchableOpacity
                    key={school.id}
                    style={[styles.schoolOption, newClass.school_id === school.id && styles.schoolOptionSelected]}
                    onPress={() => setNewClass(prev => ({ ...prev, school_id: school.id }))}
                  >
                    <Text style={[styles.schoolOptionText, newClass.school_id === school.id && styles.schoolOptionTextSelected]}>
                      {school.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddClass}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 16,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: 16,
  },
  modalSelectContainer: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  teacherSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teacherOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  teacherOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  teacherOptionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  teacherOptionTextSelected: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  schoolSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  schoolOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  schoolOptionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  schoolOptionTextSelected: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.textSecondary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});