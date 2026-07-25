import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { PageHeader, StatCard, Card, Badge, EmptyState, LoadingScreen, SectionHeader } from '../../lib/components';

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  grade_level: string;
  term: string;
  due_date: string;
  description: string;
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
}

export default function StudentFeesScreen() {
  const { user, profile } = useAuth();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!user?.id || !profile?.school_id) return;
    if (!isRefresh) setLoading(true);

    const gradeLevel = profile?.grade_level || profile?.role;

    const [structRes, payRes] = await Promise.all([
      supabase
        .from('fee_structures')
        .select('id, name, amount, grade_level, term, due_date, description')
        .eq('school_id', profile.school_id)
        .order('due_date', { ascending: true }),
      supabase
        .from('fee_payments')
        .select('id, fee_structure_id, student_id, amount_paid, payment_date, payment_method, receipt_number, status, notes')
        .eq('student_id', user.id)
        .order('payment_date', { ascending: false }),
    ]);

    if (structRes.data) setStructures(structRes.data);
    if (payRes.data) setPayments(payRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, profile?.school_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const paymentMap = new Map<string, FeePayment[]>();
  payments.forEach((p) => {
    const list = paymentMap.get(p.fee_structure_id) || [];
    list.push(p);
    paymentMap.set(p.fee_structure_id, list);
  });

  const getPaymentStatus = (structId: string) => {
    const pays = paymentMap.get(structId) || [];
    if (pays.length === 0) return { status: 'pending' as const, paid: 0 };
    const totalPaid = pays.reduce((sum, p) => sum + p.amount_paid, 0);
    const latest = pays[0];
    return { status: latest.status, paid: totalPaid };
  };

  const totalFees = structures.reduce((sum, s) => sum + s.amount, 0);
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const totalPending = totalFees - totalPaid;
  const overdueCount = payments.filter((p) => p.status === 'overdue').length +
    structures.filter((s) => {
      const pays = paymentMap.get(s.id) || [];
      return pays.length === 0 && new Date(s.due_date) < new Date();
    }).length;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const statusColor = (s: string) => {
    if (s === 'paid') return COLORS.success;
    if (s === 'partial') return COLORS.warning;
    if (s === 'overdue') return COLORS.danger;
    return COLORS.textSecondary;
  };

  const statusBg = (s: string) => {
    if (s === 'paid') return COLORS.successBg;
    if (s === 'partial') return COLORS.warningBg;
    if (s === 'overdue') return COLORS.dangerBg;
    return COLORS.surfaceAlt;
  };

  if (loading) return <LoadingScreen text="Loading fees..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
    >
      <PageHeader title="Fees" subtitle={`${structures.length} fee items`} />

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <StatCard icon="💰" label="Total Fees" value={`$${totalFees}`} color={COLORS.primary} />
        </View>
        <View style={styles.statCol}>
          <StatCard icon="✅" label="Paid" value={`$${totalPaid}`} color={COLORS.success} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <StatCard icon="⏳" label="Pending" value={`$${totalPending}`} color={COLORS.warning} />
        </View>
        <View style={styles.statCol}>
          <StatCard icon="🚨" label="Overdue" value={overdueCount} color={COLORS.danger} />
        </View>
      </View>

      <SectionHeader title="Fee Breakdown" />

      {structures.length === 0 ? (
        <EmptyState icon="💰" title="No fees found" subtitle="No fee structures for your grade" />
      ) : (
        structures.map((struct) => {
          const { status, paid } = getPaymentStatus(struct.id);
          const remaining = struct.amount - paid;
          const overdue = status === 'pending' && new Date(struct.due_date) < new Date();

          return (
            <Card key={struct.id} style={styles.feeCard}>
              <View style={styles.feeTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeName}>{struct.name}</Text>
                  <Text style={styles.feeMeta}>{struct.term} · {struct.grade_level}</Text>
                </View>
                <Badge
                  text={overdue ? 'overdue' : status}
                  color={overdue ? COLORS.danger : statusColor(status)}
                  size="md"
                />
              </View>

              {struct.description ? (
                <Text style={styles.feeDesc}>{struct.description}</Text>
              ) : null}

              <View style={styles.feeAmountRow}>
                <View style={styles.feeAmountCol}>
                  <Text style={styles.feeAmountLabel}>Amount</Text>
                  <Text style={styles.feeAmountValue}>${struct.amount}</Text>
                </View>
                <View style={styles.feeAmountCol}>
                  <Text style={styles.feeAmountLabel}>Paid</Text>
                  <Text style={[styles.feeAmountValue, { color: paid > 0 ? COLORS.success : COLORS.textSecondary }]}>${paid}</Text>
                </View>
                <View style={styles.feeAmountCol}>
                  <Text style={styles.feeAmountLabel}>Remaining</Text>
                  <Text style={[styles.feeAmountValue, { color: remaining > 0 ? COLORS.danger : COLORS.success }]}>${remaining > 0 ? remaining : 0}</Text>
                </View>
              </View>

              {struct.amount > 0 && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((paid / struct.amount) * 100, 100)}%`,
                        backgroundColor: status === 'paid' ? COLORS.success : COLORS.primary,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={styles.feeFooter}>
                <Text style={styles.feeDate}>Due: {formatDate(struct.due_date)}</Text>
                {payments.filter((p) => p.fee_structure_id === struct.id).length > 0 && (
                  <Text style={styles.feeReceipt}>
                    Last: {payments.filter((p) => p.fee_structure_id === struct.id)[0].receipt_number || '—'}
                  </Text>
                )}
              </View>
            </Card>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCol: { flex: 1 },

  feeCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  feeTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  feeName: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  feeMeta: { fontSize: 13, color: COLORS.textSecondary },
  feeDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 18 },

  feeAmountRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 10,
  },
  feeAmountCol: { flex: 1, alignItems: 'center' },
  feeAmountLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  feeAmountValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  progressBar: {
    height: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  feeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeDate: { fontSize: 12, color: COLORS.textTertiary },
  feeReceipt: { fontSize: 12, color: COLORS.textTertiary },
});
