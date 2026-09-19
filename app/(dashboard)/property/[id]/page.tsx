'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Users, BedDouble, Plus, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function PropertyDetailPage() {
  const params = useParams();

  const property = {
    id: params.id as string,
    name: 'Nexus Heights Luxury PG',
    address: '42, 5th Block, 80 Feet Road, Koramangala, Bengaluru',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560095',
    type: 'PG',
    totalRooms: 6,
    occupiedRooms: 4,
    rooms: [
      { id: 'r-101', roomNumber: '101', floor: 1, type: 'SINGLE', rent: 18000, deposit: 36000, isOccupied: true, tenant: 'Arjun Mehta' },
      { id: 'r-102', roomNumber: '102', floor: 1, type: 'DOUBLE', rent: 12000, deposit: 24000, isOccupied: false, tenant: null },
      { id: 'r-201', roomNumber: '201', floor: 2, type: 'SINGLE', rent: 19500, deposit: 39000, isOccupied: false, tenant: null },
      { id: 'r-202', roomNumber: '202', floor: 2, type: 'DOUBLE', rent: 13000, deposit: 26000, isOccupied: true, tenant: 'Vikram Seth' },
      { id: 'r-301', roomNumber: '301', floor: 3, type: 'SINGLE', rent: 20000, deposit: 40000, isOccupied: true, tenant: 'Karan Joshi' },
      { id: 'r-302', roomNumber: '302', floor: 3, type: 'SINGLE', rent: 20000, deposit: 40000, isOccupied: true, tenant: 'Nikhil Roy' },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/property">
          <Button variant="outline" size="icon" className="h-8 w-8 border-slate-800">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{property.type}</Badge>
            <span className="text-xs text-slate-400">{property.city}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-0.5">{property.name}</h1>
          <p className="text-xs text-slate-400">{property.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Total Rooms</span>
          <div className="text-2xl font-bold text-white mt-1">{property.totalRooms}</div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Occupied Units</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {property.occupiedRooms} / {property.totalRooms}
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400">Monthly Potential</span>
          <div className="text-2xl font-bold text-white mt-1">{formatCurrency(102500)}</div>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-white">Room Inventory</CardTitle>
            <CardDescription className="text-xs">
              Room configurations, rates and current occupancy
            </CardDescription>
          </div>
          <Button size="sm" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-3.5 w-3.5" />
            Add Room
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3">Room #</th>
                  <th className="pb-3">Floor</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Monthly Rent</th>
                  <th className="pb-3">Deposit</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Current Tenant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {property.rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-900/40">
                    <td className="py-3 font-bold text-white">Room {room.roomNumber}</td>
                    <td className="py-3 text-slate-400">Floor {room.floor}</td>
                    <td className="py-3 text-slate-300">{room.type}</td>
                    <td className="py-3 font-semibold text-white">
                      {formatCurrency(room.rent)}
                    </td>
                    <td className="py-3 text-slate-400">{formatCurrency(room.deposit)}</td>
                    <td className="py-3">
                      {room.isOccupied ? (
                        <Badge variant="default">Occupied</Badge>
                      ) : (
                        <Badge variant="success">Vacant</Badge>
                      )}
                    </td>
                    <td className="py-3 text-slate-200">
                      {room.tenant || <span className="text-slate-500 italic">None</span>}
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
