import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { useLocalSearchParams } from 'expo-router';

interface Student {
  id: string;
  full_name: string;
  email: string;
}

interface AttendanceRecord {
  id?: string;
  class_id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  student?: Student;
}

const statusOptions = ['present', 'absent', 'late', 'excused'] as const;

export default function TeacherAttendanceScreen() {
  const { user } = useAuth();
  const { classId } = useLocalSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState<boolean>(false);
  const selectedDate = new Date().toISOString().split('T')[0];

  const fetchStudentsAndAttendance = async () => {
    if (!classId) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          profiles(id, full_name, email)
        `)
        .eq('class_id', classId);

      if (enrollmentsError) {
        setErrorMsg(enrollmentsError.message);
        return;
      }

      const studentsList = enrollments?.map((enrollment: any) => {
        const p = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
        if (!p) return null;
        return p as Student;
      }).filter(Boolean) as Student[];
      setStudents(studentsList);

      const { data: existingRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('class_id', classId)
        .eq('date', selectedDate);

      if (recordsError) {
        setErrorMsg(recordsError.message);
        return;
      }

      const recordsMap: Record<string, AttendanceRecord> = {};
      existingRecords?.forEach(record => {
        recordsMap[record.student_id] = record;
      });
      setAttendanceRecords(recordsMap);

      if (existingRecords && existingRecords.length > 0) {
        setLocked(true);
      }

    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching data');
    } finally {
      setLoading(false);
    }
  };

  const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (locked) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const existingRecord = attendanceRecords[studentId];
    const newRecord: AttendanceRecord = {
      ...(existingRecord?.id ? { id: existingRecord.id } : {}),
      class_id: classId as string,
      student_id: studentId,
      date: selectedDate,
      status,
      notes: existingRecord?.notes || '',
      student,
    };

    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: newRecord,
    }));
  };

  const updateNotes = (studentId: string, notes: string) => {
    if (locked) return;
    const existingRecord = attendanceRecords[studentId];
    if (!existingRecord) return;

    const updatedRecord: AttendanceRecord = {
      ...existingRecord,
      notes,
    };

    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: updatedRecord,
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    setErrorMsg(null);
    
    try {
      const recordsToSave = Object.values(attendanceRecords).map(({ student, ...rest }) => rest);
      
      const { error } = await supabase
        .from('attendance_records')
        .upsert(recordsToSave, {
          onConflict: 'class_id, student_id, date',
        });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setLocked(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred saving attendance');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchStudentsAndAttendance();
  }, [classId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Text style={styles.dateLabel}>Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.chalk} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStudentsAndAttendance}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No students enrolled in this class.</Text>
        </View>
      ) : (
        <>
          {locked && (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedText}>Attendance already marked for today</Text>
            </View>
          )}
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const record = attendanceRecords[item.id];
              const currentStatus = record?.status || 'present';
              
              return (
                <View style={[styles.studentCard, locked && styles.studentCardLocked]}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{item.full_name}</Text>
                    <Text style={styles.studentEmail}>{item.email}</Text>
                  </View>
                  
                  <View style={styles.statusSection}>
                    <Text style={styles.statusLabel}>Status:</Text>
                    <View style={styles.statusButtons}>
                      {statusOptions.map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            currentStatus === status && styles.statusButtonSelected,
                            locked && styles.statusButtonLocked,
                          ]}
                          onPress={() => updateAttendanceStatus(item.id, status)}
                          disabled={locked}
                        >
                          <Text 
                            style={[
                              styles.statusButtonText,
                              currentStatus === status && styles.statusButtonTextSelected,
                            ]}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.notesSection}>
                    <TextInput
                      style={[styles.notesInput, locked && styles.notesInputLocked]}
                      value={record?.notes || ''}
                      onChangeText={(text) => updateNotes(item.id, text)}
                      placeholder={locked ? '' : 'Notes (optional)'}
                      multiline
                      editable={!locked}
                    />
                  </View>
                </View>
              );
            }}
          />
          
          {!locked && (
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveAttendance}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Attendance'}
              </Text>
            </TouchableOpacity>
          )}
        </>
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
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: COLORS.graphite,
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
  lockedBanner: {
    backgroundColor: COLORS.graphite + '15',
    borderWidth: 1,
    borderColor: COLORS.graphite + '30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  lockedText: {
    color: COLORS.graphite,
    fontWeight: '700',
    fontSize: 14,
  },
  successBanner: {
    backgroundColor: COLORS.chalk + '20',
    borderWidth: 1,
    borderColor: COLORS.chalk + '40',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  successText: {
    color: COLORS.chalk,
    fontWeight: '700',
    fontSize: 14,
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
  studentCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
  },
  studentCardLocked: {
    opacity: 0.7,
  },
  studentInfo: {
    marginBottom: 16,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 14,
    color: COLORS.graphite,
  },
  statusSection: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: COLORS.paper,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  statusButtonSelected: {
    backgroundColor: COLORS.chalk,
    borderColor: COLORS.chalk,
  },
  statusButtonLocked: {
    opacity: 0.6,
  },
  statusButtonText: {
    color: COLORS.ink,
    fontSize: 12,
  },
  statusButtonTextSelected: {
    color: COLORS.paper,
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.paper,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  notesInputLocked: {
    backgroundColor: COLORS.paperDim,
  },
  saveButton: {
    backgroundColor: COLORS.chalk,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.graphite,
  },
  saveButtonText: {
    color: COLORS.paper,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
