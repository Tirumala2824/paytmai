import {
  PrismaClient,
  UserRole,
  RentalLifecycle,
  MaintenanceStatus,
  PaymentStatus,
  VerificationMethod,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting HavenDex realistic seed...');

  // Clean existing records in reverse dependency order
  await prisma.rentalMemory.deleteMany();
  await prisma.maintenanceVerification.deleteMany();
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

  console.log('Cleared existing data.');

  // ==========================================
  // 1. CREATE USERS & PROFILES
  // ==========================================
  // Owner 1: Rajesh Sharma (Nexus Living)
  const ownerProfile1 = await prisma.userProfile.create({
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

  // Owner 2: Priya Patel (UrbanNest Stays)
  const ownerProfile2 = await prisma.userProfile.create({
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

  // Tenant 1: Arjun Mehta (Software Engineer, Tenancy in Nexus Koramangala)
  const tenantProfile1 = await prisma.userProfile.create({
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

  // Tenant 2: Sneha Rao (Product Designer, Tenancy in Nexus Indiranagar)
  const tenantProfile2 = await prisma.userProfile.create({
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

  // Tenant 3: Rohan Gupta (Data Analyst, Tenancy in UrbanNest HSR)
  const tenantProfile3 = await prisma.userProfile.create({
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

  // Admin User: HavenDex Platform Admin
  const adminProfile = await prisma.userProfile.create({
    data: {
      authUserId: 'admin-auth-id-001',
      email: 'admin@havendex.io',
      name: 'HavenDex System Admin',
      phone: '+91 90000 00000',
      role: UserRole.ADMIN,
    },
  });

  console.log('Created Users & Profiles.');

  // ==========================================
  // 2. CREATE PROPERTIES (3 Properties)
  // ==========================================
  // Property 1 (Owner 1): Nexus Heights Koramangala
  const property1 = await prisma.property.create({
    data: {
      ownerId: ownerProfile1.owner!.id,
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

  // Property 2 (Owner 1): Nexus Indiranagar Suites
  const property2 = await prisma.property.create({
    data: {
      ownerId: ownerProfile1.owner!.id,
      name: 'Nexus Studio Suites Indiranagar',
      address: '108, 12th Main Road, HAL 2nd Stage, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560038',
      propertyType: 'COLIVING',
      description: 'Executive furnished studio suites for professionals with private balconies and workspace.',
      totalRooms: 4,
      amenities: ['Private Balcony', 'Dedicated Workspace', 'AC', 'Washing Machine', 'Smart TV', 'Terrace Lounge'],
    },
  });

  // Property 3 (Owner 2): UrbanNest HSR Haven
  const property3 = await prisma.property.create({
    data: {
      ownerId: ownerProfile2.owner!.id,
      name: 'UrbanNest HSR Haven',
      address: '27th Main, Sector 1, HSR Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560102',
      propertyType: 'APARTMENT',
      description: 'Boutique shared apartments designed for tech founders and creators.',
      totalRooms: 5,
      amenities: ['High-speed Fiber', 'Gaming Zone', 'EV Charging', 'Weekly Community Dinners', 'Lounge'],
    },
  });

  console.log('Created 3 Properties.');

  // ==========================================
  // 3. CREATE ROOMS (9 Rooms across 3 properties)
  // ==========================================
  // Rooms for Property 1
  const p1Room101 = await prisma.room.create({
    data: {
      propertyId: property1.id,
      roomNumber: '101',
      floor: 1,
      roomType: 'SINGLE',
      rentAmount: 18000,
      depositAmount: 36000,
      isOccupied: true,
    },
  });
  const p1Room102 = await prisma.room.create({
    data: {
      propertyId: property1.id,
      roomNumber: '102',
      floor: 1,
      roomType: 'DOUBLE',
      rentAmount: 12000,
      depositAmount: 24000,
      isOccupied: false,
    },
  });
  const p1Room201 = await prisma.room.create({
    data: {
      propertyId: property1.id,
      roomNumber: '201',
      floor: 2,
      roomType: 'SINGLE',
      rentAmount: 19500,
      depositAmount: 39000,
      isOccupied: false,
    },
  });

  // Rooms for Property 2
  const p2Room301 = await prisma.room.create({
    data: {
      propertyId: property2.id,
      roomNumber: '301',
      floor: 3,
      roomType: 'SUITE',
      rentAmount: 26000,
      depositAmount: 52000,
      isOccupied: true,
    },
  });
  const p2Room302 = await prisma.room.create({
    data: {
      propertyId: property2.id,
      roomNumber: '302',
      floor: 3,
      roomType: 'SUITE',
      rentAmount: 26000,
      depositAmount: 52000,
      isOccupied: false,
    },
  });

  // Rooms for Property 3
  const p3RoomA1 = await prisma.room.create({
    data: {
      propertyId: property3.id,
      roomNumber: 'A-101',
      floor: 1,
      roomType: 'SINGLE',
      rentAmount: 22000,
      depositAmount: 44000,
      isOccupied: true,
    },
  });
  const p3RoomA2 = await prisma.room.create({
    data: {
      propertyId: property3.id,
      roomNumber: 'A-102',
      floor: 1,
      roomType: 'DOUBLE',
      rentAmount: 15000,
      depositAmount: 30000,
      isOccupied: false,
    },
  });

  console.log('Created Rooms.');

  // ==========================================
  // 4. CREATE ACTIVE TENANCIES WITH LIFECYCLE STAGES
  // ==========================================
  // Tenancy 1: Arjun Mehta in Nexus Heights Room 101 (Lifecycle: RENT_DUE)
  const tenancy1 = await prisma.tenancy.create({
    data: {
      tenantId: tenantProfile1.tenant!.id,
      roomId: p1Room101.id,
      propertyId: property1.id,
      startDate: new Date('2026-01-01'),
      monthlyRent: 18000,
      securityDeposit: 36000,
      lifecycleStage: RentalLifecycle.RENT_DUE,
      isActive: true,
    },
  });

  // Tenancy 2: Sneha Rao in Nexus Indiranagar Room 301 (Lifecycle: ISSUE)
  const tenancy2 = await prisma.tenancy.create({
    data: {
      tenantId: tenantProfile2.tenant!.id,
      roomId: p2Room301.id,
      propertyId: property2.id,
      startDate: new Date('2026-03-01'),
      monthlyRent: 26000,
      securityDeposit: 52000,
      lifecycleStage: RentalLifecycle.ISSUE,
      isActive: true,
    },
  });

  // Tenancy 3: Rohan Gupta in UrbanNest HSR Room A-101 (Lifecycle: VERIFIED)
  const tenancy3 = await prisma.tenancy.create({
    data: {
      tenantId: tenantProfile3.tenant!.id,
      roomId: p3RoomA1.id,
      propertyId: property3.id,
      startDate: new Date('2026-05-01'),
      monthlyRent: 22000,
      securityDeposit: 44000,
      lifecycleStage: RentalLifecycle.VERIFIED,
      isActive: true,
    },
  });

  console.log('Created Tenancies.');

  // ==========================================
  // 5. RENT SCHEDULES & PAYMENTS
  // ==========================================
  // Tenancy 1: Previous month paid, current month pending
  const t1SchedulePrev = await prisma.rentSchedule.create({
    data: {
      tenancyId: tenancy1.id,
      dueDate: new Date('2026-08-05'),
      amount: 18000,
      billingMonth: '2026-08',
      status: PaymentStatus.SUCCESS,
    },
  });
  await prisma.payment.create({
    data: {
      rentScheduleId: t1SchedulePrev.id,
      amount: 18000,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      paymentMethod: 'PAYTM',
      transactionRef: 'TXN_PAYTM_98234710',
      paidAt: new Date('2026-08-04'),
      metadata: { gateway: 'Paytm PG', bank: 'HDFC UPI' },
    },
  });

  const t1ScheduleCurr = await prisma.rentSchedule.create({
    data: {
      tenancyId: tenancy1.id,
      dueDate: new Date('2026-09-05'),
      amount: 18000,
      billingMonth: '2026-09',
      status: PaymentStatus.PENDING,
    },
  });

  // Tenancy 2: Paid for August & September
  const t2Schedule = await prisma.rentSchedule.create({
    data: {
      tenancyId: tenancy2.id,
      dueDate: new Date('2026-09-05'),
      amount: 26000,
      billingMonth: '2026-09',
      status: PaymentStatus.SUCCESS,
    },
  });
  await prisma.payment.create({
    data: {
      rentScheduleId: t2Schedule.id,
      amount: 26000,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      paymentMethod: 'UPI',
      transactionRef: 'TXN_UPI_66192840',
      paidAt: new Date('2026-09-02'),
      metadata: { gateway: 'Paytm UPI', bank: 'ICICI' },
    },
  });

  // Tenancy 3: Paid for September
  const t3Schedule = await prisma.rentSchedule.create({
    data: {
      tenancyId: tenancy3.id,
      dueDate: new Date('2026-09-01'),
      amount: 22000,
      billingMonth: '2026-09',
      status: PaymentStatus.SUCCESS,
    },
  });
  await prisma.payment.create({
    data: {
      rentScheduleId: t3Schedule.id,
      amount: 22000,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      paymentMethod: 'PAYTM',
      transactionRef: 'TXN_PAYTM_34190823',
      paidAt: new Date('2026-08-30'),
    },
  });

  console.log('Created Rent Schedules and Payments.');

  // ==========================================
  // 6. MAINTENANCE ISSUES, TASKS & VERIFICATIONS
  // ==========================================
  // Issue 0: Historical AC issue for Arjun Mehta (Tenancy 1, Room 101) - VERIFIED & RESOLVED
  const issue0 = await prisma.maintenanceIssue.create({
    data: {
      tenancyId: tenancy1.id,
      propertyId: property1.id,
      reportedById: tenantProfile1.tenant!.id,
      title: 'AC not cooling',
      description: 'The Daikin 1.5T split AC in Room 101 stopped cooling; fan is running but blowing ambient room temperature air.',
      category: 'APPLIANCE',
      priority: 'HIGH',
      status: MaintenanceStatus.VERIFIED,
      resolution: 'AC service completed: filter cleaned, gas pressure restored, cooling tested at 18°C',
      isRepeated: false,
    },
  });

  const task0 = await prisma.maintenanceTask.create({
    data: {
      issueId: issue0.id,
      title: 'AC Compressor & Gas Pressure Service',
      description: 'Clean condenser coils, flush drain line, top up R32 refrigerant, check thermostat.',
      assignedTo: 'CoolCare Services (Technician Ramesh: +91 98450 11223)',
      estimatedCost: 1800,
      actualCost: 1500,
      status: MaintenanceStatus.VERIFIED,
      completedAt: new Date('2026-09-02'),
    },
  });

  await prisma.maintenanceVerification.create({
    data: {
      issueId: issue0.id,
      verificationMethod: VerificationMethod.COMBINED,
      verifiedBy: tenantProfile1.id,
      evidence: 'Tenant confirmed cooling restored to 18°C; Technician invoice #CC-9182 attached with digital sensor log.',
      confidence: 0.98,
      notes: 'Verified by tenant confirmation and digital temperature sensor readout.',
    },
  });

  // Issue 1: Sneha in Tenancy 2 reported AC cooling issue (Status: IN_PROGRESS)
  const issue1 = await prisma.maintenanceIssue.create({
    data: {
      tenancyId: tenancy2.id,
      propertyId: property2.id,
      reportedById: tenantProfile2.tenant!.id,
      title: 'AC leaking water and cooling insufficient',
      description: 'The master bedroom Daikin 1.5T AC unit has water leaking onto the desk and cooling has dropped significantly.',
      category: 'APPLIANCE',
      priority: 'HIGH',
      status: MaintenanceStatus.IN_PROGRESS,
    },
  });

  await prisma.maintenanceTask.create({
    data: {
      issueId: issue1.id,
      title: 'AC Technician Inspection and Filter Cleaning',
      description: 'Clear drain pipe blockage, clean filters, and check gas pressure.',
      assignedTo: 'CoolCare Services (Mr. Ramesh: +91 98450 11223)',
      estimatedCost: 1500,
      status: MaintenanceStatus.IN_PROGRESS,
    },
  });

  // Issue 2: Tenancy 3 had bathroom faucet leak, now fixed and verified
  const issue2 = await prisma.maintenanceIssue.create({
    data: {
      tenancyId: tenancy3.id,
      propertyId: property3.id,
      reportedById: tenantProfile3.tenant!.id,
      title: 'Washroom mixer tap dripping constantly',
      description: 'The hot/cold mixer faucet in the attached bathroom does not shut off completely.',
      category: 'PLUMBING',
      priority: 'MEDIUM',
      status: MaintenanceStatus.VERIFIED,
      resolution: 'Replaced ceramic disc cartridge and rubber washer in mixer faucet',
    },
  });

  await prisma.maintenanceTask.create({
    data: {
      issueId: issue2.id,
      title: 'Replace faucet cartridge washer',
      description: 'Replaced ceramic disc cartridge.',
      assignedTo: 'City Plumbers (Technician Suresh)',
      estimatedCost: 800,
      actualCost: 750,
      status: MaintenanceStatus.VERIFIED,
      completedAt: new Date('2026-09-10'),
    },
  });

  await prisma.maintenanceVerification.create({
    data: {
      issueId: issue2.id,
      verificationMethod: VerificationMethod.TENANT_CONFIRMATION,
      verifiedBy: tenantProfile3.id,
      evidence: 'Tenant confirmed dripping completely stopped and pressure normal.',
      confidence: null,
      notes: 'Tenant verified via mobile app check-off.',
    },
  });

  console.log('Created Maintenance Issues, Tasks & Verifications.');

  // ==========================================
  // 6b. RENTAL MEMORY GRAPH (Cognee / Persistent)
  // ==========================================
  await prisma.rentalMemory.createMany({
    data: [
      {
        userProfileId: tenantProfile1.id,
        tenancyId: tenancy1.id,
        propertyId: property1.id,
        memoryType: 'TENANCY_RELATION',
        key: 'LEASE_RELATION',
        summary: 'Tenant Arjun Mehta is in active lease at Nexus Heights Luxury PG (Room 101) since 2026-06-01. Monthly rent ₹18,000.',
        content: { rentAmount: 18000, leaseStart: '2026-06-01', propertyName: 'Nexus Heights Luxury PG' },
        source: 'LOCAL_GRAPH',
      },
      {
        userProfileId: tenantProfile1.id,
        tenancyId: tenancy1.id,
        propertyId: property1.id,
        memoryType: 'ROOM',
        key: 'ROOM_SPEC',
        summary: 'Room 101 on Floor 1. SINGLE room type. Deposit ₹36,000. Amenities: High-speed WiFi, Power Backup, Gym.',
        content: { roomNumber: '101', floor: 1, type: 'SINGLE' },
        source: 'LOCAL_GRAPH',
      },
      {
        userProfileId: tenantProfile1.id,
        tenancyId: tenancy1.id,
        propertyId: property1.id,
        memoryType: 'MAINTENANCE_RESOLUTION',
        key: 'AC_UNIT',
        summary: 'Previous Maintenance: "AC not cooling" in Room 101 was repaired by CoolCare Services. Status: VERIFIED. Repair: AC service completed, filter cleaned, gas pressure restored.',
        content: {
          issueTitle: 'AC not cooling',
          status: 'VERIFIED',
          repair: 'AC service completed',
          technician: 'CoolCare Services (Technician Ramesh)',
          verifiedAt: '2026-09-02',
          resolution: 'AC service completed: filter cleaned, gas pressure restored, cooling tested at 18°C',
        },
        source: 'COGNEE_API',
      },
      {
        userProfileId: tenantProfile1.id,
        tenancyId: tenancy1.id,
        propertyId: property1.id,
        memoryType: 'PAYMENT_CONTEXT',
        key: 'RENT_PAYMENT_SCHEDULE',
        summary: 'Rent due on the 5th of each month. Billing cycle 2026-09 is PENDING (₹18,000). Previous payment for August was SUCCESS via Paytm.',
        content: { billingMonth: '2026-09', amount: 18000, status: 'PENDING' },
        source: 'LOCAL_GRAPH',
      },
      {
        userProfileId: tenantProfile2.id,
        tenancyId: tenancy2.id,
        propertyId: property2.id,
        memoryType: 'TENANCY_RELATION',
        key: 'LEASE_RELATION',
        summary: 'Tenant Sneha Rao is residing at Nexus Studio Suites Indiranagar (Room 301). Monthly rent ₹26,000.',
        content: { rentAmount: 26000, propertyName: 'Nexus Studio Suites Indiranagar' },
        source: 'LOCAL_GRAPH',
      },
    ],
  });

  console.log('Created Persistent Rental Memory Graph records.');

  // ==========================================
  // 7. NOTIFICATIONS
  // ==========================================
  await prisma.notification.create({
    data: {
      userProfileId: tenantProfile1.id,
      title: 'Rent Due for September 2026',
      message: 'Your monthly rent of ₹18,000 for Nexus Heights (Room 101) is due.',
      type: 'RENT_DUE',
      link: '/payments',
    },
  });

  await prisma.notification.create({
    data: {
      userProfileId: ownerProfile1.id,
      title: 'Maintenance Issue Reported',
      message: 'Sneha Rao reported an AC leakage issue at Nexus Indiranagar (Room 301).',
      type: 'MAINTENANCE_UPDATE',
      link: '/maintenance',
    },
  });

  // ==========================================
  // 8. AUDIT EVENTS
  // ==========================================
  await prisma.auditEvent.create({
    data: {
      actorId: ownerProfile1.id,
      actorRole: 'OWNER',
      action: 'LIFECYCLE_TRANSITION',
      resourceType: 'TENANCY',
      resourceId: tenancy1.id,
      metadata: { fromStage: 'BOOKED', toStage: 'RENT_DUE' },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: tenantProfile2.id,
      actorRole: 'TENANT',
      action: 'MAINTENANCE_REPORTED',
      resourceType: 'MAINTENANCE_ISSUE',
      resourceId: issue1.id,
      metadata: { category: 'APPLIANCE', priority: 'HIGH' },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: tenantProfile3.id,
      actorRole: 'TENANT',
      action: 'PAYMENT_PROCESSED',
      resourceType: 'PAYMENT',
      resourceId: t3Schedule.id,
      metadata: { amount: 22000, method: 'PAYTM', ref: 'TXN_PAYTM_34190823' },
    },
  });

  console.log('✅ HavenDex seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
