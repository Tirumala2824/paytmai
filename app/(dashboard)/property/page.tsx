'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, ArrowUpRight, BedDouble, Users, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function PropertyListPage() {
  const properties = [
    {
      id: 'prop-nexus-koramangala',
      name: 'Nexus Heights Luxury PG',
      address: '42, 5th Block, 80 Feet Road, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      type: 'PG',
      totalRooms: 6,
      occupiedRooms: 4,
      amenities: ['High-speed WiFi', 'Power Backup', 'Daily Housekeeping', 'Gym', 'Meals Included'],
      rooms: [
        { number: '101', type: 'SINGLE', rent: 18000, occupied: true, tenant: 'Arjun Mehta' },
        { number: '102', type: 'DOUBLE', rent: 12000, occupied: false, tenant: null },
        { number: '201', type: 'SINGLE', rent: 19500, occupied: false, tenant: null },
      ],
    },
    {
      id: 'prop-nexus-indiranagar',
      name: 'Nexus Studio Suites Indiranagar',
      address: '108, 12th Main Road, HAL 2nd Stage, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      type: 'COLIVING',
      totalRooms: 4,
      occupiedRooms: 3,
      amenities: ['Private Balcony', 'Dedicated Workspace', 'AC', 'Washing Machine', 'Smart TV'],
      rooms: [
        { number: '301', type: 'SUITE', rent: 26000, occupied: true, tenant: 'Sneha Rao' },
        { number: '302', type: 'SUITE', rent: 26000, occupied: false, tenant: null },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Asset Portfolio</Badge>
            <span className="text-xs text-slate-400">Properties & Inventory</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Properties & Rooms</h1>
          <p className="text-xs text-slate-400">
            Configure rooms, rent rates, security deposits, and amenities
          </p>
        </div>

        <Button size="sm" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500">
          <Plus className="h-3.5 w-3.5" />
          Add New Property
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {properties.map((prop) => (
          <Card key={prop.id} className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {prop.type}
                  </span>
                  <Badge variant="secondary">{prop.city}</Badge>
                </div>
                <CardTitle className="text-lg text-white mt-1">{prop.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  {prop.address}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block">Occupancy</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {prop.occupiedRooms} / {prop.totalRooms} Units
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Amenities */}
              <div className="flex flex-wrap gap-1.5">
                {prop.amenities.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                  >
                    {a}
                  </span>
                ))}
              </div>

              {/* Room Grid */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Rooms & Occupancy
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {prop.rooms.map((room) => (
                    <div
                      key={room.number}
                      className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">Room {room.number}</span>
                          <span className="text-[10px] text-slate-400">({room.type})</span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {formatCurrency(room.rent)} / mo
                        </p>
                      </div>

                      {room.occupied ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {room.tenant}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Vacant
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 text-xs flex justify-between border-t border-slate-800/80">
              <span className="text-slate-500">Managed by Rajesh Sharma</span>
              <Link
                href={`/property/${prop.id}`}
                className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Manage Inventory <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
