import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';

export default function AdminSeedScreen() {
  const [loading, setLoading] = useState(false);
  const [seedData, setSeedData] = useState({
    schoolName: 'Elmwood Academy',
    adminEmail: 'admin@elmwood.demo',
    adminPassword: 'password123',
    teacherEmails: ['teacher1@elmwood.demo', 'teacher2@elmwood.demo'],
    teacherPasswords: ['password123', 'password123'],
    studentEmails: [
      'student1@elmwood.demo',
      'student2@elmwood.demo',
      'student3@elmwood.demo',
      'student4@elmwood.demo',
      'student5@elmwood.demo'
    ],
    studentPasswords: ['password123', 'password123', 'password123', 'password123', 'password123'],
    parentEmails: ['parent1@elmwood.demo', 'parent2@elmwood.demo'],
    parentPasswords: ['password123', 'password123']
  });

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const seedDatabase = async () => {
    setLoading(true);
    try {
      // First, create the school
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          id: generateUUID(),
          name: seedData.schoolName,
        })
        .select()
        .single();

      if (schoolError) throw schoolError;

      // Create admin user
      const { data: adminUser, error: adminAuthError } = await supabase.auth.signUp({
        email: seedData.adminEmail,
        password: seedData.adminPassword,
      });

      if (adminAuthError) throw adminAuthError;

      if (adminUser.user) {
        // Create admin profile
        const { error: adminProfileError } = await supabase
          .from('profiles')
          .insert({
            id: adminUser.user.id,
            school_id: school.id,
            role: 'admin',
            full_name: 'Admin User',
            email: seedData.adminEmail,
          });

        if (adminProfileError) throw adminProfileError;
      }

      // Create teachers
      const teacherProfiles: { id: string; full_name: string }[] = [];
      for (let i = 0; i < seedData.teacherEmails.length; i++) {
        const { data: teacherUser, error: teacherAuthError } = await supabase.auth.signUp({
          email: seedData.teacherEmails[i],
          password: seedData.teacherPasswords[i],
        });

        if (teacherAuthError) throw teacherAuthError;

        if (teacherUser.user) {
          const fullName = `Teacher ${i + 1}`;
          const { error: teacherProfileError } = await supabase
            .from('profiles')
            .insert({
              id: teacherUser.user.id,
              school_id: school.id,
              role: 'teacher',
              full_name: fullName,
              email: seedData.teacherEmails[i],
            });

          if (teacherProfileError) throw teacherProfileError;

          teacherProfiles.push({ id: teacherUser.user.id, full_name: fullName });
        }
      }

      // Create classes, one per teacher
      const classIds: string[] = [];
      for (let i = 0; i < teacherProfiles.length; i++) {
        const classId = generateUUID();
        const { error: classError } = await supabase
          .from('classes')
          .insert({
            id: classId,
            school_id: school.id,
            name: `Class ${i + 1}`,
            grade_level: `${i + 5}th Grade`,
            teacher_id: teacherProfiles[i].id,
          });

        if (classError) throw classError;
        classIds.push(classId);
      }

      // Create students, split evenly across classes
      const studentProfiles: { id: string; full_name: string }[] = [];
      for (let i = 0; i < seedData.studentEmails.length; i++) {
        const { data: studentUser, error: studentAuthError } = await supabase.auth.signUp({
          email: seedData.studentEmails[i],
          password: seedData.studentPasswords[i],
        });

        if (studentAuthError) throw studentAuthError;

        if (studentUser.user) {
          const fullName = `Student ${i + 1}`;
          const { error: studentProfileError } = await supabase
            .from('profiles')
            .insert({
              id: studentUser.user.id,
              school_id: school.id,
              role: 'student',
              full_name: fullName,
              email: seedData.studentEmails[i],
            });

          if (studentProfileError) throw studentProfileError;

          studentProfiles.push({ id: studentUser.user.id, full_name: fullName });

          // Enroll the student into a class (round-robin across available classes)
          if (classIds.length > 0) {
            const assignedClassId = classIds[i % classIds.length];
            const { error: enrollmentError } = await supabase
              .from('class_enrollments')
              .insert({
                class_id: assignedClassId,
                student_id: studentUser.user.id,
              });

            if (enrollmentError) throw enrollmentError;
          }
        }
      }

      // Create parents, each linked to one student
      for (let i = 0; i < seedData.parentEmails.length; i++) {
        const { data: parentUser, error: parentAuthError } = await supabase.auth.signUp({
          email: seedData.parentEmails[i],
          password: seedData.parentPasswords[i],
        });

        if (parentAuthError) throw parentAuthError;

        if (parentUser.user) {
          const { error: parentProfileError } = await supabase
            .from('profiles')
            .insert({
              id: parentUser.user.id,
              school_id: school.id,
              role: 'parent',
              full_name: `Parent ${i + 1}`,
              email: seedData.parentEmails[i],
            });

          if (parentProfileError) throw parentProfileError;

          // Link this parent to a student (round-robin, if any students exist)
          if (studentProfiles.length > 0) {
            const linkedStudent = studentProfiles[i % studentProfiles.length];
            const { error: linkError } = await supabase
              .from('parent_students')
              .insert({
                parent_id: parentUser.user.id,
                student_id: linkedStudent.id,
              });

            if (linkError) throw linkError;
          }
        }
      }

      Alert.alert('Success', 'Demo data has been created successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'An error occurred while seeding data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seed Demo Data</Text>
      <Text style={styles.description}>
        This creates a demo school with one admin, {seedData.teacherEmails.length} teachers,{' '}
        {seedData.studentEmails.length} students, and {seedData.parentEmails.length} parents,
        along with classes, enrollments, and parent-child links.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>School Name</Text>
        <TextInput
          style={styles.input}
          value={seedData.schoolName}
          onChangeText={(text) => setSeedData({ ...seedData, schoolName: text })}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Admin Email</Text>
        <TextInput
          style={styles.input}
          value={seedData.adminEmail}
          onChangeText={(text) => setSeedData({ ...seedData, adminEmail: text })}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={seedDatabase}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Seeding...' : 'Seed Database'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: COLORS.graphite,
    marginBottom: 24,
    lineHeight: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.paperDim,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.ink,
  },
  button: {
    backgroundColor: COLORS.chalk,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.paper,
    fontSize: 16,
    fontWeight: 'bold',
  },
});