import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  PrimaryButton,
  EmptyState,
  LoadingScreen,
} from '../../lib/components';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Online', 'Cheque'];

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  grade_level: string;
  term: string;
  due_date: string;
  description: string;
  created_at: string;
}

interface FeePayment {
  id: string;
  fee_structure_id: string;
  student_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes: string;
  student_name: string;
}

interface StudentItem {
  id: string;
  full_name: string;
}

export default function FeesScreen() {
  const { profile, user } = useAuth();
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [viewPaymentsVisible, setViewPaymentsVisible] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeStructure | null>(null);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formGradeLevel, setFormGradeLevel] = useState('');
  const [formTerm, setFormTerm] = useState('Term 1');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const [payFeeId, setPayFeeId] = useState<string | null>(null);
  const [payStudentId, setPayStudentId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payReceipt, setPayReceipt] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const schoolId = profile?.school_id;

  const fetchData = useCallback(async () => {
    if (!schoolId) return;

    const [feeRes, studentRes] = await Promise.all([
      supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .order('full_name'),
    ]);

    if (feeRes.data) setFeeStructures(feeRes.data);
    if (studentRes.data) setStudents(studentRes.data);
  }, [schoolId]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const totalDue = feeStructures.reduce((sum, f) => sum + f.amount, 0);

  const openCreateModal = () => {
    setFormName('');
    setFormAmount('');
    setFormGradeLevel('');
    setFormTerm('Term 1');
    setFormDueDate('');
    setFormDescription('');
    setCreateModalVisible(true);
  };

  const handleCreateFee = async () => {
    if (!formName.trim() || !formAmount.trim()) {
      Alert.alert('Missing fields', 'Please enter name and amount.');
      return;
    }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('fee_structures').insert({
        name: formName.trim(),
        amount: Number(formAmount) || 0,
        grade_level: formGradeLevel.trim() || null,
        term: formTerm,
        due_date: formDueDate.trim() || null,
        description: formDescription.trim() || null,
        school_id: schoolId,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setCreateModalVisible(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create fee structure.');
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentModal = (fee: FeeStructure) => {
    setSelectedFee(fee);
    setPayFeeId(fee.id);
    setPayStudentId(null);
    setPayAmount(String(fee.amount));
    setPayMethod('Cash');
    setPayReceipt('');
    setPayNotes('');
    setPaymentModalVisible(true);
  };

  const handleRecordPayment = async () => {
    if (!payStudentId || !payFeeId) {
      Alert.alert('Missing fields', 'Please select a student.');
      return;
    }
    if (!payAmount.trim() || Number(payAmount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!schoolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('fee_payments').insert({
        fee_structure_id: payFeeId,
        student_id: payStudentId,
        amount_paid: Number(payAmount),
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: payMethod,
        receipt_number: payReceipt.trim() || null,
        status: 'paid',
        recorded_by: user?.id ?? null,
        notes: payNotes.trim() || null,
        school_id: schoolId,
      });
      if (error) throw error;
      setPaymentModalVisible(false);
      Alert.alert('Success', 'Payment recorded.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const openViewPayments = async (fee: FeeStructure) => {
    setSelectedFee(fee);
    setPaymentsLoading(true);
    setViewPaymentsVisible(true);

    const { data: paymentData } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('fee_structure_id', fee.id)
      .order('payment_date', { ascending: false });

    if (paymentData) {
      const studentIds = [...new Set(paymentData.map((p) => p.student_id))];
      let studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);
        if (profiles) {
          for (const p of profiles) studentMap[p.id] = p.full_name;
        }
      }
      setFeePayments(
        paymentData.map((p) => ({
          ...p,
          student_name: studentMap[p.student_id] || 'Unknown',
        }))
      );
    } else {
      setFeePayments([]);
    }
    setPaymentsLoading(false);
  };

  const handleDeleteFee = (fee: FeeStructure) => {
    Alert.alert('Delete Fee Structure', `Delete "${fee.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('fee_payments').delete().eq('fee_structure_id', fee.id);
          await supabase.from('fee_structures').delete().eq('id', fee.id);
          fetchData();
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return COLORS.success;
      case 'partial': return COLORS.warning;
      case 'overdue': return COLORS.danger;
      default: return COLORS.textSecondary;
    }
  };

  if (loading) return <LoadingScreen text="Loading fees..." />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <PageHeader
          title="Fees"
          subtitle={`${feeStructures.length} structures`}
          right={<PrimaryButton title="New" icon="+" onPress={openCreateModal} />}
        />

        <View style={styles.statsRow}>
          <StatCard icon="📋" label="Structures" value={feeStructures.length} color={COLORS.primary} />
          <StatCard icon="💰" label="Total Due" value={`$${totalDue.toLocaleString()}`} color={COLORS.warning} />
        </View>

        {feeStructures.length === 0 ? (
          <EmptyState
            icon="💵"
            title="No Fee Structures"
            subtitle="Create fee structures to start managing payments."
            action={{ label: 'Create Fee', onPress: openCreateModal }}
          />
        ) : (
          feeStructures.map((fee) => (
            <Card key={fee.id} style={styles.feeCard}>
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => handleDeleteFee(fee)}
              >
                <View style={styles.feeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeName}>{fee.name}</Text>
                    <Text style={styles.feeMeta}>
                      {fee.term} · Grade {fee.grade_level || 'All'}
                      {fee.due_date ? ` · Due ${fee.due_date}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.feeAmount}>${fee.amount.toLocaleString()}</Text>
                </View>
                {fee.description ? (
                  <Text style={styles.feeDescription}>{fee.description}</Text>
                ) : null}
                <View style={styles.feeActions}>
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => openPaymentModal(fee)}
                  >
                    <Text style={styles.payBtnText}>Record Payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => openViewPayments(fee)}
                  >
                    <Text style={styles.viewBtnText}>View Payments</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Create Fee Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Fee Structure</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Tuition Fee"
              placeholderTextColor={COLORS.textTertiary}
              value={formName}
              onChangeText={setFormName}
              autoFocus
            />

            <Text style={styles.label}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="500"
              placeholderTextColor={COLORS.textTertiary}
              value={formAmount}
              onChangeText={setFormAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Grade Level</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10 (leave blank for all)"
              placeholderTextColor={COLORS.textTertiary}
              value={formGradeLevel}
              onChangeText={setFormGradeLevel}
            />

            <Text style={styles.label}>Term</Text>
            <View style={styles.termRow}>
              {TERMS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.termPill, formTerm === t && styles.termPillActive]}
                  onPress={() => setFormTerm(t)}
                >
                  <Text style={[styles.termPillText, formTerm === t && styles.termPillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Due Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textTertiary}
              value={formDueDate}
              onChangeText={setFormDueDate}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Optional description"
              placeholderTextColor={COLORS.textTertiary}
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateFee}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Record Payment Modal */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPaymentModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            {selectedFee && (
              <Text style={styles.modalSubtitle}>{selectedFee.name} · ${selectedFee.amount}</Text>
            )}

            <Text style={styles.label}>Student</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => {
                if (students.length === 0) {
                  Alert.alert('No students', 'No students found.');
                  return;
                }
                Alert.alert('Select Student', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  ...students.map((s) => ({
                    text: s.full_name,
                    onPress: () => setPayStudentId(s.id),
                  })),
                ]);
              }}
            >
              <Text style={[styles.pickerText, !payStudentId && { color: COLORS.textTertiary }]}>
                {payStudentId
                  ? students.find((s) => s.id === payStudentId)?.full_name || 'Unknown'
                  : 'Tap to select student'}
              </Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Amount Paid ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textTertiary}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.termRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.termPill, payMethod === m && styles.termPillActive]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[styles.termPillText, payMethod === m && styles.termPillTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Receipt Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor={COLORS.textTertiary}
              value={payReceipt}
              onChangeText={setPayReceipt}
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional notes"
              placeholderTextColor={COLORS.textTertiary}
              value={payNotes}
              onChangeText={setPayNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleRecordPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>Record</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Payments Modal */}
      <Modal visible={viewPaymentsVisible} animationType="slide" transparent onRequestClose={() => setViewPaymentsVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setViewPaymentsVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{selectedFee?.name} Payments</Text>

            {paymentsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
            ) : feePayments.length === 0 ? (
              <Text style={styles.emptyText}>No payments recorded yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                {feePayments.map((p) => (
                  <View key={p.id} style={styles.paymentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentName}>{p.student_name}</Text>
                      <Text style={styles.paymentMeta}>
                        {p.payment_date} · {p.payment_method}
                        {p.receipt_number ? ` · #${p.receipt_number}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.paymentAmount}>${p.amount_paid.toLocaleString()}</Text>
                      <Badge text={p.status} color={getStatusColor(p.status)} size="sm" />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setViewPaymentsVisible(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
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
    padding: 20,
  },
  content: {
    paddingBottom: 100,
  },
  statsRow: {
    gap: 12,
    marginBottom: 20,
  },
  feeCard: {
    padding: 16,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  feeName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  feeMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  feeDescription: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 8,
  },
  feeActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  payBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  payBtnText: {
    color: COLORS.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },
  viewBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
  },
  termRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  termPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
  },
  termPillActive: {
    backgroundColor: COLORS.primary,
  },
  termPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  termPillTextActive: {
    color: COLORS.textInverse,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  pickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  pickerChevron: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  paymentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
});
