import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string;
  role: 'class_teacher' | 'subject';
  subject_name?: string;
}

export default function TeacherClassesScreen() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const classTeacherRes = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('teacher_id', user.id);

      const subjectRes = await supabase
        .from('teacher_subjects')
        .select('class_id, classes(id, name, grade_level), subjects(name)')
        .eq('teacher_id', user.id);

      const classTeacherIds = new Set<string>();
      const merged: ClassItem[] = [];

      if (classTeacherRes.data) {
        for (const c of classTeacherRes.data) {
          classTeacherIds.add(c.id);
          merged.push({
            id: c.id,
            name: c.name,
            grade_level: c.grade_level,
            role: 'class_teacher',
          });
        }
      }

      if (subjectRes.data) {
        for (const s of subjectRes.data) {
          const classInfo = s.classes as any;
          const subjectInfo = s.subjects as any;
          if (!classInfo) continue;
          if (!classTeacherIds.has(s.class_id)) {
            classTeacherIds.add(s.class_id);
            merged.push({
              id: classInfo.id,
              name: classInfo.name,
              grade_level: classInfo.grade_level,
              role: 'subject',
              subject_name: subjectInfo?.name,
            });
          } else {
            const existing = merged.find((m) => m.id === s.class_id);
            if (existing) {
              existing.subject_name = subjectInfo?.name;
            }
          }
        }
      }

      setClasses(merged);
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = () => {
    router.push('/(teacher)/profile' as any);
  };

  const renderItem = ({ item }: { item: ClassItem }) => {
    const isClassTeacher = item.role === 'class_teacher';
    const accentColor = isClassTeacher ? COLORS.primary : COLORS.success;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/(teacher)/class/${item.id}` as any)}
      >
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.className}>{item.name}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: isClassTeacher ? COLORS.primary + '18' : COLORS.success + '18' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isClassTeacher ? COLORS.primary : COLORS.success },
                ]}
              >
                {isClassTeacher ? 'Class Teacher' : `Subject: ${item.subject_name}`}
              </Text>
            </View>
          </View>
          <Text style={styles.gradeLevel}>Grade {item.grade_level}</Text>
        </View>
        <Text style={[styles.chevron, { color: COLORS.textSecondary || '#888', fontSize: 20 }]}>➡️</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Classes</Text>
        <TouchableOpacity onPress={handleProfilePress} style={styles.avatarBtn}>
          <Text style={{ fontSize: 32, color: COLORS.primary }}>👤</Text>
        </TouchableOpacity>
      </View>

      {classes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 64, color: COLORS.textSecondary || '#bbb' }}>📚</Text>
          <Text style={styles.emptyTitle}>No Classes Found</Text>
          <Text style={styles.emptySubtitle}>
            You are not associated with any classes yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text || '#1a1a2e',
  },
  avatarBtn: {
    padding: 4,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  accent: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  className: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text || '#1a1a2e',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gradeLevel: {
    fontSize: 13,
    color: COLORS.textSecondary || '#888',
    marginTop: 4,
  },
  chevron: {
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text || '#1a1a2e',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary || '#888',
    marginTop: 8,
    textAlign: 'center',
  },
});
