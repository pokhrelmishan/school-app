import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
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

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

interface GradeEntry {
  id: string;
  student_id: string;
  title: string;
  score: number;
  max_score: number;
  term: string;
}

export default function AdminReportsScreen() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'overview' | 'attendance' | 'grades' | 'students'>('overview');

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
        .select('id, full_name, email, role, school_id')
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

      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, student_id, date, status')
        .order('date', { ascending: false });

      // Fetch grade entries
      const { data: gradesData, error: gradesError } = await supabase
        .from('grade_entries')
        .select('id, student_id, title, score, max_score, term')
        .order('created_at', { ascending: false });

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

      if (attendanceError) {
        errors.push(attendanceError.message);
      } else if (attendanceData) {
        setAttendance(attendanceData);
      }

      if (gradesError) {
        errors.push(gradesError.message);
      } else if (gradesData) {
        setGrades(gradesData);
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

  const getSchoolStats = () => {
    const totalStudents = profiles.filter(p => p.role === 'student').length;
    const totalTeachers = profiles.filter(p => p.role === 'teacher').length;
    const totalParents = profiles.filter(p => p.role === 'parent').length;
    const totalClasses = classes.length;
    
    const attendanceRate = attendance.length > 0 
      ? (attendance.filter(a => a.status === 'present').length / attendance.length) * 100 
      : 0;
    
    const averageGrade = grades.length > 0
      ? grades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / grades.length
      : 0;

    return {
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      attendanceRate,
      averageGrade,
    };
  };

  const getAttendanceReport = () => {
    const filteredAttendance = selectedSchool 
      ? attendance.filter(a => {
          const profile = profiles.find(p => p.id === a.student_id);
          return profile?.school_id === selectedSchool;
        })
      : attendance;

    const statusCounts = filteredAttendance.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { filteredAttendance, statusCounts };
  };

  const getGradesReport = () => {
    const filteredGrades = selectedSchool
      ? grades.filter(g => {
          const profile = profiles.find(p => p.id === g.student_id);
          return profile?.school_id === selectedSchool;
        })
      : grades;

    const termGrades = filteredGrades.reduce((acc, grade) => {
      if (!acc[grade.term]) {
        acc[grade.term] = [];
      }
      acc[grade.term].push(grade);
      return acc;
    }, {} as Record<string, GradeEntry[]>);

    return { filteredGrades, termGrades };
  };

  const getStudentReport = () => {
    const filteredProfiles = selectedSchool
      ? profiles.filter(p => p.school_id === selectedSchool)
      : profiles;

    const studentStats = filteredProfiles.map(student => {
      const studentAttendance = attendance.filter(a => a.student_id === student.id);
      const studentGrades = grades.filter(g => g.student_id === student.id);
      
      const attendanceRate = studentAttendance.length > 0
        ? (studentAttendance.filter(a => a.status === 'present').length / studentAttendance.length) * 100
        : 0;
      
      const averageGrade = studentGrades.length > 0
        ? studentGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / studentGrades.length
        : 0;

      return {
        ...student,
        attendanceRate,
        averageGrade,
        attendanceCount: studentAttendance.length,
        gradesCount: studentGrades.length,
      };
    });

    return studentStats;
  };

  const stats = getSchoolStats();
  const attendanceReport = getAttendanceReport();
  const gradesReport = getGradesReport();
  const studentReport = getStudentReport();

  useEffect(() => {
    fetchData();
  }, []);

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>School Overview</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalStudents}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalTeachers}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalParents}</Text>
          <Text style={styles.statLabel}>Parents</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalClasses}</Text>
          <Text style={styles.statLabel}>Classes</Text>
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Attendance Rate</Text>
        <View style={styles.chartBarContainer}>
          <View style={styles.chartBar}>
            <View 
              style={[styles.chartFill, { 
                height: `${stats.attendanceRate}%`, 
                backgroundColor: stats.attendanceRate >= 90 ? COLORS.chalk : 
                               stats.attendanceRate >= 70 ? COLORS.pencil : 
                               COLORS.danger 
              }]} 
            />
          </View>
          <Text style={styles.chartLabel}>{stats.attendanceRate.toFixed(1)}%</Text>
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Average Grade</Text>
        <View style={styles.chartBarContainer}>
          <View style={styles.chartBar}>
            <View 
              style={[styles.chartFill, { 
                height: `${stats.averageGrade}%`, 
                backgroundColor: stats.averageGrade >= 90 ? COLORS.chalk : 
                               stats.averageGrade >= 70 ? COLORS.pencil : 
                               stats.averageGrade >= 50 ? COLORS.ink : 
                               COLORS.danger 
              }]} 
            />
          </View>
          <Text style={styles.chartLabel}>{stats.averageGrade.toFixed(1)}%</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>Total Attendance Records: {attendance.length}</Text>
        </View>
        
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>Total Grade Entries: {grades.length}</Text>
        </View>
        
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>Schools: {schools.length}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderAttendanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Attendance Report</Text>
      
      {selectedSchool && (
        <TouchableOpacity 
          style={styles.clearFilterButton}
          onPress={() => setSelectedSchool(null)}
        >
          <Text style={styles.clearFilterText}>Clear School Filter</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statusGrid}>
        {['present', 'absent', 'late', 'excused'].map(status => (
          <View key={status} style={styles.statusCard}>
            <Text style={[styles.statusValue, { color: status === 'present' ? COLORS.chalk : 
                                               status === 'absent' ? COLORS.danger : 
                                               status === 'late' ? COLORS.pencil : 
                                               COLORS.graphite }]}>
              {attendanceReport.statusCounts[status] || 0}
            </Text>
            <Text style={styles.statusLabel}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Records</Text>
      {attendanceReport.filteredAttendance.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No attendance records found.</Text>
        </View>
      ) : (
        <FlatList
          data={attendanceReport.filteredAttendance.slice(0, 10)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const student = profiles.find(p => p.id === item.student_id);
            return (
              <View style={styles.recordCard}>
                <Text style={styles.recordText}>
                  {student?.full_name || 'Unknown Student'} - {item.date} - {item.status}
                </Text>
              </View>
            );
          }}
        />
      )}
    </ScrollView>
  );

  const renderGradesTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Grades Report</Text>
      
      {selectedSchool && (
        <TouchableOpacity 
          style={styles.clearFilterButton}
          onPress={() => setSelectedSchool(null)}
        >
          <Text style={styles.clearFilterText}>Clear School Filter</Text>
        </TouchableOpacity>
      )}

      {Object.keys(gradesReport.termGrades).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No grade data found.</Text>
        </View>
      ) : (
        Object.entries(gradesReport.termGrades).map(([term, termGrades]) => (
          <View key={term} style={styles.termSection}>
            <Text style={styles.termTitle}>{term}</Text>
            
            {termGrades.map(grade => {
              const student = profiles.find(p => p.id === grade.student_id);
              return (
                <View key={grade.id} style={styles.recordCard}>
                  <Text style={styles.recordText}>
                    {student?.full_name || 'Unknown Student'} - {grade.title} - {grade.score}/{grade.max_score} ({(grade.score / grade.max_score * 100).toFixed(1)}%)
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderStudentsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Student Report</Text>
      
      {selectedSchool && (
        <TouchableOpacity 
          style={styles.clearFilterButton}
          onPress={() => setSelectedSchool(null)}
        >
          <Text style={styles.clearFilterText}>Clear School Filter</Text>
        </TouchableOpacity>
      )}

      {studentReport.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No student data found.</Text>
        </View>
      ) : (
        <FlatList
          data={studentReport}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.studentCard}>
              <Text style={styles.studentName}>{item.full_name}</Text>
              <Text style={styles.studentEmail}>{item.email}</Text>
              <Text style={styles.studentRole}>{item.role}</Text>
              
              <View style={styles.studentStats}>
                <View style={styles.studentStat}>
                  <Text style={styles.statValue}>{item.attendanceCount}</Text>
                  <Text style={styles.statLabel}>Attendance</Text>
                </View>
                
                <View style={styles.studentStat}>
                  <Text style={styles.statValue}>{item.gradesCount}</Text>
                  <Text style={styles.statLabel}>Grades</Text>
                </View>
                
                <View style={styles.studentStat}>
                  <Text style={[styles.statValue, { 
                    color: item.attendanceRate >= 90 ? COLORS.chalk : 
                           item.attendanceRate >= 70 ? COLORS.pencil : 
                           COLORS.danger 
                  }]}>
                    {item.attendanceRate.toFixed(1)}%
                  </Text>
                  <Text style={styles.statLabel}>Attendance Rate</Text>
                </View>
                
                <View style={styles.studentStat}>
                  <Text style={[styles.statValue, { 
                    color: item.averageGrade >= 90 ? COLORS.chalk : 
                           item.averageGrade >= 70 ? COLORS.pencil : 
                           item.averageGrade >= 50 ? COLORS.ink : 
                           COLORS.danger 
                  }]}>
                    {(item.averageGrade || 0).toFixed(1)}%
                  </Text>
                  <Text style={styles.statLabel}>Avg Grade</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Admin Reports</Text>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Select School:</Text>
        <View style={styles.schoolSelector}>
          <TouchableOpacity
            style={[styles.schoolOption, !selectedSchool && styles.schoolOptionSelected]}
            onPress={() => setSelectedSchool(null)}
          >
            <Text style={[styles.schoolOptionText, !selectedSchool && styles.schoolOptionTextSelected]}>All Schools</Text>
          </TouchableOpacity>
          
          {schools.map(school => (
            <TouchableOpacity
              key={school.id}
              style={[styles.schoolOption, selectedSchool === school.id && styles.schoolOptionSelected]}
              onPress={() => setSelectedSchool(school.id)}
            >
              <Text style={[styles.schoolOptionText, selectedSchool === school.id && styles.schoolOptionTextSelected]}>
                {school.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, reportType === 'overview' && styles.tabButtonActive]}
          onPress={() => setReportType('overview')}
        >
          <Text style={[styles.tabButtonText, reportType === 'overview' && styles.tabButtonTextActive]}>Overview</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, reportType === 'attendance' && styles.tabButtonActive]}
          onPress={() => setReportType('attendance')}
        >
          <Text style={[styles.tabButtonText, reportType === 'attendance' && styles.tabButtonTextActive]}>Attendance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, reportType === 'grades' && styles.tabButtonActive]}
          onPress={() => setReportType('grades')}
        >
          <Text style={[styles.tabButtonText, reportType === 'grades' && styles.tabButtonTextActive]}>Grades</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, reportType === 'students' && styles.tabButtonActive]}
          onPress={() => setReportType('students')}
        >
          <Text style={[styles.tabButtonText, reportType === 'students' && styles.tabButtonTextActive]}>Students</Text>
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
          {reportType === 'overview' && renderOverviewTab()}
          {reportType === 'attendance' && renderAttendanceTab()}
          {reportType === 'grades' && renderGradesTab()}
          {reportType === 'students' && renderStudentsTab()}
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
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
  },
  schoolSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.paperDim,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  schoolOptionSelected: {
    backgroundColor: COLORS.chalk,
    borderColor: COLORS.chalk,
  },
  schoolOptionText: {
    color: COLORS.ink,
    fontWeight: '500',
  },
  schoolOptionTextSelected: {
    color: COLORS.paper,
    fontWeight: '600',
  },
  clearFilterButton: {
    backgroundColor: COLORS.graphite,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  clearFilterText: {
    color: COLORS.paper,
    fontWeight: '600',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minWidth: '22%',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.graphite,
  },
  chartSection: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
  },
  chartBarContainer: {
    height: 60,
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    height: 40,
    backgroundColor: COLORS.paper,
    borderRadius: 4,
    justifyContent: 'flex-end',
    padding: 4,
  },
  chartFill: {
    borderRadius: 3,
    minHeight: 32,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    marginTop: 8,
  },
  recentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
  },
  activityItem: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  activityText: {
    fontSize: 14,
    color: COLORS.ink,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minWidth: '22%',
    flex: 1,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.graphite,
    textTransform: 'capitalize',
  },
  termSection: {
    marginBottom: 20,
  },
  termTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 12,
    paddingLeft: 16,
  },
  recordCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    marginLeft: 24,
  },
  recordText: {
    fontSize: 14,
    color: COLORS.ink,
  },
  studentCard: {
    backgroundColor: COLORS.paperDim,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.pencil,
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
    marginBottom: 4,
  },
  studentRole: {
    fontSize: 12,
    color: COLORS.graphite,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  studentStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentStat: {
    alignItems: 'center',
    minWidth: '20%',
    flex: 1,
  },
  studentStatLabel: {
    fontSize: 12,
    color: COLORS.graphite,
    marginBottom: 4,
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
});