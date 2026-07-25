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
  school_id: string;
  school?: {
    name: string;
  } | null;
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    role: 'student',
    school_id: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch profiles with school info
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          school_id,
          school:schools(name)
        `)
        .order('full_name');

      // Fetch schools for dropdown
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .order('name');

      if (profilesError) {
        setErrorMsg(profilesError.message);
      } else if (profilesData) {
        const formattedProfiles = profilesData.map(profile => ({
          ...profile,
          school: profile.school ? (Array.isArray(profile.school) ? profile.school[0] : profile.school) : null
        }));
        setProfiles(formattedProfiles);
      }

      if (schoolsError) {
        setErrorMsg(schoolsError.message);
      } else if (schoolsData) {
        setSchools(schoolsData);
      }

    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred fetching data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         profile.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter ? profile.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.school_id) {
      setErrorMsg('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      // Note: In a real app, you would need to create a user in auth.users first
      // For demo purposes, we'll just add to profiles table
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(), // In real app, this would be auth.users.id
          full_name: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
          school_id: newUser.school_id,
        })
        .select(`
          id,
          full_name,
          email,
          role,
          school_id,
          school:schools(id, name)
        `)
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setProfiles(prev => [...prev, {
          ...data,
          school: data.school ? (Array.isArray(data.school) ? data.school[0] : data.school) : null
        }]);
        
        // Reset form
        setNewUser({
          full_name: '',
          email: '',
          role: 'student',
          school_id: ''
        });
        setShowAddModal(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred adding user');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return COLORS.danger;
      case 'teacher':
        return COLORS.primary;
      case 'student':
        return COLORS.success;
      case 'parent':
        return COLORS.textSecondary;
      default:
        return COLORS.text;
    }
  };

  const getRoleDisplay = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>User Management</Text>

      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <View style={styles.roleFilterContainer}>
          <TouchableOpacity
            style={[styles.roleFilterButton, !roleFilter && styles.roleFilterButtonActive]}
            onPress={() => setRoleFilter(null)}
          >
            <Text style={[styles.roleFilterText, !roleFilter && styles.roleFilterTextActive]}>All</Text>
          </TouchableOpacity>
          
          {['admin', 'teacher', 'student', 'parent'].map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.roleFilterButton, roleFilter === role && styles.roleFilterButtonActive]}
              onPress={() => setRoleFilter(roleFilter === role ? null : role)}
            >
              <Text style={[styles.roleFilterText, roleFilter === role && styles.roleFilterTextActive]}>
                {getRoleDisplay(role)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>Add User</Text>
      </TouchableOpacity>

      {showAddModal && (
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New User</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Full Name"
                value={newUser.full_name}
                onChangeText={(text) => setNewUser(prev => ({ ...prev, full_name: text }))}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Email"
                value={newUser.email}
                onChangeText={(text) => setNewUser(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
              />
              
              <View style={styles.modalSelectContainer}>
                <Text style={styles.modalLabel}>Role:</Text>
                <View style={styles.roleSelector}>
                  {['admin', 'teacher', 'student', 'parent'].map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleOption, newUser.role === role && styles.roleOptionSelected]}
                      onPress={() => setNewUser(prev => ({ ...prev, role }))}
                    >
                      <Text style={[styles.roleOptionText, newUser.role === role && styles.roleOptionTextSelected]}>
                        {getRoleDisplay(role)}
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
                      style={[styles.schoolOption, newUser.school_id === school.id && styles.schoolOptionSelected]}
                      onPress={() => setNewUser(prev => ({ ...prev, school_id: school.id }))}
                    >
                      <Text style={[styles.schoolOptionText, newUser.school_id === school.id && styles.schoolOptionTextSelected]}>
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
                  onPress={handleAddUser}
                  disabled={loading}
                >
                  <Text style={styles.modalButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {loading && profiles.length === 0 ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProfiles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProfiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.full_name}</Text>
              <Text style={styles.cardText}>Email: {item.email}</Text>
              <Text style={styles.cardText}>School: {item.school?.name || 'Unknown'}</Text>
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
                <Text style={styles.roleBadgeText}>{getRoleDisplay(item.role)}</Text>
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
    marginBottom: 20,
  },
  filtersContainer: {
    marginBottom: 20,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: 12,
  },
  roleFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleFilterText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  roleFilterTextActive: {
    color: COLORS.surface,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  modalSelectContainer: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleOptionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  roleOptionTextSelected: {
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
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleBadgeText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 12,
  },
});