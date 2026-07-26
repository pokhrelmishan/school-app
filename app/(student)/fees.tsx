import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import {
  ScreenHeader,
  NotebookCard,
  Badge,
  EmptyState,
  LoadingScreen,
  SectionHeader,
} from '../../lib/components';

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
}

export default function StudentFeesScreen() {
  const { user, profile } = useAuth();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.id || !profile?.school_id) return;
    if (!isRefresh) setLoading(true);

    const [structRes, payRes] = await Promise.all([
      supabase
        .from('fee_structures')
        .select('id, name, amount, grade_level, term, due_date, description')
        .eq('school_id', profile.school_id)
        .order('due_date', { ascending: true }),
      supabase
        .from('fee_payments')
        .select('id, fee_structure_id, student_id, amount_paid, payment_date, payment_method, receipt_number, status')
        .eq('student_id', user.id)
        .order('payment_date', { ascending: false }),
    ]);

    if (structRes.data) setStructures(structRes.data);
    if (payRes.data) setPayments(payRes.data);
    setLoading(false);
  }, [user?.id, profile?.school_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const statusColor = (s: string) => {
    if (s === 'paid') return COLORS.chalk;
    if (s === 'partial') return COLORS.pencil;
    if (s === 'overdue') return COLORS.danger;
    return COLORS.graphite;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <LoadingScreen text="Loading fees..." />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.tape}
          colors={[COLORS.tape]}
        />
      }
    >
      <ScreenHeader title="Fees" />

      <View style={styles.body}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { borderLeftColor: COLORS.ink }]}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>${totalFees}</Text>
          </View>
          <View style={[styles.summaryItem, { borderLeftColor: COLORS.chalk }]}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, { color: COLORS.chalk }]}>${totalPaid}</Text>
          </View>
          <View style={[styles.summaryItem, { borderLeftColor: COLORS.pencil }]}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: COLORS.pencil }]}>${totalPending}</Text>
          </View>
        </View>

        <SectionHeader title="Fee Breakdown" />

        {structures.length === 0 ? (
          <NotebookCard>
            <EmptyState icon="💰" title="No fees found" subtitle="No fee structures for your grade" />
          </NotebookCard>
        ) : (
          structures.map((struct) => {
            const { status, paid } = getPaymentStatus(struct.id);
            const remaining = struct.amount - paid;
            const overdue =
              status === 'pending' && new Date(struct.due_date) < new Date();
            const displayStatus = overdue ? 'overdue' : status;

            return (
              <NotebookCard key={struct.id}>
                <View style={styles.feeTop}>
                  <View style={styles.feeInfo}>
                    <Text style={styles.feeName}>{struct.name}</Text>
                    <Text style={styles.feeMeta}>
                      {struct.term} · {struct.grade_level}
                    </Text>
                  </View>
                  <Badge
                    text={displayStatus}
                    color={statusColor(displayStatus)}
                    size="md"
                  />
                </View>

                {struct.description ? (
                  <Text style={styles.feeDesc}>{struct.description}</Text>
                ) : null}

                <View style={styles.amountRow}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={styles.amountValue}>${struct.amount}</Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Paid</Text>
                    <Text style={[styles.amountValue, { color: paid > 0 ? COLORS.chalk : COLORS.graphite }]}>
                      ${paid}
                    </Text>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>Remaining</Text>
                    <Text style={[styles.amountValue, { color: remaining > 0 ? COLORS.danger : COLORS.chalk }]}>
                      ${remaining > 0 ? remaining : 0}
                    </Text>
                  </View>
                </View>

                {struct.amount > 0 && (
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min((paid / struct.amount) * 100, 100)}%`,
                          backgroundColor:
                            status === 'paid' ? COLORS.chalk : COLORS.tape,
                        },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.feeFooter}>
                  <Text style={styles.feeDate}>Due: {formatDate(struct.due_date)}</Text>
                  {payments.filter((p) => p.fee_structure_id === struct.id).length > 0 && (
                    <Text style={styles.feeReceipt}>
                      Receipt: {payments.filter((p) => p.fee_structure_id === struct.id)[0].receipt_number || '—'}
                    </Text>
                  )}
                </View>
              </NotebookCard>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  body: {
    padding: 20,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },

  feeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeInfo: {
    flex: 1,
  },
  feeName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  feeMeta: {
    fontSize: 13,
    color: COLORS.graphite,
  },
  feeDesc: {
    fontSize: 13,
    color: COLORS.graphiteLight,
    marginBottom: 10,
    lineHeight: 18,
  },

  amountRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperDim,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  amountCol: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.graphite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },

  progressBar: {
    height: 5,
    backgroundColor: COLORS.paperDim,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  feeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeDate: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
  feeReceipt: {
    fontSize: 12,
    color: COLORS.graphiteLight,
  },
});
