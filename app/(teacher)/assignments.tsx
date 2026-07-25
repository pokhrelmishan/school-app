import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import * as ImagePicker from 'expo-image-picker';

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  class_id: string;
  created_by: string;
  class?: { id: string; name: string };
  assignment_attachments?: { id: string; file_url: string; file_name: string }[];
}

interface ClassOption {
  id: string;
  name: string;
}

interface AttachedFile {
  name: string;
  uri: string;
}

export default function TeacherAssignmentsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [formClassId, setFormClassId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDay, setFormDay] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formFiles, setFormFiles] = useState<AttachedFile[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchAssignments();
      fetchClasses();
    }
  }, [user?.id]);

  const fetchAssignments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assignments')
      .select(
        'id, title, description, due_date, created_at, class_id, created_by, class:classes(id, name), assignment_attachments(id, file_url, file_name)'
      )
      .eq('created_by', user!.id)
      .order('created_at', { ascending: false });
    if (data) setAssignments(data as unknown as Assignment[]);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const classTeacherRes = await supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user!.id);

    const subjectRes = await supabase
      .from('teacher_subjects')
      .select('class_id, classes(id, name)')
      .eq('teacher_id', user!.id);

    const seen = new Set<string>();
    const merged: ClassOption[] = [];

    if (classTeacherRes.data) {
      for (const c of classTeacherRes.data) {
        seen.add(c.id);
        merged.push({ id: c.id, name: c.name });
      }
    }
    if (subjectRes.data) {
      for (const s of subjectRes.data) {
        const cls = s.classes as any;
        if (cls && !seen.has(s.class_id)) {
          seen.add(s.class_id);
          merged.push({ id: cls.id, name: cls.name });
        }
      }
    }

    setClasses(merged);
    if (merged.length > 0) setFormClassId(merged[0].id);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormDay('');
    setFormMonth('');
    setFormYear('');
    setFormFiles([]);
    if (classes.length > 0) setFormClassId(classes[0].id);
  };

  const handleAttachFile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 1,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'file';
        setFormFiles((prev) => [...prev, { name, uri: asset.uri }]);
      }
    } catch {
      // User cancelled or error
    }
  };

  const removeFile = (index: number) => {
    setFormFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (assignmentId: string) => {
    for (const file of formFiles) {
      const ext = file.name.split('.').pop() ?? 'bin';
      const filePath = `${assignmentId}/${Date.now()}_${file.name}`;
      const fileRes = await fetch(file.uri);
      const blob = await fileRes.blob();

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(filePath, blob, { contentType: `application/${ext}` });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('assignment-files')
          .getPublicUrl(filePath);

        await supabase.from('assignment_attachments').insert({
          assignment_id: assignmentId,
          file_name: file.name,
          file_url: urlData.publicUrl,
        });
      }
    }
  };

  const handlePost = async () => {
    if (!formTitle.trim()) return Alert.alert('Error', 'Title is required');
    if (!formClassId) return Alert.alert('Error', 'Select a class');

    const dueDate =
      formDay && formMonth && formYear
        ? `${formYear}-${formMonth.padStart(2, '0')}-${formDay.padStart(2, '0')}`
        : null;

    setPosting(true);
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        title: formTitle.trim(),
        description: formDescription.trim(),
        class_id: formClassId,
        created_by: user!.id,
        due_date: dueDate,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setPosting(false);
      return;
    }

    if (data && formFiles.length > 0) {
      await uploadFiles(data.id);
    }

    setShowForm(false);
    resetForm();
    await fetchAssignments();
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

  const handleProfilePress = () => {
    router.push('/(teacher)/profile' as any);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Assignments</Text>
        <TouchableOpacity onPress={handleProfilePress} style={styles.avatarBtn}>
          <Text style={{ fontSize: 32, color: COLORS.primary }}>👤</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => {
          setShowForm((prev) => !prev);
          if (!showForm) resetForm();
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 20, color: COLORS.textInverse }}>{showForm ? '✕' : '+'}</Text>
        <Text style={styles.newBtnText}>{showForm ? 'Cancel' : 'New Assignment'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classPicker}>
            {classes.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.classChip, formClassId === c.id && styles.classChipActive]}
                onPress={() => setFormClassId(c.id)}
              >
                <Text style={[styles.classChipText, formClassId === c.id && styles.classChipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Assignment title"
            placeholderTextColor={COLORS.textTertiary}
            value={formTitle}
            onChangeText={setFormTitle}
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Assignment description (optional)"
            placeholderTextColor={COLORS.textTertiary}
            value={formDescription}
            onChangeText={setFormDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.formLabel}>Due Date</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="DD"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={formDay}
              onChangeText={setFormDay}
            />
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="MM"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="number-pad"
              maxLength={2}
              value={formMonth}
              onChangeText={setFormMonth}
            />
            <TextInput
              style={[styles.input, styles.dateInput, { flex: 1.5 }]}
              placeholder="YYYY"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="number-pad"
              maxLength={4}
              value={formYear}
              onChangeText={setFormYear}
            />
          </View>

          <Text style={styles.formLabel}>Attachments</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={handleAttachFile} activeOpacity={0.7}>
            <Text style={{ fontSize: 18, color: COLORS.primary }}>📎</Text>
            <Text style={styles.attachBtnText}>Attach File</Text>
          </TouchableOpacity>

          {formFiles.length > 0 && (
            <View style={styles.fileList}>
              {formFiles.map((f, i) => (
                <View key={i} style={styles.fileRow}>
                  <Text style={{ fontSize: 16, color: COLORS.textSecondary }}>📄</Text>
                  <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(i)}>
                    <Text style={{ fontSize: 18, color: COLORS.danger }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.postBtn, posting && { opacity: 0.6 }]}
            onPress={handlePost}
            disabled={posting}
            activeOpacity={0.7}
          >
            {posting ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.postBtnText}>Post Assignment</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48, color: COLORS.textTertiary }}>📋</Text>
          <Text style={styles.emptyText}>No assignments yet</Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const className = Array.isArray(item.class) ? item.class[0]?.name : item.class?.name;
            const badge = getDueDateBadge(item.due_date);
            const attachments = item.assignment_attachments || [];
            const isExpanded = expandedId === item.id;

            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardClass}>{className}</Text>
                  </View>
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaRow}>
                  {item.due_date && (
                    <Text style={styles.metaText}>Due {new Date(item.due_date).toLocaleDateString()}</Text>
                  )}
                  <Text style={styles.metaText}>Posted {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>📅</Text>
                      <Text style={styles.detailText}>
                        Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>🕐</Text>
                      <Text style={styles.detailText}>
                        Posted: {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </View>

                    {attachments.length > 0 && (
                      <View style={styles.attachSection}>
                        <Text style={styles.attachLabel}>Attachments</Text>
                        {attachments.map((att) => (
                          <TouchableOpacity
                            key={att.id}
                            style={styles.attachRow}
                            onPress={() => Linking.openURL(att.file_url)}
                          >
                            <Text style={{ fontSize: 16, color: COLORS.primary }}>📄</Text>
                            <Text style={styles.attachLink}>{att.file_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  avatarBtn: { padding: 4 },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  newBtnText: { color: COLORS.textInverse, fontSize: 14, fontWeight: '700' },

  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  formLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  multiline: { minHeight: 100, paddingTop: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1 },

  classPicker: { marginBottom: 4 },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  classChipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  classChipTextActive: { color: COLORS.primary },

  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primaryLight,
    borderRadius: 10,
    backgroundColor: COLORS.primaryBg + '40',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  attachBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  fileList: { marginTop: 8 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    marginBottom: 6,
  },
  fileName: { flex: 1, fontSize: 13, color: COLORS.textSecondary },

  postBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  postBtnText: { color: COLORS.textInverse, fontSize: 15, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textTertiary, fontSize: 15, marginTop: 12 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardClass: { fontSize: 13, color: COLORS.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 12, color: COLORS.textTertiary },

  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  desc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  detailText: { fontSize: 13, color: COLORS.textSecondary },

  attachSection: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  attachLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  attachLink: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
});
