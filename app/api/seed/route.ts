import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  UserRole,
  RentalLifecycle,
  MaintenanceStatus,
  PaymentStatus,
} from '@prisma/client';

export async function POST() {
  try {
    // Clean existing records in reverse dependency order
    await prisma.auditEvent.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.agentAction.deleteMany();
    await prisma.agentSession.deleteMany();
    await prisma.maintenanceTask.deleteMany();
    await prisma.maintenanceIssue.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.rentSchedule.deleteMany();
    await prisma.tenancy.deleteMany();
    await prisma.room.deleteMany();
    await prisma.property.deleteMany();
    await prisma.owner.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.userProfile.deleteMany();

    // 1. Create Owners
    const owner1 = await prisma.userProfile.create({
      data: {
        authUserId: 'owner-auth-id-001',
        email: 'rajesh@nexusliving.in',
        name: 'Rajesh Sharma',
        phone: '+91 98765 43210',
        role: UserRole.OWNER,
        owner: {
          create: {
            companyName: 'Nexus Living Spaces LLP',
            taxId: '29AAAAA0000A1Z5',
            bankAccountDetails: 'HDFC Bank - A/C: 50100234567890 (IFSC: HDFC0000123)',
          },
        },
      },
      include: { owner: true },
    });

    const owner2 = await prisma.userProfile.create({
      data: {
        authUserId: 'owner-auth-id-002',
        email: 'priya@urbannest.in',
        name: 'Priya Patel',
        phone: '+91 98111 22334',
        role: UserRole.OWNER,
        owner: {
          create: {
            companyName: 'UrbanNest Coliving Ventures',
            taxId: '29BBBBB1111B2Z6',
            bankAccountDetails: 'ICICI Bank - A/C: 000405001234 (IFSC: ICIC0000004)',
          },
        },
      },
      include: { owner: true },
    });

    // 2. Create Tenants
    const tenant1 = await prisma.userProfile.create({
      data: {
        authUserId: 'tenant-auth-id-001',
        email: 'arjun.mehta@gmail.com',
        name: 'Arjun Mehta',
        phone: '+91 99887 76655',
        role: UserRole.TENANT,
        tenant: {
          create: {
            emergencyContact: 'Suresh Mehta (Father): +91 99887 76600',
            idProofType: 'AADHAAR',
            idProofNumber: 'XXXX-XXXX-4589',
          },
        },
      },
      include: { tenant: true },
    });

    const tenant2 = await prisma.userProfile.create({
      data: {
        authUserId: 'tenant-auth-id-002',
        email: 'sneha.rao@gmail.com',
        name: 'Sneha Rao',
        phone: '+91 97654 32109',
        role: UserRole.TENANT,
        tenant: {
          create: {
            emergencyContact: 'Kavita Rao (Mother): +91 97654 32100',
            idProofType: 'PASSPORT',
            idProofNumber: 'Z8942103',
          },
        },
      },
      include: { tenant: true },
    });

    const tenant3 = await prisma.userProfile.create({
      data: {
        authUserId: 'tenant-auth-id-003',
        email: 'rohan.gupta@outlook.com',
        name: 'Rohan Gupta',
        phone: '+91 96543 21098',
        role: UserRole.TENANT,
        tenant: {
          create: {
            emergencyContact: 'Anita Gupta (Sister): +91 96543 21000',
            idProofType: 'PAN',
            idProofNumber: 'ABCDE1234F',
          },
        },
      },
      include: { tenant: true },
    });

    // 3. Properties
    const prop1 = await prisma.property.create({
      data: {
        ownerId: owner1.owner!.id,
        name: 'Nexus Heights Luxury PG',
        address: '42, 5th Block, 80 Feet Road, Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560095',
        propertyType: 'PG',
        description: 'Premium coliving and PG with high-speed WiFi, gym, daily meals, and 24/7 security.',
        totalRooms: 6,
        amenities: ['High-speed WiFi', 'Power Backup', 'Daily Housekeeping', 'Gym', 'Meals Included', 'Biometric Entry'],
      },
    });

    const prop2 = await prisma.property.create({
      data: {
        ownerId: owner1.owner!.id,
        name: 'Nexus Studio Suites Indiranagar',
        address: '108, 12th Main Road, HAL 2nd Stage, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560038',
        propertyType: 'COLIVING',
        description: 'Executive furnished studio suites for professionals with private balconies.',
        totalRooms: 4,
        amenities: ['Private Balcony', 'Dedicated Workspace', 'AC', 'Washing Machine', 'Smart TV'],
      },
    });

    const prop3 = await prisma.property.create({
      data: {
        ownerId: owner2.owner!.id,
        name: 'UrbanNest HSR Haven',
        address: '27th Main, Sector 1, HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560102',
        propertyType: 'APARTMENT',
        description: 'Boutique shared apartments designed for tech founders and creators.',
        totalRooms: 5,
        amenities: ['High-speed Fiber', 'Gaming Zone', 'EV Charging', 'Weekly Community Dinners'],
      },
    });

    // 4. Rooms
    const r101 = await prisma.room.create({
      data: {
        propertyId: prop1.id,
        roomNumber: '101',
        floor: 1,
        roomType: 'SINGLE',
        rentAmount: 18000,
        depositAmount: 36000,
        isOccupied: true,
      },
    });

    const r301 = await prisma.room.create({
      data: {
        propertyId: prop2.id,
        roomNumber: '301',
        floor: 3,
        roomType: 'SUITE',
        rentAmount: 26000,
        depositAmount: 52000,
        isOccupied: true,
      },
    });

    const rA101 = await prisma.room.create({
      data: {
        propertyId: prop3.id,
        roomNumber: 'A-101',
        floor: 1,
        roomType: 'SINGLE',
        rentAmount: 22000,
        depositAmount: 44000,
        isOccupied: true,
      },
    });

    // 5. Tenancies with Distinct Lifecycle Stages
    const t1 = await prisma.tenancy.create({
      data: {
        tenantId: tenant1.tenant!.id,
        roomId: r101.id,
        propertyId: prop1.id,
        startDate: new Date('2026-01-01'),
        monthlyRent: 18000,
        securityDeposit: 36000,
        lifecycleStage: RentalLifecycle.RENT_DUE,
        isActive: true,
      },
    });

    const t2 = await prisma.tenancy.create({
      data: {
        tenantId: tenant2.tenant!.id,
        roomId: r301.id,
        propertyId: prop2.id,
        startDate: new Date('2026-03-01'),
        monthlyRent: 26000,
        securityDeposit: 52000,
        lifecycleStage: RentalLifecycle.ISSUE,
        isActive: true,
      },
    });

    const t3 = await prisma.tenancy.create({
      data: {
        tenantId: tenant3.tenant!.id,
        roomId: rA101.id,
        propertyId: prop3.id,
        startDate: new Date('2026-05-01'),
        monthlyRent: 22000,
        securityDeposit: 44000,
        lifecycleStage: RentalLifecycle.VERIFIED,
        isActive: true,
      },
    });

    // 6. Rent Schedules & Payments
    const t1Sched = await prisma.rentSchedule.create({
      data: {
        tenancyId: t1.id,
        dueDate: new Date('2026-09-05'),
        amount: 18000,
        billingMonth: '2026-09',
        status: PaymentStatus.PENDING,
      },
    });

    const t2Sched = await prisma.rentSchedule.create({
      data: {
        tenancyId: t2.id,
        dueDate: new Date('2026-09-05'),
        amount: 26000,
        billingMonth: '2026-09',
        status: PaymentStatus.SUCCESS,
      },
    });

    await prisma.payment.create({
      data: {
        rentScheduleId: t2Sched.id,
        amount: 26000,
        currency: 'INR',
        status: PaymentStatus.SUCCESS,
        paymentMethod: 'PAYTM',
        transactionRef: 'TXN_PAYTM_98234710',
        paidAt: new Date('2026-09-02'),
      },
    });

    // 7. Maintenance
    const issue1 = await prisma.maintenanceIssue.create({
      data: {
        tenancyId: t2.id,
        propertyId: prop2.id,
        reportedById: tenant2.tenant!.id,
        title: 'AC leaking water and cooling insufficient',
        description: 'Daikin 1.5T AC unit has water leaking onto the desk and low cooling.',
        category: 'APPLIANCE',
        priority: 'HIGH',
        status: MaintenanceStatus.IN_PROGRESS,
      },
    });

    await prisma.maintenanceTask.create({
      data: {
        issueId: issue1.id,
        title: 'AC Drain Pipe Clearing & Filter Service',
        assignedTo: 'CoolCare Services (Ramesh: +91 98450 11223)',
        estimatedCost: 1500,
        status: MaintenanceStatus.IN_PROGRESS,
      },
    });

    // 8. Audit Events
    await prisma.auditEvent.create({
      data: {
        actorId: owner1.id,
        actorRole: 'OWNER',
        action: 'LIFECYCLE_TRANSITION',
        resourceType: 'TENANCY',
        resourceId: t1.id,
        metadata: { fromStage: 'BOOKED', toStage: 'RENT_DUE' },
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: tenant2.id,
        actorRole: 'TENANT',
        action: 'MAINTENANCE_REPORTED',
        resourceType: 'MAINTENANCE_ISSUE',
        resourceId: issue1.id,
        metadata: { category: 'APPLIANCE', priority: 'HIGH' },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'HavenDex database seeded successfully!',
    });
  } catch (error: any) {
    console.error('Seed API error:', error);
    return NextResponse.json(
      { error: error.message || 'Seed failed' },
      { status: 500 }
    );
  }
}
