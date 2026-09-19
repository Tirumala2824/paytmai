'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaymentStatus } from '@prisma/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditCard, CheckCircle2, Clock, ArrowUpRight, Download, ShieldCheck, Sparkles } from 'lucide-react';

export default function PaymentsPage() {
  const [paying, setPaying] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [schedules, setSchedules] = useState([
    {
      id: 'sched-1',
      billingMonth: '2026-09',
      dueDate: '2026-09-05',
      amount: 18000,
      status: PaymentStatus.PENDING,
      property: 'Nexus Heights Luxury PG (Room 101)',
    },
    {
      id: 'sched-2',
      billingMonth: '2026-08',
      dueDate: '2026-08-05',
      amount: 18000,
      status: PaymentStatus.SUCCESS,
      property: 'Nexus Heights Luxury PG (Room 101)',
      payment: {
        method: 'PAYTM',
        transactionRef: 'TXN_PAYTM_98234710',
        paidAt: '2026-08-04',
      },
    },
    {
      id: 'sched-3',
      billingMonth: '2026-07',
      dueDate: '2026-07-05',
      amount: 18000,
      status: PaymentStatus.SUCCESS,
      property: 'Nexus Heights Luxury PG (Room 101)',
      payment: {
        method: 'UPI',
        transactionRef: 'TXN_UPI_54198231',
        paidAt: '2026-07-05',
      },
    },
  ]);

  const handlePay = async (schedId: string, amount: number) => {
    setPaying(true);
    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentScheduleId: schedId,
          amount,
          paymentMethod: 'PAYTM',
        }),
      });

      const data = await res.json();

      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedId
            ? {
                ...s,
                status: PaymentStatus.SUCCESS,
                payment: {
                  method: 'PAYTM',
                  transactionRef: data.payment?.transactionRef || `TXN_${Date.now()}`,
                  paidAt: new Date().toISOString(),
                },
              }
            : s
        )
      );

      setSuccessNotice(
        `Rent payment of ${formatCurrency(amount)} processed successfully via Paytm adapter! Transaction ref: ${data.payment?.transactionRef || 'OK'}`
      );
    } catch (err: any) {
      alert('Payment failed: ' + err.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rent &amp; Payments</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            All your payments, in one place
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
          <CheckCircle2 className="h-4 w-4" />
          <span>Payments secured</span>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Total Paid</span>
          <div className="text-2xl font-bold text-white mt-1">{formatCurrency(36000)}</div>
          <span className="text-[11px] text-emerald-400 mt-1 block">2 months cleared ✓</span>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Amount Due Now</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(18000)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Due for Sep 2026</span>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Security Deposit</span>
          <div className="text-2xl font-bold text-white mt-1">{formatCurrency(36000)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Protected &amp; held safely</span>
        </Card>
      </div>

      {/* Rent Schedules & Payment Invoices */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Rent Schedule & Transactions</CardTitle>
          <CardDescription className="text-xs">
            Complete schedule of monthly rent obligations and transaction logs
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3">Billing Cycle</th>
                  <th className="pb-3">Due Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Transaction Ref</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40">
                    <td className="py-3 font-semibold text-white">
                      {s.billingMonth}
                    </td>
                    <td className="py-3 text-slate-300">
                      {formatDate(s.dueDate)}
                    </td>
                    <td className="py-3 font-bold text-white">
                      {formatCurrency(s.amount)}
                    </td>
                    <td className="py-3">
                      {s.status === PaymentStatus.SUCCESS ? (
                        <Badge variant="success">PAID</Badge>
                      ) : (
                        <Badge variant="warning">PENDING</Badge>
                      )}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-400">
                      {s.payment?.transactionRef || '—'}
                    </td>
                    <td className="py-3 text-right">
                      {s.status === PaymentStatus.PENDING ? (
                        <Button
                          size="sm"
                          disabled={paying}
                          onClick={() => handlePay(s.id, s.amount)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-xs h-8 gap-1.5"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          {paying ? 'Processing...' : 'Pay via Paytm'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-8 text-indigo-400 hover:text-indigo-300"
                          onClick={() => alert(`Receipt for ${s.billingMonth} downloaded.`)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Receipt
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
