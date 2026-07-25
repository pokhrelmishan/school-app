import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert, ScrollView, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, SHADOWS } from '../../../lib/theme';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

interface Student {
  id: string;
  full_name: string;
  email?: string;
  roll_number?: string;
  grade_level?: string;
  house?: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  created_at: string;
  created_by: string;
  assignment_attachments?: { id: string; file_url: string; file_name: string }[];
}

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
}

interface AttachedFile { name: string; uri: string; }

export default function ClassDetailScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  // Assignment form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDay, setFormDay] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formFiles, setFormFiles] = useState<AttachedFile[]>([]);
  const [posting, setPosting] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchData(); }, [classId])
  );

  const fetchData = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const classRes = await supabase.from('classes').select('id, name, grade_level, teacher_id').eq('id', classId).single();
      if (classRes.data) {
        setClassInfo(classRes.data);
        setIsClassTeacher(classRes.data.teacher_id === user.id);
      }

      const studentRes = await supabase
        .from('class_enrollments')
        .select('student_id, profiles(id, full_name, email, roll_number, grade_level, house)')
        .eq('class_id', classId);
      if (studentRes.data) {
        setStudents(studentRes.data.map((e: any) => {
          const p = e.profiles;
          if (!p) return null;
          return { id: p.id, full_name: p.full_name, email: p.email, roll_number: p.roll_number, grade_level: p.grade_level, house: p.house };
        }).filter(Boolean) as Student[]);
      }

      const assignRes = await supabase
        .from('assignments')
        .select('id, title, description, due_date, created_at, created_by, assignment_attachments(id, file_url, file_name)')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });
      if (assignRes.data) setAssignments(assignRes.data as unknown as Assignment[]);
    } catch (err) {
      console.error('Error fetching class data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttachFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setFormFiles(prev => [...prev, { name: asset.fileName ?? asset.uri.split('/').pop() ?? 'file', uri: asset.uri }]);
      }
    } catch {}
  };

  const handlePost = async () => {
    if (!formTitle.trim()) return Alert.alert('Error', 'Title is required');
    const dueDate = formDay && formMonth && formYear
      ? `${formYear}-${formMonth.padStart(2, '0')}-${formDay.padStart(2, '0')}` : null;

    setPosting(true);
    const { data, error } = await supabase.from('assignments').insert({
      title: formTitle.trim(), description: formDesc.trim(), class_id: classId, created_by: (await supabase.auth.getUser()).data.user!.id, due_date: dueDate,
    }).select().single();

    if (error) { Alert.alert('Error', error.message); setPosting(false); return; }

    if (data && formFiles.length > 0) {
      for (const file of formFiles) {
        const ext = file.name.split('.').pop() ?? 'bin';
        const filePath = `${data.id}/${Date.now()}_${file.name}`;
        const fileRes = await fetch(file.uri);
        const blob = await fileRes.blob();
        const { error: uploadError } = await supabase.storage.from('assignment-files').upload(filePath, blob, { contentType: `application/${ext}` });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('assignment-files').getPublicUrl(filePath);
          await supabase.from('assignment_attachments').insert({ assignment_id: data.id, file_name: file.name, file_url: urlData.publicUrl });
        }
      }
    }

    setShowForm(false);
    setFormTitle(''); setFormDesc(''); setFormDay(''); setFormMonth(''); setFormYear(''); setFormFiles([]);
    await fetchData();
    setPosting(false);
  };

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: COLORS.danger, bg: COLORS.dangerBg };
    if (diff === 0) return { text: 'Due today', color: COLORS.danger, bg: COLORS.dangerBg };
    if (diff <= 3) return { text: `${diff}d left`, color: COLORS.warning, bg: COLORS.warningBg };
    return { text: `${diff}d left`, color: COLORS.success, bg: COLORS.successBg };
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!classInfo) return <View style={styles.center}><Text>Class not found</Text></View>;

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.full_name[0]}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{item.full_name}</Text>
          {item.roll_number ? <Text style={styles.studentDetail}>Roll #{item.roll_number}</Text> : null}
          {item.house ? <Text style={styles.studentDetail}>House: {item.house}</Text> : null}
        </View>
      </View>
      {isClassTeacher && (
        <View style={styles.studentActions}>
          <TouchableOpacity style={styles.studentActionBtn} onPress={() => router.push(`/(teacher)/grades/${classId}?studentId=${item.id}` as any)}>
            <Text style={styles.studentActionText}>Give Grades</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.studentActionBtn, { backgroundColor: COLORS.successBg }]} onPress={() => router.push(`/(teacher)/attendance/${classId}` as any)}>
            <Text style={[styles.studentActionText, { color: COLORS.success }]}>View Attendance</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={students}
      keyExtractor={(item) => item.id}
      renderItem={renderStudent}
      ListHeaderComponent={
        <View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.className}>{classInfo.name}</Text>
            <Text style={styles.gradeLevel}>Grade {classInfo.grade_level} · {students.length} students</Text>
          </View>

          {/* Students section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Students</Text>
          </View>

          {students.length === 0 && (
            <Text style={styles.emptyText}>No students enrolled yet.</Text>
          )}

          {/* Separator before assignments */}
          {students.length > 0 && assignments.length > 0 && <View style={styles.separator} />}

          {/* Assignments section */}
          {assignments.length > 0 || showForm ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Assignments</Text>
                {isClassTeacher && (
                  <TouchableOpacity onPress={() => setShowForm(!showForm)}>
                    <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ New'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showForm && (
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Title</Text>
                  <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Assignment title" placeholderTextColor={COLORS.textTertiary} />
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput style={[styles.input, styles.multiline]} value={formDesc} onChangeText={setFormDesc} placeholder="Optional description" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} textAlignVertical="top" />
                  <Text style={styles.formLabel}>Due Date</Text>
                  <View style={styles.dateRow}>
                    <TextInput style={[styles.input, styles.dateInput]} value={formDay} onChangeText={setFormDay} placeholder="DD" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" maxLength={2} />
                    <TextInput style={[styles.input, styles.dateInput]} value={formMonth} onChangeText={setFormMonth} placeholder="MM" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" maxLength={2} />
                    <TextInput style={[styles.input, { flex: 1.5 }]} value={formYear} onChangeText={setFormYear} placeholder="YYYY" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" maxLength={4} />
                  </View>
                  <TouchableOpacity style={styles.attachBtn} onPress={handleAttachFile}>
                    <Text style={styles.attachBtnText}>Attach File</Text>
                  </TouchableOpacity>
                  {formFiles.map((f, i) => (
                    <View key={i} style={styles.fileRow}>
                      <Text style={{ flex: 1, fontSize: 13, color: COLORS.textSecondary }} numberOfLines={1}>{f.name}</Text>
                      <TouchableOpacity onPress={() => setFormFiles(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={{ color: COLORS.danger }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.postBtn, posting && { opacity: 0.6 }]} onPress={handlePost} disabled={posting}>
                    <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post Assignment'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {assignments.map(item => {
                const badge = getDueDateBadge(item.due_date);
                const att = item.assignment_attachments || [];
                return (
                  <View key={item.id} style={styles.assignCard}>
                    <View style={styles.assignTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignTitle}>{item.title}</Text>
                      </View>
                      {badge && (
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                        </View>
                      )}
                    </View>
                    {item.description ? <Text style={styles.assignDesc} numberOfLines={2}>{item.description}</Text> : null}
                    <View style={styles.assignMeta}>
                      <Text style={styles.metaText}>Posted {new Date(item.created_at).toLocaleDateString()}</Text>
                      {item.due_date && <Text style={styles.metaText}>Due {new Date(item.due_date).toLocaleDateString()}</Text>}
                    </View>
                    {att.length > 0 && (
                      <View style={styles.attachSection}>
                        {att.map((a) => (
                          <TouchableOpacity key={a.id} onPress={() => Linking.openURL(a.file_url)}>
                            <Text style={styles.attachLink}>{a.file_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </View>
      }
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  backBtn: { marginBottom: 12, padding: 4 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  headerSection: { marginBottom: 16 },
  className: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  gradeLevel: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  list: { padding: 20 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  separator: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16, fontStyle: 'italic' },

  // Student cards
  studentCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.sm },
  studentTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  studentDetail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  studentActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  studentActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryBg, alignItems: 'center' },
  studentActionText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Assignment form
  formCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 14, ...SHADOWS.sm },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: COLORS.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  multiline: { minHeight: 80, paddingTop: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1 },
  attachBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  attachBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 6 },
  postBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  postBtnText: { color: COLORS.textInverse, fontSize: 15, fontWeight: '700' },

  // Assignment cards
  assignCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 10, ...SHADOWS.sm },
  assignTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  assignTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  assignDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginTop: 8 },
  assignMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 12, color: COLORS.textTertiary },
  attachSection: { marginTop: 10 },
  attachLink: { fontSize: 14, color: COLORS.primary, fontWeight: '500', marginBottom: 4 },
});
