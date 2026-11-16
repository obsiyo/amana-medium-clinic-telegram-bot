require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {

  console.log("🌱 Seeding clinic database...");

  // =========================
  // SERVICES
  // =========================

  const generalMedicine = await prisma.service.upsert({
    where: {
      id: 1
    },
    update: {
      name: "General Medicine",
      description: "General medical consultation",
      price: 500
    },
    create: {
      name: "General Medicine",
      description: "General medical consultation",
      price: 500
    }
  });

  const dental = await prisma.service.upsert({
    where: {
      id: 2
    },
    update: {},
    create: {
      name: "Dental Consultation",
      description: "Dental examination and consultation",
      price: 700
    }
  });

  const pediatrics = await prisma.service.upsert({
    where: {
      id: 3
    },
    update: {},
    create: {
      name: "Pediatrics",
      description: "Medical care for children",
      price: 600
    }
  });

  // =========================
  // DOCTORS
  // =========================

  const doctor1 = await prisma.doctor.upsert({
    where: {
      id: 1
    },
    update: {
      name: "Dr. MohammedSani",
      specialization: "General Medicine",
      phone: "+251911000001",
      serviceId: generalMedicine.id
    },
    create: {
      name: "Dr. MohammedSani",
      specialization: "General Medicine",
      phone: "+251911000001",
      serviceId: generalMedicine.id
    }
  });
  
  const doctor2 = await prisma.doctor.upsert({
    where: {
      id: 2
    },
    update: {
      name: "Dr. Hana",
      specialization: "Dentist",
      phone: "+251911000002",
      serviceId: dental.id
    },
    create: {
      name: "Dr. Hana",
      specialization: "Dentist",
      phone: "+251911000002",
      serviceId: dental.id
    }
  });
  
  const doctor3 = await prisma.doctor.upsert({
    where: {
      id: 3
    },
    update: {
      name: "Dr. Umer",
      specialization: "Pediatrics",
      phone: "+251911000003",
      serviceId: pediatrics.id
    },
    create: {
      name: "Dr. Umer",
      specialization: "Pediatrics",
      phone: "+251911000003",
      serviceId: pediatrics.id
    }
  });

  // =========================
  // DOCTOR SCHEDULES
  // =========================

  // Monday-Friday = 1-5

  for (const day of [1, 2, 3, 4, 5]) {
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: doctor1.id,
          dayOfWeek: day
        }
      },
      update: {
        startTime: "09:00",
        endTime: "16:00"
      },
      create: {
        doctorId: doctor1.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "16:00"
      }
    });
  }

  for (const day of [1, 3, 5]) {
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: doctor2.id,
          dayOfWeek: day
        }
      },
      update: {
        startTime: "09:00",
        endTime: "15:00"
      },
      create: {
        doctorId: doctor2.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "15:00"
      }
    });
  }

  for (const day of [2, 4]) {
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek: {
          doctorId: doctor3.id,
          dayOfWeek: day
        }
      },
      update: {
        startTime: "10:00",
        endTime: "16:00"
      },
      create: {
        doctorId: doctor3.id,
        dayOfWeek: day,
        startTime: "10:00",
        endTime: "16:00"
      }
    });
  }

  console.log("✅ Clinic data created successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });