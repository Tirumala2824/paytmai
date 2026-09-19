import {
  PrismaClient,
  UserRole,
  RentalLifecycle,
  MaintenanceStatus,
  PaymentStatus,
  VerificationMethod,
} from '@prisma/client';

const prisma = new PrismaClient();

// Generator helper arrays
const FIRST_NAMES = [
  'Arjun', 'Sneha', 'Vikram', 'Ananya', 'Rohit', 'Deepa', 'Rahul', 'Pooja', 'Aditya', 'Tanvi',
  'Siddharth', 'Neha', 'Karthik', 'Meera', 'Gaurav', 'Swati', 'Rakesh', 'Divya', 'Amit', 'Shruti',
  'Nikhil', 'Kavita', 'Varun', 'Ritu', 'Pranav', 'Shreya', 'Abhishek', 'Malini', 'Harish', 'Pallavi',
  'Manish', 'Geeta', 'Suresh', 'Bhavna', 'Ashwin', 'Isha', 'Devendra', 'Nandini', 'Kunal', 'Rashmi',
  'Alok', 'Sunita', 'Tushar', 'Preeti', 'Yash', 'Simran', 'Akash', 'Monika', 'Rajiv', 'Aparna',
  'Deepak', 'Sangeeta', 'Mayank', 'Vidya', 'Chirag', 'Anjali', 'Kishore', 'Leela', 'Hemant', 'Radha',
  'Sameer', 'Priyanka', 'Tarun', 'Shalini', 'Navin', 'Jyoti', 'Girish', 'Smita', 'Santosh', 'Usha',
  'Vijay', 'Madhavi', 'Lalit', 'Sarita', 'Ajay', 'Shweta', 'Naveen', 'Rani', 'Sachin', 'Archana',
  'Prakash', 'Sunil', 'Vinod', 'Anil', 'Kamal', 'Ravi', 'Mohit', 'Chetan', 'Sanjay', 'Mukesh',
  'Suraj', 'Gopal', 'Bharat', 'Dinesh', 'Ramesh', 'Mahesh', 'Umesh', 'Praveen', 'Jitendra', 'Ashok',
  'Vikas', 'Nitin', 'Manoj', 'Deep', 'Harsh', 'Vipul', 'Sumit', 'Ankit', 'Vivek', 'Rajan',
  'Dhruv', 'Sanket', 'Prateek', 'Shantanu', 'Amol', 'Mandar', 'Chinmay', 'Sarang', 'Omkar', 'Tanmay',
  'Saurabh', 'Kaustubh', 'Parag', 'Nilesh', 'Bhushan', 'Shailesh', 'Atul', 'Milind', 'Swapnil', 'Abhay',
  'Hitesh', 'Jignesh', 'Bhavesh', 'Piyush', 'Ketan', 'Bipin', 'Kalpesh', 'Paresh', 'Dhaval', 'Mehul'
];

const LAST_NAMES = [
  'Mehta', 'Rao', 'Singh', 'Sharma', 'Verma', 'Krishnan', 'Nair', 'Iyer', 'Kulkarni', 'Joshi',
  'Reddy', 'Agarwal', 'Raman', 'Nambiar', 'Kapoor', 'Sen', 'Pandey', 'Choudhary', 'Trivedi', 'Saxena',
  'Gupta', 'Patel', 'Bhat', 'Deshmukh', 'Menon', 'Pillai', 'Shetty', 'Hegde', 'Banerjee', 'Chatterjee',
  'Bose', 'Dutta', 'Ghosh', 'Mukherjee', 'Das', 'Roy', 'Chakraborty', 'Mishra', 'Dubey', 'Tiwari',
  'Shukla', 'Tripathi', 'Chaubey', 'Upadhyay', 'Pandit', 'Pathak', 'Vaidya', 'Bhattacharya', 'Goswami', 'Chauhan',
  'Rathore', 'Solanki', 'Parmar', 'Bhati', 'Sisodia', 'Tomar', 'Rawat', 'Negi', 'Bisht', 'Pundir',
  'Nayak', 'Gowda', 'Naidu', 'Chowdary', 'Varma', 'Raju', 'Babu', 'Prasad', 'Murthy', 'Sastry',
  'Gokhale', 'Ranade', 'Tilak', 'Apte', 'Bhave', 'Kelkar', 'Gadgil', 'Sathe', 'Phadke', 'Bhide'
];

async function main() {
  console.log('🌱 Starting HavenDex 150+ Tenants & Multiple PGs Seed...');

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

  console.log('✓ Cleaned existing database tables.');

  // ============================================================================
  // 1. CREATE 5 DIVERSE PG OWNERS
  // ============================================================================
  console.log('Creating 5 property owners...');

  const ownersData = [
    {
      authUserId: 'owner-auth-id-001',
      email: 'rajesh@nexusliving.in',
      name: 'Rajesh Sharma',
      phone: '+91 98765 43210',
      companyName: 'Nexus Living Spaces LLP',
      taxId: '29AAAAA0000A1Z5',
      bankDetails: 'HDFC Bank - A/C: 50100234567890 (IFSC: HDFC0000123)',
    },
    {
      authUserId: 'owner-auth-id-002',
      email: 'priya@urbannest.in',
      name: 'Priya Patel',
      phone: '+91 98111 22334',
      companyName: 'UrbanNest Coliving Ventures',
      taxId: '29BBBBB1111B2Z6',
      bankDetails: 'ICICI Bank - A/C: 000405001234 (IFSC: ICIC0000004)',
    },
    {
      authUserId: 'owner-auth-id-003',
      email: 'vikram@royalpalms.in',
      name: 'Vikram Malhotra',
      phone: '+91 98222 33445',
      companyName: 'Royal Palms Hospitality Ltd',
      taxId: '29CCCCC2222C3Z7',
      bankDetails: 'Axis Bank - A/C: 91201003456789 (IFSC: UTIB0000234)',
    },
    {
      authUserId: 'owner-auth-id-004',
      email: 'ananya@deccanstays.in',
      name: 'Ananya Deshmukh',
      phone: '+91 98333 44556',
      companyName: 'Deccan Living Solutions Pune',
      taxId: '27DDDDD3333D4Z8',
      bankDetails: 'State Bank of India - A/C: 30123456789 (IFSC: SBIN0001234)',
    },
    {
      authUserId: 'owner-auth-id-005',
      email: 'suresh@cybercitypg.in',
      name: 'Suresh Reddy',
      phone: '+91 98444 55667',
      companyName: 'CyberCity Stays Hyderabad',
      taxId: '36EEEEE4444E5Z9',
      bankDetails: 'Kotak Mahindra Bank - A/C: 7812003456 (IFSC: KKBK0000456)',
    },
  ];

  const createdOwners: any[] = [];
  for (const o of ownersData) {
    const user = await prisma.userProfile.create({
      data: {
        authUserId: o.authUserId,
        email: o.email,
        name: o.name,
        phone: o.phone,
        role: UserRole.OWNER,
        owner: {
          create: {
            companyName: o.companyName,
            taxId: o.taxId,
            bankAccountDetails: o.bankDetails,
          },
        },
      },
      include: { owner: true },
    });
    createdOwners.push(user.owner);
  }

  // Admin user
  const adminUser = await prisma.userProfile.create({
    data: {
      authUserId: 'admin-auth-id-001',
      email: 'admin@havendex.io',
      name: 'HavenDex System Admin',
      phone: '+91 90000 00000',
      role: UserRole.ADMIN,
    },
  });

  console.log(`✓ Created 5 owners and admin profile.`);

  // ============================================================================
  // 2. CREATE 8 PG PROPERTIES
  // ============================================================================
  console.log('Creating 8 PG properties across Bangalore, Pune, and Hyderabad...');

  const propertiesConfig = [
    {
      ownerIdx: 0, // Rajesh
      name: 'Nexus Grand PG',
      address: '#42, 5th Block, 80ft Road, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560095',
      propertyType: 'PG',
      description: 'Premium executive boys PG with 3-time North & South Indian meals, biometric access, and high-speed Wi-Fi.',
      amenities: ['High-Speed Wi-Fi', '3-Time Meals', 'Daily Housekeeping', 'RO Drinking Water', 'Biometric Gate', '24/7 Power Backup', 'Washing Machines', 'Gym'],
      roomCount: 26,
    },
    {
      ownerIdx: 0, // Rajesh
      name: 'Nexus Heights Coliving',
      address: '#118, 100ft Road, HAL 2nd Stage, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560038',
      propertyType: 'COLIVING',
      description: 'Modern unisex coliving space with gaming lounge, rooftop workstation, and high-speed fiber internet.',
      amenities: ['High-Speed Wi-Fi', 'Daily Housekeeping', 'Air Conditioning', 'Lift Access', 'Gaming Lounge', 'Rooftop Cafeteria', 'Power Backup'],
      roomCount: 22,
    },
    {
      ownerIdx: 1, // Priya
      name: 'UrbanNest Prime Stays',
      address: '#204, 14th Main, Sector 2, HSR Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560102',
      propertyType: 'PG',
      description: 'Cozy, clean luxury PG for IT professionals near BDA Complex and tech campuses.',
      amenities: ['High-Speed Wi-Fi', 'Homestyle Food', 'CCTV Security', 'Study Desks', 'Laundry Service', 'Solar Hot Water'],
      roomCount: 22,
    },
    {
      ownerIdx: 1, // Priya
      name: 'UrbanNest Luxury Suites',
      address: '#89, Outer Ring Road, Bellandur-Marathahalli',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560103',
      propertyType: 'APARTMENT',
      description: 'Serviced 1BHK & studio apartments with modular kitchen, AC, and round-the-clock security.',
      amenities: ['Modular Kitchen', 'Air Conditioning', 'Covered Parking', 'Swimming Pool Access', 'Gym', 'Wi-Fi'],
      roomCount: 18,
    },
    {
      ownerIdx: 2, // Vikram
      name: 'Royal Palms Executive PG',
      address: '#15, ITPL Main Road, Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560066',
      propertyType: 'PG',
      description: 'Large enterprise PG campus close to ITPL and Prestige Shantiniketan with buffet dining.',
      amenities: ['High-Speed Wi-Fi', 'Buffet Breakfast & Dinner', 'Shuttle Service', 'Power Backup', 'Gym', 'Laundry'],
      roomCount: 25,
    },
    {
      ownerIdx: 3, // Ananya
      name: 'Deccan Comfort PG',
      address: '#54, Phase 1, Hinjawadi Infotech Park',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411057',
      propertyType: 'PG',
      description: 'Comfortable boys and girls sharing PG steps away from Wipro and Infosys Hinjawadi campuses.',
      amenities: ['High-Speed Wi-Fi', 'Maharashtrian & North Indian Meals', 'Hot Water Geysers', 'Biometric Gate', 'Housekeeping'],
      roomCount: 24,
    },
    {
      ownerIdx: 3, // Ananya
      name: 'Deccan Heights Coliving',
      address: '#12, Sakore Nagar, Viman Nagar',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411014',
      propertyType: 'COLIVING',
      description: 'Contemporary coliving with workstations, community events, and rooftop lounge in Viman Nagar.',
      amenities: ['High-Speed Wi-Fi', 'Coworking Desks', 'Housekeeping', 'Rooftop Terrace', 'TV Lounge', 'Parking'],
      roomCount: 20,
    },
    {
      ownerIdx: 4, // Suresh
      name: 'CyberCity Luxury PG',
      address: '#77, Telecom Nagar, Gachibowli',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500032',
      propertyType: 'PG',
      description: 'State-of-the-art Hyderabad executive PG serving authentic South Indian and North Indian food.',
      amenities: ['High-Speed Wi-Fi', 'Hyderabadi & North Indian Meals', 'Air Conditioning', '24/7 Power Backup', 'Gymnasium', 'Elevator'],
      roomCount: 28,
    },
  ];

  const createdProperties: any[] = [];
  for (const pc of propertiesConfig) {
    const owner = createdOwners[pc.ownerIdx];
    const property = await prisma.property.create({
      data: {
        ownerId: owner.id,
        name: pc.name,
        address: pc.address,
        city: pc.city,
        state: pc.state,
        zipCode: pc.zipCode,
        propertyType: pc.propertyType,
        description: pc.description,
        amenities: pc.amenities,
        totalRooms: pc.roomCount,
      },
    });
    createdProperties.push({ property, config: pc });
  }

  console.log(`✓ Created 8 properties (${createdProperties.length} records).`);

  // ============================================================================
  // 3. CREATE ROOMS (Total 185 Rooms across 8 PGs)
  // ============================================================================
  console.log('Creating rooms for each PG...');

  const allCreatedRooms: any[] = [];

  for (const { property, config } of createdProperties) {
    const roomCount = config.roomCount;
    for (let r = 1; r <= roomCount; r++) {
      const floor = Math.floor((r - 1) / 6) + 1;
      const roomNumSuffix = (r % 6 === 0 ? 6 : r % 6).toString().padStart(2, '0');
      const roomNumber = `${floor}${roomNumSuffix}`;

      // Distribute room types
      let roomType = 'DOUBLE';
      let rentAmount = 10500;
      let depositAmount = 21000;

      if (r % 3 === 1) {
        roomType = 'SINGLE';
        rentAmount = property.propertyType === 'APARTMENT' ? 22000 : 16000;
        depositAmount = rentAmount * 2;
      } else if (r % 3 === 2) {
        roomType = 'DOUBLE';
        rentAmount = property.propertyType === 'APARTMENT' ? 14000 : 10500;
        depositAmount = rentAmount * 2;
      } else {
        roomType = 'TRIPLE';
        rentAmount = 7500;
        depositAmount = 15000;
      }

      const room = await prisma.room.create({
        data: {
          propertyId: property.id,
          roomNumber,
          floor,
          roomType,
          rentAmount,
          depositAmount,
          isOccupied: false, // will update during tenancy assignment
        },
      });

      allCreatedRooms.push({ room, property });
    }
  }

  console.log(`✓ Created ${allCreatedRooms.length} rooms total across all 8 PGs.`);

  // ============================================================================
  // 4. CREATE 140 REAL TENANTS & TENANCIES
  // ============================================================================
  console.log('Creating 140 tenants with tenancies, rent schedules, and payments...');

  // We assign 140 tenants to the first 140 rooms (leaving 45 rooms vacant for realistic occupancy rate of ~76%)
  const TARGET_TENANT_COUNT = 140;

  for (let i = 0; i < TARGET_TENANT_COUNT; i++) {
    const roomInfo = allCreatedRooms[i];
    const { room, property } = roomInfo;

    // First tenant is always Arjun Mehta in Nexus Koramangala Room 204
    let firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    let lastName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 50 ? i : ''}@gmail.com`;
    let phone = `+91 ${9800000000 + i * 1111}`;
    let authUserId = `tenant-auth-id-${(i + 1).toString().padStart(3, '0')}`;

    if (i === 0) {
      firstName = 'Arjun';
      lastName = 'Mehta';
      email = 'arjun.mehta@gmail.com';
      phone = '+91 99887 76655';
      authUserId = 'tenant-auth-id-001';
    } else if (i === 1) {
      firstName = 'Sneha';
      lastName = 'Rao';
      email = 'sneha.rao@gmail.com';
      phone = '+91 99887 76656';
      authUserId = 'tenant-auth-id-002';
    } else if (i === 2) {
      firstName = 'Vikram';
      lastName = 'Singh';
      email = 'vikram.singh@gmail.com';
      phone = '+91 99887 76657';
      authUserId = 'tenant-auth-id-003';
    }

    // Create UserProfile + Tenant
    const userProfile = await prisma.userProfile.create({
      data: {
        authUserId,
        email,
        name: `${firstName} ${lastName}`,
        phone,
        role: UserRole.TENANT,
        tenant: {
          create: {
            emergencyContact: `Parent of ${firstName}: +91 98${(70000000 + i * 133).toString().slice(0, 8)}`,
            idProofType: i % 2 === 0 ? 'AADHAAR' : 'PASSPORT',
            idProofNumber: `XXXX-XXXX-${(4000 + i).toString()}`,
          },
        },
      },
      include: { tenant: true },
    });

    const tenant = userProfile.tenant!;

    // Mark room as occupied
    await prisma.room.update({
      where: { id: room.id },
      data: { isOccupied: true },
    });

    // Create Tenancy
    const startMonthsAgo = (i % 6) + 1;
    const startDate = new Date(2026, 8 - startMonthsAgo, 1); // 1st of respective month in 2026

    const tenancy = await prisma.tenancy.create({
      data: {
        tenantId: tenant.id,
        roomId: room.id,
        propertyId: property.id,
        startDate,
        monthlyRent: room.rentAmount,
        securityDeposit: room.depositAmount,
        lifecycleStage: i % 10 === 0 ? RentalLifecycle.ISSUE : RentalLifecycle.PAYMENT,
        isActive: true,
      },
    });

    // Create Rent Schedule for September 2026 (Current Month)
    const isPaid = i % 5 !== 0; // 80% paid, 20% pending
    const currentScheduleStatus = isPaid ? PaymentStatus.SUCCESS : PaymentStatus.PENDING;

    const currentSchedule = await prisma.rentSchedule.create({
      data: {
        tenancyId: tenancy.id,
        dueDate: new Date('2026-09-05T00:00:00.000Z'),
        amount: room.rentAmount,
        billingMonth: '2026-09',
        status: currentScheduleStatus,
      },
    });

    // If paid, create payment record
    if (isPaid) {
      await prisma.payment.create({
        data: {
          rentScheduleId: currentSchedule.id,
          amount: room.rentAmount,
          currency: 'INR',
          status: PaymentStatus.SUCCESS,
          paymentMethod: i % 2 === 0 ? 'PAYTM' : 'UPI',
          transactionRef: `TXN-PAYTM-202609-${(100000 + i * 77).toString()}`,
          paidAt: new Date('2026-09-03T10:30:00.000Z'),
          metadata: {
            bankRef: `HDFC-UPI-${(9000000 + i).toString()}`,
            paytmGateway: 'SUCCESS',
            paymentMode: i % 2 === 0 ? 'PAYTM_WALLET' : 'UPI_INTENT',
          },
        },
      });
    }

    // Create Rent Schedule for August 2026 (Previous Month - Always Paid)
    const augSchedule = await prisma.rentSchedule.create({
      data: {
        tenancyId: tenancy.id,
        dueDate: new Date('2026-08-05T00:00:00.000Z'),
        amount: room.rentAmount,
        billingMonth: '2026-08',
        status: PaymentStatus.SUCCESS,
      },
    });

    await prisma.payment.create({
      data: {
        rentScheduleId: augSchedule.id,
        amount: room.rentAmount,
        currency: 'INR',
        status: PaymentStatus.SUCCESS,
        paymentMethod: 'PAYTM',
        transactionRef: `TXN-PAYTM-202608-${(800000 + i * 77).toString()}`,
        paidAt: new Date('2026-08-04T14:15:00.000Z'),
        metadata: {
          gateway: 'PAYTM',
        },
      },
    });

    // Create Maintenance Issues for a selection of tenants (~25 issues)
    if (i === 0) {
      // Arjun Mehta's Crucial AC Issue Record (Past verified resolution + Repeated issue history)
      const acIssue = await prisma.maintenanceIssue.create({
        data: {
          tenancyId: tenancy.id,
          propertyId: property.id,
          reportedById: tenant.id,
          title: 'Air conditioner not cooling properly (Room 204)',
          description: 'The Daikin 1.5T split AC in Room 204 is making a humming sound and not blowing cold air.',
          category: 'APPLIANCE',
          priority: 'HIGH',
          status: MaintenanceStatus.VERIFIED,
          resolution: 'AC technician refilled R32 refrigerant gas and cleaned dust filters.',
          createdAt: new Date('2026-08-15T09:00:00.000Z'),
          updatedAt: new Date('2026-08-17T16:00:00.000Z'),
          isRepeated: false,
        },
      });

      await prisma.maintenanceVerification.create({
        data: {
          issueId: acIssue.id,
          verificationMethod: VerificationMethod.TENANT_CONFIRMATION,
          verifiedBy: userProfile.id,
          verifiedAt: new Date('2026-08-17T16:00:00.000Z'),
          evidence: 'Tenant Arjun Mehta confirmed cooling restored and room temperature reached 22C.',
          confidence: 1.0,
        },
      });

      // Also record in RentalMemory graph
      await prisma.rentalMemory.create({
        data: {
          userProfileId: userProfile.id,
          tenancyId: tenancy.id,
          propertyId: property.id,
          memoryType: 'MAINTENANCE_RESOLUTION',
          key: 'AC_UNIT_ROOM_204',
          summary: 'Daikin AC in Room 204 had gas leak refilled and filters cleaned on 2026-08-17. Verified working.',
          content: {
            issueId: acIssue.id,
            issueTitle: acIssue.title,
            status: 'VERIFIED',
            appliance: 'Daikin 1.5 Ton Split AC',
            vendor: 'CoolAir Solutions',
            verifiedAt: '2026-08-17T16:00:00.000Z',
          },
          source: 'LOCAL_GRAPH',
        },
      });
    } else if (i % 6 === 0) {
      // Plumbing issue
      const issue = await prisma.maintenanceIssue.create({
        data: {
          tenancyId: tenancy.id,
          propertyId: property.id,
          reportedById: tenant.id,
          title: `Bathroom tap leaking in Room ${room.roomNumber}`,
          description: 'Continuous slow drip from mixer tap in the attached washroom.',
          category: 'PLUMBING',
          priority: 'MEDIUM',
          status: MaintenanceStatus.TASK_ASSIGNED,
          createdAt: new Date('2026-09-18T11:00:00.000Z'),
          isRepeated: false,
        },
      });

      await prisma.maintenanceTask.create({
        data: {
          issueId: issue.id,
          title: 'Replace tap washer and seal cartridge',
          assignedTo: 'QuickFix Plumbing Services',
          estimatedCost: 450,
          status: MaintenanceStatus.TASK_ASSIGNED,
        },
      });
    } else if (i % 11 === 0) {
      // Electrical Geyser issue
      const issue = await prisma.maintenanceIssue.create({
        data: {
          tenancyId: tenancy.id,
          propertyId: property.id,
          reportedById: tenant.id,
          title: `Water geyser tripping MCB switch (Room ${room.roomNumber})`,
          description: 'When switching on the Havells 25L geyser, the electrical MCB trips.',
          category: 'ELECTRICAL',
          priority: 'HIGH',
          status: MaintenanceStatus.IN_PROGRESS,
          createdAt: new Date('2026-09-17T08:30:00.000Z'),
          isRepeated: false,
        },
      });

      await prisma.maintenanceTask.create({
        data: {
          issueId: issue.id,
          title: 'Inspect heating element and rewire thermostat',
          assignedTo: 'Spark Electricals',
          estimatedCost: 800,
          status: MaintenanceStatus.IN_PROGRESS,
        },
      });
    }

    // Individual Tenancy relation memory
    await prisma.rentalMemory.create({
      data: {
        userProfileId: userProfile.id,
        tenancyId: tenancy.id,
        propertyId: property.id,
        memoryType: 'TENANCY_RELATION',
        key: `TENANCY_${room.roomNumber}`,
        summary: `Tenant ${userProfile.name} resides in Room ${room.roomNumber} (${room.roomType} sharing) at ${property.name}. Monthly rent ₹${room.rentAmount}.`,
        content: {
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          rent: room.rentAmount,
          propertyName: property.name,
          city: property.city,
        },
        source: 'LOCAL_GRAPH',
      },
    });
  }

  console.log(`✓ Created ${TARGET_TENANT_COUNT} tenants with tenancies, rent schedules, and payments.`);

  // ============================================================================
  // 5. SEED COGNEE KNOWLEDGE GRAPH (Property Rules, Wi-Fi, Food Timings, Specs)
  // ============================================================================
  console.log('Seeding Cognee Knowledge Graph entries in RentalMemory for all PGs...');

  const cogneeKnowledgeData = [
    // Nexus Grand PG
    {
      propIdx: 0,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_NEXUS_GRAND',
      summary: 'Wi-Fi Network: NexusGrand_HighSpeed_5G | Password: NexusLiving@2026 | Bandwidth: 300 Mbps unlimited fiber.',
      content: { ssid: 'NexusGrand_HighSpeed_5G', pass: 'NexusLiving@2026', speed: '300 Mbps', support: '+91 80 4567 8900' },
    },
    {
      propIdx: 0,
      memoryType: 'PROPERTY_RULES',
      key: 'RULES_NEXUS_GRAND',
      summary: 'Curfew & Gate Timings: Main biometric gate closes at 11:00 PM. Late entry permitted till 12:00 AM with prior WhatsApp notice to manager. Overnight visitors not permitted in rooms.',
      content: { curfew: '11:00 PM', gateType: 'Biometric fingerprint', quietHours: '10:30 PM - 6:30 AM' },
    },
    {
      propIdx: 0,
      memoryType: 'MESS_SCHEDULE',
      key: 'MESS_NEXUS_GRAND',
      summary: 'Mess & Dining Hours: Breakfast 7:30 AM - 9:30 AM, Lunch 1:00 PM - 2:30 PM, Dinner 8:00 PM - 10:00 PM. Pure veg counter available daily. Special feast on Sundays.',
      content: { breakfast: '7:30-9:30 AM', lunch: '1:00-2:30 PM', dinner: '8:00-10:00 PM', cuisine: 'North & South Indian' },
    },
    {
      propIdx: 0,
      memoryType: 'APPLIANCE_SPEC',
      key: 'AC_SPECS_NEXUS_GRAND',
      summary: 'All AC rooms are equipped with Daikin 1.5 Ton 5-Star Inverter Split ACs with PM 2.5 air filtration. Routine quarterly servicing by CoolAir Solutions.',
      content: { brand: 'Daikin', capacity: '1.5 Ton', inverter: true, serviceVendor: 'CoolAir Solutions' },
    },

    // Nexus Heights Coliving
    {
      propIdx: 1,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_NEXUS_HEIGHTS',
      summary: 'Wi-Fi Network: NexusHeights_Guest_5G | Password: ColivingNexus#2026 | Dedicated mesh routers on each floor.',
      content: { ssid: 'NexusHeights_Guest_5G', pass: 'ColivingNexus#2026', speed: '500 Mbps' },
    },
    {
      propIdx: 1,
      memoryType: 'PROPERTY_RULES',
      key: 'RULES_NEXUS_HEIGHTS',
      summary: '24/7 Biometric entry. Rooftop cafeteria open till 1:00 AM. Coworking desk booking via HavenDex app.',
      content: { curfew: '24/7 Access', quietHours: '11:00 PM - 7:00 AM' },
    },

    // UrbanNest Prime Stays
    {
      propIdx: 2,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_URBANNEST_PRIME',
      summary: 'Wi-Fi Network: UrbanNest_HSR_5G | Password: PrimeStay2026 | Dual ISP backup (Airtel + ACT).',
      content: { ssid: 'UrbanNest_HSR_5G', pass: 'PrimeStay2026', backupIsp: true },
    },
    {
      propIdx: 2,
      memoryType: 'MESS_SCHEDULE',
      key: 'MESS_URBANNEST_PRIME',
      summary: 'Mess Dining: Breakfast 7:00-9:30 AM, Packed lunch available on request, Dinner 7:45-9:45 PM.',
      content: { breakfast: '7:00-9:30 AM', dinner: '7:45-9:45 PM', packedLunch: 'Available on prior request' },
    },

    // Royal Palms Whitefield
    {
      propIdx: 4,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_ROYAL_PALMS',
      summary: 'Wi-Fi Network: RoyalPalms_Whitefield | Password: RoyalStay#99 | 1 Gbps commercial fiber line.',
      content: { ssid: 'RoyalPalms_Whitefield', pass: 'RoyalStay#99' },
    },
    {
      propIdx: 4,
      memoryType: 'FACILITY_SPEC',
      key: 'AMENITIES_ROYAL_PALMS',
      summary: 'Complimentary shuttle service to ITPL and Shantiniketan Tech Park at 8:30 AM, 9:15 AM, 9:45 AM. Return shuttles from 6:00 PM to 8:30 PM.',
      content: { shuttleTimings: ['8:30 AM', '9:15 AM', '9:45 AM'], techPark: 'ITPL Whitefield' },
    },

    // Deccan Comfort Pune
    {
      propIdx: 5,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_DECCAN_COMFORT',
      summary: 'Wi-Fi Network: DeccanComfort_Pune | Password: Hinjawadi@2026 | High-speed fiber with UPS backup.',
      content: { ssid: 'DeccanComfort_Pune', pass: 'Hinjawadi@2026' },
    },
    {
      propIdx: 5,
      memoryType: 'PROPERTY_RULES',
      key: 'RULES_DECCAN_COMFORT',
      summary: 'Biometric gate open 24/7 for night-shift IT employees working in Hinjawadi Phase 1 & 2. ID card display required for night entry.',
      content: { nightShiftAllowed: true, gateCurfew: 'None for IT night shift employees with badge' },
    },

    // CyberCity Luxury PG Hyderabad
    {
      propIdx: 7,
      memoryType: 'PROPERTY_WIFI',
      key: 'WIFI_CYBERCITY_HYD',
      summary: 'Wi-Fi Network: CyberCity_Gachibowli_5G | Password: CyberHyd@2026 | 500 Mbps Jio Fiber enterprise link.',
      content: { ssid: 'CyberCity_Gachibowli_5G', pass: 'CyberHyd@2026' },
    },
    {
      propIdx: 7,
      memoryType: 'MESS_SCHEDULE',
      key: 'MESS_CYBERCITY_HYD',
      summary: 'CyberCity Mess Schedule: Authentic Hyderabadi & Andhra cuisine. Breakfast 7:30 AM - 9:30 AM, Lunch 12:30 PM - 2:30 PM, Dinner 8:00 PM - 10:30 PM. Special Biryani every Wednesday & Sunday dinner.',
      content: { specialDish: 'Hyderabadi Dum Biryani on Wed & Sun', breakfast: '7:30-9:30 AM', dinner: '8:00-10:30 PM' },
    },
  ];

  for (const item of cogneeKnowledgeData) {
    const propInfo = createdProperties[item.propIdx];
    const owner = createdOwners[propInfo.config.ownerIdx];

    await prisma.rentalMemory.create({
      data: {
        userProfileId: owner.userProfileId,
        propertyId: propInfo.property.id,
        memoryType: item.memoryType,
        key: item.key,
        summary: item.summary,
        content: item.content as any,
        confidence: 1.0,
        source: 'COGNEE_API',
      },
    });
  }

  console.log(`✓ Seeded Cognee knowledge graph memory records.`);

  // Summary audit event
  await prisma.auditEvent.create({
    data: {
      actorId: adminUser.id,
      actorRole: 'ADMIN',
      action: 'SYSTEM_DATABASE_SEEDED',
      resourceType: 'SYSTEM',
      resourceId: 'DATABASE_INITIALIZATION',
      metadata: {
        totalOwners: createdOwners.length,
        totalProperties: createdProperties.length,
        totalRooms: allCreatedRooms.length,
        totalTenants: TARGET_TENANT_COUNT,
        knowledgeEntriesCount: cogneeKnowledgeData.length,
      },
    },
  });

  console.log('🎉 HavenDex 150+ Tenants & Multiple PGs Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
