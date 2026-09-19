'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, Clock, CreditCard, Wrench, ArrowRight } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Monthly Rent Due: September 2026',
      message: 'Your monthly rent of ₹18,000 for Nexus Heights (Room 101) is due.',
      type: 'RENT_DUE',
      isRead: false,
      date: '2 hours ago',
      link: '/payments',
    },
    {
      id: 'notif-2',
      title: 'Technician Assigned for Maintenance',
      message: 'CoolCare Services has been dispatched for your AC repair request.',
      type: 'MAINTENANCE_UPDATE',
      isRead: false,
      date: '1 day ago',
      link: '/maintenance',
    },
    {
      id: 'notif-3',
      title: 'Payment Received & Verified',
      message: 'Payment of ₹18,000 for August 2026 was confirmed via Paytm adapter.',
      type: 'PAYMENT_RECEIVED',
      isRead: true,
      date: '2 weeks ago',
      link: '/payments',
    },
  ]);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Notification Center</Badge>
            <span className="text-xs text-slate-400">Real-time alerts</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Notifications</h1>
          <p className="text-xs text-slate-400">
            Lifecycle updates, payment receipts, and maintenance notifications
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={markAllAsRead}
          className="text-xs border-slate-800 hover:bg-slate-900"
        >
          Mark all as read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.map((notif) => (
          <Card
            key={notif.id}
            className={`border-slate-800 transition-all ${
              notif.isRead ? 'bg-slate-900/40 opacity-80' : 'bg-slate-900/80 border-indigo-500/30 shadow-lg'
            }`}
          >
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'RENT_DUE'
                      ? 'bg-amber-500/15 text-amber-400'
                      : notif.type === 'PAYMENT_RECEIVED'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-indigo-500/15 text-indigo-400'
                  }`}
                >
                  {notif.type === 'RENT_DUE' && <Clock className="h-4 w-4" />}
                  {notif.type === 'PAYMENT_RECEIVED' && <CreditCard className="h-4 w-4" />}
                  {notif.type === 'MAINTENANCE_UPDATE' && <Wrench className="h-4 w-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{notif.title}</h4>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{notif.message}</p>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {notif.date}
                  </span>
                </div>
              </div>

              {notif.link && (
                <Link href={notif.link}>
                  <Button variant="ghost" size="sm" className="text-xs text-indigo-400 gap-1">
                    <span>View</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
