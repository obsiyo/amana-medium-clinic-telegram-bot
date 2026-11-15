
const { Telegraf, session } = require("telegraf");
const prisma = require("../prisma");
const { mainMenu } = require("./keyboards");

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session({
  defaultSession: () => ({})
}));
// ========================================
// ADMIN AUTHENTICATION
// ========================================

function isAdmin(ctx) {

  const adminIds = (
    process.env.ADMIN_TELEGRAM_IDS || ""
  )
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);

  const telegramId = String(ctx.from.id);

  return adminIds.includes(telegramId);
}

function getPatientName(patient) {
  const firstName = patient.firstName?.trim() || "";
  const lastName = patient.lastName?.trim() || "";

  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Valued Patient";
}
// ========================================
// START
// ========================================

bot.start(async (ctx) => {
  try {
    const user = await prisma.user.upsert({
      where: {
        telegramId: String(ctx.from.id),
      },

      // Preserve the corrected name of existing users
      update: {},

      // Register new users
      create: {
        telegramId: String(ctx.from.id),
        firstName: ctx.from.first_name || "Patient",
        lastName: ctx.from.last_name || null,
        username: ctx.from.username || null,
      },
    });

    const patientName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "Valued Patient";

    await ctx.reply(
      `🏥 Welcome to Amana Medium Clinic, ${patientName}!\n\nHow can we help you today?`,
      mainMenu()
    );

  } catch (error) {
    console.error("Start handler error:", error);
    await ctx.reply("Sorry, something went wrong. Please try again.");
  }
});
// ========================================
// ADMIN MENU
// ========================================

bot.command("admin", async (ctx) => {

    if (!isAdmin(ctx)) {
  
      return ctx.reply(
        "⛔ Access Denied\n\n" +
        "You are not authorized to access the clinic administration panel."
      );
  
    }
  
    await ctx.reply(
      "👨‍💼 Amana Medium Clinic - Admin Panel\n\n" +
      "Welcome to the clinic administration system.\n\n" +
      "Please select an option:",
      {
        reply_markup: {
          inline_keyboard: [
  
            [
              {
                text: "📋 Pending Appointments",
                callback_data: "ADMIN_PENDING"
              }
            ],
  
            [
              {
                text: "📅 Today's Appointments",
                callback_data: "ADMIN_TODAY"
              }
            ],
            [
              {
                text: "📚 All Appointments",
                callback_data: "ADMIN_ALL_APPOINTMENTS"
              }
            ],
            [
              {
                text: "🔎 Search Appointments",
                callback_data: "ADMIN_SEARCH_APPOINTMENTS"
              }
            ],
            [
              {
                text: "📊 Filter Appointments",
                callback_data: "ADMIN_FILTER_APPOINTMENTS"
              }
            ],
            [
              {
                text: "👨‍⚕️ Manage Doctors",
                callback_data: "ADMIN_DOCTORS"
              }
            ],
  
            [
              {
                text: "🏥 Manage Services",
                callback_data: "ADMIN_SERVICES"
              }
            ],
  
            [
              {
                text: "❌ Close Admin Panel",
                callback_data: "ADMIN_CLOSE"
              }
            ]
  
          ]
        }
      }
    );
  });
  // ========================================
// ADMIN - PENDING APPOINTMENTS
// ========================================

bot.action("ADMIN_PENDING", async (ctx) => {

    await ctx.answerCbQuery();
  
    if (!isAdmin(ctx)) {
      return ctx.reply(
        "⛔ Access Denied."
      );
    }
  
    try {
  
      const appointments =
        await prisma.appointment.findMany({
          where: {
            status: "PENDING"
          },
          include: {
            patient: true,
            doctor: true,
            service: true
          },
          orderBy: {
            appointmentDate: "asc"
          }
        });
  
      if (appointments.length === 0) {
  
        return ctx.reply(
          "📋 Pending Appointments\n\n" +
          "There are currently no pending appointments."
        );
  
      }
  
      for (const appointment of appointments) {
  
        await ctx.reply(
          `📋 Appointment #${appointment.id}\n\n` +
  
          `👤 Patient: ${
            appointment.patient.firstName || "Unknown"
          }\n` +
  
          `📱 Telegram ID: ${
            appointment.patient.telegramId
          }\n` +
  
          `🏥 Service: ${
            appointment.service.name
          }\n` +
  
          `👨‍⚕️ Doctor: ${
            appointment.doctor.name
          }\n` +
  
          `📅 Date: ${
            appointment.appointmentDate.toLocaleDateString()
          }\n` +
  
          `⏰ Time: ${
            appointment.appointmentTime
          }\n` +
  
          `💰 Price: ${
            appointment.service.price
          } ETB\n\n` +
  
          `📌 Status: ${
            appointment.status
          }`,
  
          {
            reply_markup: {
              inline_keyboard: [
  
                [
                  {
                    text: "✅ Approve",
                    callback_data:
                      `ADMIN_APPROVE_${appointment.id}`
                  },
  
                  {
                    text: "❌ Reject",
                    callback_data:
                      `ADMIN_REJECT_${appointment.id}`
                  }
                ]
  
              ]
            }
          }
        );
  
      }
  
    } catch (error) {
  
      console.error(
        "Error loading pending appointments:",
        error
      );
  
      await ctx.reply(
        "❌ Unable to load pending appointments."
      );
  
    }
  
  });
  // ========================================
// ADMIN - APPROVE APPOINTMENT
// ========================================


// ================= APPROVE APPOINTMENT =================

bot.action(/^ADMIN_APPROVE_(\d+)$/, async (ctx) => {
  try {
    if (!isAdmin(ctx)) {
      return ctx.answerCbQuery("Access denied.");
    }

    await ctx.answerCbQuery();

    const appointmentId = Number(ctx.match[1]);

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    // Prevent approving an already processed appointment
    if (appointment.status !== "PENDING") {
      return ctx.reply(
        `⚠️ This appointment is already ${appointment.status}.`
      );
    }

    // Update appointment status
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CONFIRMED"
      }
    });

    // Format appointment date
    const appointmentDate = new Date(
      appointment.appointmentDate
    ).toISOString().slice(0, 10);

    // Prepare patient notification
    const patientMessage =
      `✅ APPOINTMENT CONFIRMED!\n\n` +
      `Hello ${appointment.patient.firstName || "Patient"}!\n\n` +
      `Your appointment at Amana Medium Clinic has been confirmed.\n\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `🕒 Time: ${appointment.appointmentTime}\n\n` +
      `📌 Status: CONFIRMED\n\n` +
      `Thank you for choosing Amana Medium Clinic!`;

    // Send notification to patient
    let notificationSent = false;

    try {
      await bot.telegram.sendMessage(
        appointment.patient.telegramId,
        patientMessage
      );
      console.log(
        `✅ Admin cancellation notification delivered to patient: ${appointment.patient.telegramId}`
      );
      notificationSent = true;

    } catch (notificationError) {
      console.error(
        "Patient notification error:",
        notificationError
      );
    }

    // Inform administrator
    await ctx.reply(
      `✅ APPOINTMENT APPROVED!\n\n` +
      `Appointment ID: ${appointment.id}\n` +
      `Patient: ${appointment.patient.firstName || "Patient"}\n` +
      `Doctor: ${appointment.doctor.name}\n` +
      `Service: ${appointment.service.name}\n` +
      `Date: ${appointmentDate}\n` +
      `Time: ${appointment.appointmentTime}\n` +
      `Status: CONFIRMED\n\n` +
      (
        notificationSent
          ? "📩 Patient notification sent successfully."
          : "⚠️ Appointment approved, but the patient notification could not be delivered."
      )
    );

  } catch (error) {
    console.error("Approve appointment error:", error);

    await ctx.reply(
      "❌ Unable to approve this appointment. Please try again."
    );
  }
});

  // ========================================
// ADMIN - REJECT APPOINTMENT
// ========================================


 // ================= REJECT APPOINTMENT =================

 bot.action(/^ADMIN_REJECT_(\d+)$/, async (ctx) => {
  try {
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery("Access denied.");
      return;
    }

    await ctx.answerCbQuery();

    const appointmentId = Number(ctx.match[1]);

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: {
        id: appointmentId
      },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    if (appointment.status !== "PENDING") {
      return ctx.reply(
        `⚠️ Appointment is already ${appointment.status}.`
      );
    }

    // Update appointment status
    await prisma.appointment.update({
      where: {
        id: appointmentId
      },
      data: {
        status: "REJECTED"
      }
    });

    const appointmentDate =
      new Date(appointment.appointmentDate)
        .toISOString()
        .slice(0, 10);

    // Prepare patient notification
    const patientMessage =
      `❌ APPOINTMENT REJECTED\n\n` +
      `Hello ${appointment.patient.firstName || "Patient"}!\n\n` +
      `Unfortunately, your appointment request at Amana Medium Clinic has been rejected.\n\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `🕒 Time: ${appointment.appointmentTime}\n\n` +
      `📌 Status: REJECTED\n\n` +
      `Please contact Amana Medium Clinic for more information or assistance with booking another appointment.\n\n` +
      `Thank you for your understanding.`;

    // Send notification to patient
    let notificationSent = false;

    try {
      await bot.telegram.sendMessage(
        appointment.patient.telegramId,
        patientMessage
      );

      notificationSent = true;

    } catch (notificationError) {
      console.error(
        "Patient rejection notification error:",
        notificationError
      );
    }

    // Inform administrator
    await ctx.reply(
      `❌ APPOINTMENT REJECTED\n\n` +
      `Appointment ID: ${appointment.id}\n` +
      `Patient: ${appointment.patient.firstName || "Patient"}\n` +
      `Doctor: ${appointment.doctor.name}\n` +
      `Service: ${appointment.service.name}\n` +
      `Date: ${appointmentDate}\n` +
      `Time: ${appointment.appointmentTime}\n` +
      `Status: REJECTED\n\n` +
      (
        notificationSent
          ? "📩 Patient notification sent successfully."
          : "⚠️ Appointment rejected, but the patient notification could not be delivered."
      )
    );

  } catch (error) {
    console.error("Error rejecting appointment:", error);

    await ctx.reply(
      "❌ Unable to reject appointment. Please try again."
    );
  }
});

  // ========================================
// ADMIN - TODAY'S APPOINTMENTS
// ========================================

bot.action("ADMIN_TODAY", async (ctx) => {

    await ctx.answerCbQuery();
  
    if (!isAdmin(ctx)) {
      return ctx.reply(
        "⛔ Access Denied."
      );
    }
  
    try {
  
      const now = new Date();
  
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
  
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
  
      const appointments =
        await prisma.appointment.findMany({
          where: {
            appointmentDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: {
            patient: true,
            doctor: true,
            service: true
          },
          orderBy: {
            appointmentTime: "asc"
          }
        });
  
      if (appointments.length === 0) {
        return ctx.reply(
          "📅 Today's Appointments\n\n" +
          "No appointments scheduled for today."
        );
      }
  
      let message =
        "📅 Today's Appointments\n\n";
  
      appointments.forEach((appointment) => {
  
        message +=
          `🆔 #${appointment.id}\n` +
          `👤 ${appointment.patient.firstName || "Unknown"}\n` +
          `🏥 ${appointment.service.name}\n` +
          `👨‍⚕️ ${appointment.doctor.name}\n` +
          `⏰ ${appointment.appointmentTime}\n` +
          `📌 ${appointment.status}\n\n`;
  
      });
  
      await ctx.reply(message);
  
    } catch (error) {
  
      console.error(
        "Error loading today's appointments:",
        error
      );
  
      await ctx.reply(
        "❌ Unable to load today's appointments."
      );
  
    }
  
  });

// ========================================
// ADMIN - ALL APPOINTMENTS
// ========================================

bot.action("ADMIN_ALL_APPOINTMENTS", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const appointments = await prisma.appointment.findMany({
      include: {
        patient: true,
        doctor: true,
        service: true
      },
      orderBy: {
        appointmentDate: "desc"
      },
      take: 10
    });

    if (appointments.length === 0) {
      return ctx.reply(
        "📚 All Appointments\n\n" +
        "No appointments have been registered yet."
      );
    }

    await ctx.reply(
      "📚 ALL APPOINTMENTS\n\n" +
      `Showing the ${appointments.length} most recent appointments.`
    );

    for (const appointment of appointments) {

   
      const message =
      `📋 Appointment #${appointment.id}\n\n` +
      `👤 Patient: ${appointment.patient.firstName || "Unknown"}\n` +
      `📱 Telegram ID: ${appointment.patient.telegramId}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
      `⏰ Time: ${appointment.appointmentTime}\n` +
      `💰 Price: ${appointment.service.price} ETB\n` +
      `📌 Status: ${appointment.status}`;
    
    const options = ["PENDING", "CONFIRMED"].includes(appointment.status)
      ? {
          reply_markup: {
            inline_keyboard: [[
              {
                text: "❌ Cancel Appointment",
                callback_data: `ADMIN_CANCEL_APPT_${appointment.id}`
              }
            ]]
          }
        }
      : {};
    
    await ctx.reply(message, options);


    }

  } catch (error) {

    console.error("❌ Error loading all appointments:", error);

    await ctx.reply(
      "❌ Unable to load all appointments."
    );
  }

});

 // ================= ADMIN CANCEL APPOINTMENT =================

 


// ================= ADMIN CONFIRM CANCELLATION =================

bot.action(/^ADMIN_CONFIRM_CANCEL_(\d+)$/, async (ctx) => {
  try {
    if (!isAdmin(ctx)) {
      return ctx.answerCbQuery("Access denied.");
    }

    await ctx.answerCbQuery();

    const appointmentId = Number(ctx.match[1]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return ctx.reply(
        `⚠️ Appointment is already ${appointment.status}.`
      );
    }

    // Update only if appointment is still pending or confirmed
    const updateResult = await prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        status: appointment.status
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (updateResult.count === 0) {
      return ctx.reply(
        "⚠️ This appointment has already been processed."
      );
    }

    const appointmentDate =
      appointment.appointmentDate.toLocaleDateString();

    // Notify patient
    let notificationSent = false;

    const patientMessage =
      `❌ APPOINTMENT CANCELLED BY THE CLINIC\n\n` +
      `Hello ${appointment.patient.firstName || "Patient"}!\n\n` +
      `We regret to inform you that your appointment at Amana Medium Clinic has been cancelled by the clinic administrator.\n\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `🕒 Time: ${appointment.appointmentTime}\n\n` +
      `📌 Status: CANCELLED\n\n` +
      `Please contact Amana Medium Clinic for assistance with rescheduling.\n\n` +
      `We apologize for any inconvenience.`;

      
try {
  const result = await bot.telegram.sendMessage(
    String(appointment.patient.telegramId),
    patientMessage
  );

  notificationSent = true;

  console.log("✅ Admin cancellation notification delivered.");
  console.log("Patient Telegram ID:", appointment.patient.telegramId);
  console.log("Telegram Message ID:", result.message_id);

} catch (notificationError) {
  notificationSent = false;

  console.error("❌ Admin cancellation notification failed:");
  console.error(notificationError);

}

    // Inform administrator
    await ctx.reply(
      `✅ APPOINTMENT CANCELLED BY ADMINISTRATOR\n\n` +
      `Appointment ID: ${appointment.id}\n` +
      `Patient: ${appointment.patient.firstName || "Patient"}\n` +
      `Doctor: ${appointment.doctor.name}\n` +
      `Service: ${appointment.service.name}\n` +
      `Date: ${appointmentDate}\n` +
      `Time: ${appointment.appointmentTime}\n` +
      `Status: CANCELLED\n\n` +
      (
        notificationSent
          ? "📩 Patient notification sent successfully."
          : "⚠️ Appointment cancelled, but the patient notification could not be delivered."
      )
    );

  } catch (error) {
    console.error("Admin appointment cancellation error:", error);

    await ctx.reply(
      "❌ Unable to cancel appointment. Please try again."
    );
  }
});
// ADMIN: Request appointment cancellation
bot.action(/^ADMIN_CANCEL_APPT_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Access Denied.");
    }

    const appointmentId = Number(ctx.match[1]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return ctx.reply(
        `⚠️ This appointment cannot be cancelled.\n\nCurrent status: ${appointment.status}`
      );
    }

    await ctx.reply(
      `⚠️ CONFIRM APPOINTMENT CANCELLATION\n\n` +
      `🆔 Appointment ID: ${appointment.id}\n` +
      `👤 Patient: ${appointment.patient.firstName || "Unknown"}\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
      `⏰ Time: ${appointment.appointmentTime}\n\n` +
      `Are you sure you want to cancel this appointment?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Yes, Cancel",
                callback_data: `ADMIN_CONFIRM_CANCEL_${appointment.id}`
              }
            ],
            [
              {
                text: "↩️ Keep Appointment",
                callback_data: "ADMIN_ALL_APPOINTMENTS"
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Admin cancellation request error:", error);
    await ctx.reply("❌ Unable to process the cancellation request.");
  }
});


// ADMIN: Confirm appointment cancellation
bot.action(/^ADMIN_CONFIRM_CANCEL_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Access Denied.");
    }

    const appointmentId = Number(ctx.match[1]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return ctx.reply(
        `⚠️ This appointment has already been processed.\n\nCurrent status: ${appointment.status}`
      );
    }

    const updateResult = await prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        status: { in: ["PENDING", "CONFIRMED"] }
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (updateResult.count === 0) {
      return ctx.reply("⚠️ This appointment has already been processed.");
    }

    const appointmentDate = new Date(appointment.appointmentDate)
      .toISOString()
      .slice(0, 10);

    await ctx.reply(
      `✅ APPOINTMENT CANCELLED\n\n` +
      `🆔 Appointment ID: ${appointment.id}\n` +
      `👤 Patient: ${appointment.patient.firstName || "Unknown"}\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `⏰ Time: ${appointment.appointmentTime}\n\n` +
      `The appointment has been cancelled successfully.`
    );

    // Notify patient
    try {
      await bot.telegram.sendMessage(
        appointment.patient.telegramId,
        `❌ APPOINTMENT CANCELLED BY CLINIC\n\n` +
        `Dear ${appointment.patient.firstName || "Patient"},\n\n` +
        `Your appointment has been cancelled by the clinic administrator.\n\n` +
        `🆔 Appointment ID: ${appointment.id}\n` +
        `🏥 Service: ${appointment.service.name}\n` +
        `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
        `📅 Date: ${appointmentDate}\n` +
        `⏰ Time: ${appointment.appointmentTime}\n\n` +
        `For assistance or to book another appointment, please contact Amana Medium Clinic.`
      );

      await ctx.reply("✅ Patient notification sent successfully.");
    } catch (notificationError) {
      console.error("Patient cancellation notification failed:", notificationError);
      await ctx.reply(
        "⚠️ Appointment cancelled, but the patient notification could not be delivered."
      );
    }

  } catch (error) {
    console.error("Admin appointment cancellation error:", error);
    await ctx.reply("❌ Unable to cancel the appointment. Please try again.");
  }
});
// ========================================
// ADMIN - SEARCH APPOINTMENTS
// ========================================

bot.action("ADMIN_SEARCH_APPOINTMENTS", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  ctx.session.appointmentSearch = true;

  await ctx.reply(
    "🔎 Search Appointments\n\n" +
    "Enter any of the following:\n\n" +
    "• Appointment ID\n" +
    "• Patient first name\n" +
    "• Patient last name\n" +
    "• Patient Telegram username\n\n" +
    "Example: Ahmed or 12",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "❌ Cancel Search",
            callback_data: "CANCEL_APPOINTMENT_SEARCH"
          }]
        ]
      }
    }
  );

});

// ========================================
// ADMIN - APPOINTMENT STATUS FILTER MENU
// ========================================

bot.action("ADMIN_FILTER_APPOINTMENTS", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  await ctx.reply(
    "📊 Filter Appointments by Status\n\n" +
    "Select the appointment status you want to view:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🟡 Pending",
              callback_data: "FILTER_APPOINTMENTS_PENDING"
            }
          ],
          [
            {
              text: "🟢 Confirmed",
              callback_data: "FILTER_APPOINTMENTS_CONFIRMED"
            }
          ],
          [
            {
              text: "🔴 Rejected",
              callback_data: "FILTER_APPOINTMENTS_REJECTED"
            }
          ],
          [
            {
              text: "⚫ Cancelled",
              callback_data: "FILTER_APPOINTMENTS_CANCELLED"
            }
          ],
          [
            {
              text: "🔙 Admin Panel",
              callback_data: "ADMIN_CLOSE"
            }
          ]
        ]
      }
    }
  );

});


// ========================================
// ADMIN - FILTER APPOINTMENTS BY STATUS
// ========================================

bot.action(
  /^FILTER_APPOINTMENTS_(PENDING|CONFIRMED|REJECTED|CANCELLED)$/,
  async (ctx) => {

    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Access Denied.");
    }

    try {

      const status = ctx.match[1];

      const appointments = await prisma.appointment.findMany({

        where: {
          status: status
        },

        include: {
          patient: true,
          doctor: true,
          service: true
        },

        orderBy: {
          appointmentDate: "desc"
        },

        take: 10

      });

      const statusLabels = {
        PENDING: "🟡 Pending",
        CONFIRMED: "🟢 Confirmed",
        REJECTED: "🔴 Rejected",
        CANCELLED: "⚫ Cancelled"
      };

      if (appointments.length === 0) {

        return ctx.reply(
          `📊 ${statusLabels[status]} Appointments\n\n` +
          "No appointments found with this status.",
          {
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "🔙 Back to Filters",
                  callback_data: "ADMIN_FILTER_APPOINTMENTS"
                }],
                [{
                  text: "🏠 Admin Panel",
                  callback_data: "ADMIN_CLOSE"
                }]
              ]
            }
          }
        );

      }

      await ctx.reply(
        `📊 ${statusLabels[status]} Appointments\n\n` +
        `Found: ${appointments.length}\n` +
        "Showing the 10 most recent appointments."
      );

      for (const appointment of appointments) {

        const patientName = [
          appointment.patient.firstName,
          appointment.patient.lastName
        ].filter(Boolean).join(" ") || "Unknown";

        await ctx.reply(
          `📋 Appointment #${appointment.id}\n\n` +
          `👤 Patient: ${patientName}\n` +
          `📱 Telegram ID: ${appointment.patient.telegramId}\n` +
          `🏥 Service: ${appointment.service.name}\n` +
          `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
          `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
          `⏰ Time: ${appointment.appointmentTime}\n` +
          `💰 Price: ${appointment.service.price} ETB\n` +
          `📌 Status: ${statusLabels[status]}`
        );

      }

      await ctx.reply(
        "What would you like to do next?",
        {
          reply_markup: {
            inline_keyboard: [
              [{
                text: "🔄 Change Filter",
                callback_data: "ADMIN_FILTER_APPOINTMENTS"
              }],
              [{
                text: "🔙 Admin Panel",
                callback_data: "ADMIN_CLOSE"
              }]
            ]
          }
        }
      );

    } catch (error) {

      console.error(
        "❌ Error filtering appointments:",
        error
      );

      await ctx.reply(
        "❌ Unable to filter appointments. Please check the server console."
      );

    }

  }
);


// ========================================
// ADMIN - PROCESS APPOINTMENT SEARCH
// ========================================

bot.on("text", async (ctx, next) => {

  if (!ctx.session?.appointmentSearch) {
    return next();
  }

  if (!isAdmin(ctx)) {
    ctx.session.appointmentSearch = null;
    return ctx.reply("⛔ Access Denied.");
  }

  const keyword = ctx.message.text.trim();

  if (!keyword) {
    return ctx.reply("❌ Please enter a search term.");
  }

  ctx.session.appointmentSearch = null;

  try {

    const searchConditions = [];

    // Search by appointment ID when input is numeric
    if (/^\d+$/.test(keyword)) {
      searchConditions.push({
        id: Number(keyword)
      });
    }

    // Search by patient first name
    searchConditions.push({
      patient: {
        is: {
          firstName: {
            contains: keyword,
            mode: "insensitive"
          }
        }
      }
    });

    // Search by patient last name
    searchConditions.push({
      patient: {
        is: {
          lastName: {
            contains: keyword,
            mode: "insensitive"
          }
        }
      }
    });

    // Search by Telegram username
    searchConditions.push({
      patient: {
        is: {
          username: {
            contains: keyword.replace(/^@/, ""),
            mode: "insensitive"
          }
        }
      }
    });

    const appointments = await prisma.appointment.findMany({

      where: {
        OR: searchConditions
      },

      include: {
        patient: true,
        doctor: true,
        service: true
      },

      orderBy: {
        appointmentDate: "desc"
      },

      take: 10

    });

    if (appointments.length === 0) {
      return ctx.reply(
        "🔎 Search Results\n\n" +
        `No appointments found for: ${keyword}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{
                text: "🔎 Search Again",
                callback_data: "ADMIN_SEARCH_APPOINTMENTS"
              }],
              [{
                text: "🔙 Admin Panel",
                callback_data: "ADMIN_CLOSE"
              }]
            ]
          }
        }
      );
    }

    let message =
      "🔎 APPOINTMENT SEARCH RESULTS\n\n" +
      `Search: ${keyword}\n` +
      `Results found: ${appointments.length}\n\n`;

    for (const appointment of appointments) {

      const patientName = [
        appointment.patient.firstName,
        appointment.patient.lastName
      ].filter(Boolean).join(" ") || "Unknown";

      message +=
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 Appointment ID: #${appointment.id}\n` +
        `👤 Patient: ${patientName}\n` +
        `📱 Username: @${appointment.patient.username || "Not set"}\n` +
        `🏥 Service: ${appointment.service.name}\n` +
        `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
        `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
        `⏰ Time: ${appointment.appointmentTime}\n` +
        `📌 Status: ${appointment.status}\n\n`;
    }

    message +=
      "━━━━━━━━━━━━━━━━━━\n" +
      "Showing up to 10 matching appointments.";

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🔎 Search Again",
            callback_data: "ADMIN_SEARCH_APPOINTMENTS"
          }],
          [{
            text: "🔙 Admin Panel",
            callback_data: "ADMIN_CLOSE"
          }]
        ]
      }
    });

  } catch (error) {

    console.error("❌ Appointment search error:", error);

    await ctx.reply(
      "❌ Unable to search appointments.\n\n" +
      "Please check the server console."
    );

  }

});


// ========================================
// ADMIN - CANCEL APPOINTMENT SEARCH
// ========================================

bot.action("CANCEL_APPOINTMENT_SEARCH", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  ctx.session.appointmentSearch = null;

  await ctx.reply(
    "❌ Appointment search cancelled.",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🔙 Admin Panel",
            callback_data: "ADMIN_CLOSE"
          }]
        ]
      }
    }
  );

});


  // ========================================
// ADMIN - DOCTORS
// ========================================
// ====================================

bot.action("ADMIN_DOCTORS", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    // Get all doctors
    const doctors = await prisma.doctor.findMany({
      orderBy: {
        id: "asc"
      }
    });

    let message = "👨‍⚕️ Manage Doctors\n\n";

    if (doctors.length === 0) {
      message += "No doctors have been registered yet.\n\n";
    }

    const buttons = [];

    for (const doctor of doctors) {

      // Get the doctor's service separately
      let serviceName = "N/A";

      if (doctor.serviceId) {

        const service = await prisma.service.findUnique({
          where: {
            id: doctor.serviceId
          }
        });

        if (service) {
          serviceName = service.name;
        }
      }

      message +=
        `👨‍⚕️ ${doctor.name}\n` +
        `Specialization: ${doctor.specialization}\n` +
        `📞 Phone: ${doctor.phone || "N/A"}\n` +
        `🏥 Service: ${serviceName}\n` +
        `📌 Status: ${
          doctor.status ? "🟢 Active" : "🔴 Inactive"
        }\n\n`;

      buttons.push([
        {
          text: `✏️ Edit ${doctor.name}`,
          callback_data: `EDIT_DOCTOR_${doctor.id}`
        }
      ]);
    }
   
// ========================================

    
    // Add doctor button
    buttons.push([
      {
        text: "➕ Add Doctor",
        callback_data: "ADD_DOCTOR"
      }
    ]);

    // Back to admin
    buttons.push([
      {
        text: "🔙 Back to Admin",
        callback_data: "ADMIN_PANEL"
      }
    ]);

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: buttons
      }
    });

  } catch (error) {

    console.error("❌ Error loading doctors:", error);

    await ctx.reply(
      "❌ Unable to load doctors.\n\n" +
      "Please check the server console for the error."
    );
  }

});

// ========================================
// ADMIN - EDIT DOCTOR MENU
// ========================================

bot.action(/^EDIT_DOCTOR_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {
    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: {
        id: doctorId
      },
      include: {
        service: true,
        schedules: {
          orderBy: {
            dayOfWeek: "asc"
          }
        }
      }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday"
    };

    const workingDays = doctor.schedules.length
      ? doctor.schedules
          .map(schedule => dayNames[schedule.dayOfWeek])
          .join(", ")
      : "Not configured";

    await ctx.reply(
      "👨‍⚕️ DOCTOR DETAILS\n\n" +
      `Name: ${doctor.name}\n` +
      `Specialization: ${doctor.specialization}\n` +
      `Phone: ${doctor.phone || "Not set"}\n` +
      `Service: ${doctor.service?.name || "Not assigned"}\n` +
      `Working Days: ${workingDays}\n` +
      `Status: ${doctor.status ? "🟢 Active" : "🔴 Inactive"}\n\n` +
      "Select what you want to edit:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✏️ Edit Name",
                callback_data: `EDIT_DOCTOR_NAME_${doctorId}`
              }
            ],
            [
              {
                text: "🩺 Edit Specialization",
                callback_data: `EDIT_DOCTOR_SPECIALIZATION_${doctorId}`
              }
            ],
            [
              {
                text: "📞 Edit Phone",
                callback_data: `EDIT_DOCTOR_PHONE_${doctorId}`
              }
            ],
            [
              {
                text: "🏥 Change Service",
                callback_data: `EDIT_DOCTOR_SERVICE_${doctorId}`
              }
            ],
            [
              {
                text: "📅 Edit Working Schedule",
                callback_data: `EDIT_DOCTOR_SCHEDULE_${doctorId}`
              }
            ],
            [
              {
                text: doctor.status
                  ? "🔴 Deactivate Doctor"
                  : "🟢 Activate Doctor",
                callback_data: `TOGGLE_DOCTOR_STATUS_${doctorId}`
              }
            ],
            [
              {
                text: "🔙 Back to Doctors",
                callback_data: "ADMIN_DOCTORS"
              }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error("❌ Error opening doctor menu:", error);
    await ctx.reply("❌ Unable to load doctor details.");
  }
});

// ========================================
// ADMIN - START EDIT DOCTOR NAME
// ========================================

bot.action(/^EDIT_DOCTOR_NAME_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {
    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    ctx.session.editDoctor = {
      doctorId,
      field: "name"
    };

    await ctx.reply(
      "✏️ Edit Doctor Name\n\n" +
      `Current Name: ${doctor.name}\n\n` +
      "Enter the doctor's new full name:"
    );

  } catch (error) {
    console.error("❌ Error starting name edit:", error);
    await ctx.reply("❌ Unable to edit doctor name.");
  }
});

// ========================================
// ADMIN - START EDIT DOCTOR SPECIALIZATION
// ========================================

bot.action(/^EDIT_DOCTOR_SPECIALIZATION_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {
    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    ctx.session.editDoctor = {
      doctorId,
      field: "specialization"
    };

    await ctx.reply(
      "🩺 Edit Doctor Specialization\n\n" +
      `Current Specialization: ${doctor.specialization}\n\n` +
      "Enter the new specialization:"
    );

  } catch (error) {
    console.error("❌ Error starting specialization edit:", error);
    await ctx.reply("❌ Unable to edit specialization.");
  }
});


// ========================================
// SAVE EDITED DOCTOR NAME / SPECIALIZATION
// ========================================

bot.on("text", async (ctx, next) => {
  const edit = ctx.session?.editDoctor;

  if (!edit || !["name", "specialization"].includes(edit.field)) {
    return next();
  }

  if (!isAdmin(ctx)) {
    ctx.session.editDoctor = null;
    return ctx.reply("⛔ Access Denied.");
  }

  const value = ctx.message.text.trim();

  if (!value) {
    return ctx.reply("❌ This field cannot be empty. Please try again.");
  }

  if (value.length > 100) {
    return ctx.reply("❌ Please enter no more than 100 characters.");
  }

  try {
    const doctor = await prisma.doctor.update({
      where: { id: edit.doctorId },
      data: {
        [edit.field]: value
      }
    });

    ctx.session.editDoctor = null;

    const fieldLabel =
      edit.field === "name" ? "Name" : "Specialization";

    await ctx.reply(
      `✅ Doctor ${fieldLabel} Updated!\n\n` +
      `👨‍⚕️ Name: ${doctor.name}\n` +
      `🩺 Specialization: ${doctor.specialization}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "✏️ Edit Doctor Again",
              callback_data: `EDIT_DOCTOR_${doctor.id}`
            }],
            [{
              text: "🔙 Back to Doctors",
              callback_data: "ADMIN_DOCTORS"
            }]
          ]
        }
      }
    );

  } catch (error) {
    console.error("❌ Error updating doctor:", error);
    await ctx.reply("❌ Unable to update doctor information.");
  }
});


// ========================================
// ADMIN - EDIT DOCTOR PHONE
// ========================================

bot.action(/^EDIT_DOCTOR_PHONE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  const doctorId = Number(ctx.match[1]);

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId }
  });

  if (!doctor) {
    return ctx.reply("❌ Doctor not found.");
  }

  ctx.session.editDoctor = {
    doctorId: doctorId,
    field: "phone"
  };

  await ctx.reply(
    "📞 Edit Doctor Phone Number\n\n" +
    `Current Phone: ${doctor.phone || "Not set"}\n\n` +
    "Please enter the new phone number.\n\n" +
    "Example: +251911223344"
  );

});


// ========================================
// SAVE EDITED DOCTOR PHONE
// ========================================

bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.editDoctor ||
    ctx.session.editDoctor.field !== "phone"
  ) {
    return next();
  }

  const newPhone = ctx.message.text.trim();
  const doctorId = ctx.session.editDoctor.doctorId;

  if (!/^\+2519\d{8}$/.test(newPhone)) {
    return ctx.reply(
      "❌ Invalid phone number.\n\n" +
      "Please use this format:\n" +
      "+251911223344"
    );
  }

  try {

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        phone: newPhone
      }
    });

    ctx.session.editDoctor = null;

    await ctx.reply(
      "✅ Doctor Phone Updated!\n\n" +
      `👨‍⚕️ Doctor: ${doctor.name}\n` +
      `📞 New Phone: ${doctor.phone}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✏️ Edit Doctor Again",
                callback_data: `EDIT_DOCTOR_${doctor.id}`
              }
            ],
            [
              {
                text: "🔙 Back to Doctors",
                callback_data: "ADMIN_DOCTORS"
              }
            ]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error updating doctor phone:", error);

    await ctx.reply(
      "❌ Unable to update doctor phone number."
    );
  }

});

// ========================================
// ADMIN - CHANGE DOCTOR SERVICE
// ========================================

bot.action(/^EDIT_DOCTOR_SERVICE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    const services = await prisma.service.findMany({
      where: { status: true },
      orderBy: { name: "asc" }
    });

    if (services.length === 0) {
      return ctx.reply("❌ No active clinic services available.");
    }

    const buttons = services.map((service) => [
      {
        text:
          `${service.id === doctor.serviceId ? "✅ " : "🏥 "}` +
          service.name,
        callback_data: `SET_DOCTOR_SERVICE_${doctorId}_${service.id}`
      }
    ]);

    buttons.push([
      {
        text: "🔙 Back to Edit Doctor",
        callback_data: `EDIT_DOCTOR_${doctorId}`
      }
    ]);

    await ctx.reply(
      "🏥 Change Doctor Service\n\n" +
      `👨‍⚕️ Doctor: ${doctor.name}\n` +
      `Current Service ID: ${doctor.serviceId || "Not assigned"}\n\n` +
      "Please select the new service:",
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );

  } catch (error) {

    console.error("❌ Error loading doctor services:", error);

    await ctx.reply("❌ Unable to load clinic services.");
  }

});


// ========================================
// SAVE DOCTOR SERVICE
// ========================================

bot.action(/^SET_DOCTOR_SERVICE_(\d+)_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const doctorId = Number(ctx.match[1]);
    const serviceId = Number(ctx.match[2]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!service || !service.status) {
      return ctx.reply("❌ Selected service is unavailable.");
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        serviceId: serviceId
      }
    });

    await ctx.reply(
      "✅ Doctor Service Updated!\n\n" +
      `👨‍⚕️ Doctor: ${updatedDoctor.name}\n` +
      `🏥 New Service: ${service.name}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✏️ Edit Doctor Again",
                callback_data: `EDIT_DOCTOR_${doctorId}`
              }
            ],
            [
              {
                text: "🔙 Back to Doctors",
                callback_data: "ADMIN_DOCTORS"
              }
            ]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error updating doctor service:", error);

    await ctx.reply("❌ Unable to update doctor service.");
  }

});

// ========================================
// ADMIN - ACTIVATE / DEACTIVATE DOCTOR
// ========================================

bot.action(/^TOGGLE_DOCTOR_STATUS_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    // Reverse the current status
    const newStatus = !doctor.status;

    const updatedDoctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        status: newStatus
      }
    });

    await ctx.reply(
        (newStatus
          ? "✅ Doctor Activated Successfully!\n\n"
          : "🔴 Doctor Deactivated Successfully!\n\n") +
        `👨‍⚕️ Doctor: ${updatedDoctor.name}\n` +
        `📌 Status: ${newStatus ? "🟢 Active" : "🔴 Inactive"}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✏️ Edit Doctor",
                  callback_data: `EDIT_DOCTOR_${doctorId}`
                }
              ],
              [
                {
                  text: "🔙 Back to Doctors",
                  callback_data: "ADMIN_DOCTORS"
                }
              ]
            ]
          }
        }
      );

  } catch (error) {

    console.error("❌ Error changing doctor status:", error);

    await ctx.reply(
      "❌ Unable to change doctor status."
    );
  }

});

// ========================================
// ADMIN - ADD DOCTOR
// ========================================

bot.action("ADD_DOCTOR", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  // Start the add-doctor conversation
  ctx.session = ctx.session || {};
  ctx.session.addDoctor = {
    step: "NAME"
  };

  await ctx.reply(
    "➕ Add New Doctor\n\n" +
    "Please enter the doctor's full name:\n\n" +
    "Example: Dr. Ahmed Ali"
  );

});
// ========================================
// ADD DOCTOR - NAME
// ========================================

bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.addDoctor ||
    ctx.session.addDoctor.step !== "NAME"
  ) {
    return next();
  }

  ctx.session.addDoctor.name = ctx.message.text;
  ctx.session.addDoctor.step = "SPECIALIZATION";

  await ctx.reply(
    "👨‍⚕️ Doctor Name: " +
    ctx.message.text +
    "\n\n" +
    "Please enter the doctor's specialization:\n\n" +
    "Example: General Medicine"
  );

});
// ========================================
// ADD DOCTOR - SPECIALIZATION
// ========================================

bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.addDoctor ||
    ctx.session.addDoctor.step !== "SPECIALIZATION"
  ) {
    return next();
  }

  const specialization = ctx.message.text.trim();

  if (!specialization) {
    return ctx.reply(
      "❌ Specialization cannot be empty.\n\n" +
      "Please enter the doctor's specialization:"
    );
  }

  ctx.session.addDoctor.specialization = specialization;
  ctx.session.addDoctor.step = "PHONE";

  await ctx.reply(
    `👨‍⚕️ Doctor: ${ctx.session.addDoctor.name}\n` +
    `🩺 Specialization: ${specialization}\n\n` +
    "Please enter the doctor's phone number:\n\n" +
    "Example: +251911000004"
  );

});
// ========================================
// ADD DOCTOR - PHONE
// ========================================

bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.addDoctor ||
    ctx.session.addDoctor.step !== "PHONE"
  ) {
    return next();
  }

  const phone = ctx.message.text.trim();

  // Basic Ethiopian phone validation
  const phonePattern = /^\+2519\d{8}$/;

  if (!phonePattern.test(phone)) {
    return ctx.reply(
      "❌ Invalid phone number.\n\n" +
      "Please enter a valid Ethiopian mobile number.\n\n" +
      "Example: +251911000004"
    );
  }

  ctx.session.addDoctor.phone = phone;
  ctx.session.addDoctor.step = "SERVICE";

  // Get available services
  const services = await prisma.service.findMany({
    where: {
      status: true
    },
    orderBy: {
      name: "asc"
    }
  });

  if (services.length === 0) {
    return ctx.reply(
      "❌ No active services are available.\n\n" +
      "Please add a service first."
    );
  }

  const buttons = services.map((service) => [
    {
      text: `🏥 ${service.name}`,
      callback_data: `ADD_DOCTOR_SERVICE_${service.id}`
    }
  ]);

  buttons.push([
    {
      text: "❌ Cancel",
      callback_data: "CANCEL_ADD_DOCTOR"
    }
  ]);

  await ctx.reply(
    `👨‍⚕️ Doctor: ${ctx.session.addDoctor.name}\n` +
    `🩺 Specialization: ${ctx.session.addDoctor.specialization}\n` +
    `📞 Phone: ${phone}\n\n` +
    "🏥 Please select the doctor's service:",
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );

});

// ========================================
// ADD DOCTOR - SELECT SERVICE
// ========================================

bot.action(/^ADD_DOCTOR_SERVICE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (
    !ctx.session ||
    !ctx.session.addDoctor
  ) {
    return ctx.reply(
      "❌ Add Doctor session expired.\n\n" +
      "Please start again."
    );
  }

  const serviceId = Number(ctx.match[1]);

  try {

    // Get selected service
    const service = await prisma.service.findUnique({
      where: {
        id: serviceId
      }
    });

    if (!service) {
      return ctx.reply(
        "❌ Service not found."
      );
    }

    // Get doctor information from session
    const doctorData = ctx.session.addDoctor;

    // Create doctor
    const doctor = await prisma.doctor.create({
      data: {
        name: doctorData.name,
        specialization: doctorData.specialization,
        phone: doctorData.phone,
        serviceId: serviceId
      }
    });

    // Clear add-doctor session
    ctx.session.addDoctor = null;

    await ctx.reply(
      "✅ Doctor Added Successfully!\n\n" +
  `👨‍⚕️ Name: ${doctor.name}\n` +
  `🩺 Specialization: ${doctor.specialization}\n` +
  `📞 Phone: ${doctor.phone}\n` +
  `🏥 Service: ${service.name}\n` +
  `📌 Status: ${doctor.status ? "🟢 Active" : "🔴 Inactive"}\n\n` +
  "Would you like to configure the doctor's working schedule?",
  {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📅 Set Working Schedule",
            callback_data: `SET_DOCTOR_SCHEDULE_${doctor.id}`
          }
        ],
        [
          {
            text: "🔙 Back to Doctors",
            callback_data: "ADMIN_DOCTORS"
          }
        ]
      ]
    }
  }
);

  } catch (error) {

    console.error(
      "❌ Error adding doctor:",
      error
    );

    await ctx.reply(
      "❌ Unable to add doctor.\n\n" +
      "Please check the server console."
    );

  }

});
bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.doctorSchedule ||
    ctx.session.doctorSchedule.step !== "START_TIME"
  ) {
    return next();
  }

  const time = ctx.message.text.trim();

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return ctx.reply(
      "❌ Invalid time.\n\n" +
      "Please use HH:MM format.\n\n" +
      "Example: 09:00"
    );
  }

  ctx.session.doctorSchedule.startTime = time;
  ctx.session.doctorSchedule.step = "END_TIME";

  await ctx.reply(
    `⏰ Start Time: ${time}\n\n` +
    "Now enter the ending time.\n\n" +
    "Example:\n" +
    "16:00"
  );

});
bot.on("text", async (ctx, next) => {

  if (
    !ctx.session ||
    !ctx.session.doctorSchedule ||
    ctx.session.doctorSchedule.step !== "END_TIME"
  ) {
    return next();
  }

  const endTime = ctx.message.text.trim();

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return ctx.reply(
      "❌ Invalid time.\n\n" +
      "Please use HH:MM format.\n\n" +
      "Example: 16:00"
    );
  }

  const schedule = ctx.session.doctorSchedule;

  if (schedule.startTime >= endTime) {
    return ctx.reply(
      "❌ End time must be later than start time."
    );
  }

  try {
  // When editing, remove days that were deselected
  if (schedule.editMode) {

    await prisma.doctorSchedule.deleteMany({
      where: {
        doctorId: schedule.doctorId,
        dayOfWeek: {
          notIn: schedule.selectedDays
        }
      }
    });

  }
    for (const day of schedule.selectedDays) {

      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek: {
            doctorId: schedule.doctorId,
            dayOfWeek: day
          }
        },
        update: {
          startTime: schedule.startTime,
          endTime: endTime
        },
        create: {
          doctorId: schedule.doctorId,
          dayOfWeek: day,
          startTime: schedule.startTime,
          endTime: endTime
        }
      });

    }

    const doctor = await prisma.doctor.findUnique({
      where: {
        id: schedule.doctorId
      }
    });
    ctx.session.doctorSchedule = null;
    
    // Convert day numbers to day names
    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday"
    };
    
    const workingDays = schedule.selectedDays
      .sort((a, b) => a - b)
      .map(day => dayNames[day])
      .join(", ");
    
    await ctx.reply(
      "✅ Working Schedule Saved!\n\n" +
      `👨‍⚕️ Doctor: ${doctor.name}\n` +
      `📅 Working Days: ${workingDays}\n` +
      `⏰ Time: ${schedule.startTime} - ${endTime}`
    );
    

  } catch (error) {

    console.error(
      "❌ Error saving doctor schedule:",
      error
    );

    await ctx.reply(
      "❌ Unable to save the doctor's schedule.\n\n" +
      "Please check the server console."
    );
  }

});

// ========================================
// ADMIN - EDIT DOCTOR WORKING SCHEDULE
// ========================================

bot.action(/^EDIT_DOCTOR_SCHEDULE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const doctorId = Number(ctx.match[1]);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId }
    });

    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }

    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: "asc" }
    });

    
if (schedules.length === 0) {
  return ctx.reply(
    "📅 No working schedule has been configured for this doctor.\n\n" +
    "Would you like to configure one now?",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "➕ Set Working Schedule",
            callback_data: `SET_DOCTOR_SCHEDULE_${doctorId}`
          }],
          [{
            text: "🔙 Back to Doctor",
            callback_data: `EDIT_DOCTOR_${doctorId}`
          }]
        ]
      }
    }
  );
}


    const selectedDays = schedules.map(
      schedule => schedule.dayOfWeek
    );

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday"
    };

    const workingDays = selectedDays
      .map(day => dayNames[day])
      .join(", ");

    const startTimes = [...new Set(
      schedules.map(s => s.startTime)
    )];

    const endTimes = [...new Set(
      schedules.map(s => s.endTime)
    )];

    ctx.session.doctorSchedule = {
      doctorId,
      selectedDays,
      step: "DAYS",
      editMode: true
    };

    await ctx.reply(
      "📅 Edit Doctor Working Schedule\n\n" +
      `👨‍⚕️ Doctor: ${doctor.name}\n` +
      `📅 Current Working Days: ${workingDays}\n` +
      `⏰ Current Start Time: ${startTimes.join(", ")}\n` +
      `⏰ Current End Time: ${endTimes.join(", ")}\n\n` +
      "Select or deselect the working days:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: selectedDays.includes(1) ? "✅ Monday" : "Monday",
                callback_data: "SCHEDULE_DAY_1"
              },
              {
                text: selectedDays.includes(2) ? "✅ Tuesday" : "Tuesday",
                callback_data: "SCHEDULE_DAY_2"
              }
            ],
            [
              {
                text: selectedDays.includes(3) ? "✅ Wednesday" : "Wednesday",
                callback_data: "SCHEDULE_DAY_3"
              },
              {
                text: selectedDays.includes(4) ? "✅ Thursday" : "Thursday",
                callback_data: "SCHEDULE_DAY_4"
              }
            ],
            [
              {
                text: selectedDays.includes(5) ? "✅ Friday" : "Friday",
                callback_data: "SCHEDULE_DAY_5"
              },
              {
                text: selectedDays.includes(6) ? "✅ Saturday" : "Saturday",
                callback_data: "SCHEDULE_DAY_6"
              }
            ],
            [
              {
                text: selectedDays.includes(7) ? "✅ Sunday" : "Sunday",
                callback_data: "SCHEDULE_DAY_7"
              }
            ],
            [
              {
                text: "✅ Continue",
                callback_data: "SCHEDULE_DAYS_DONE"
              }
            ]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error loading doctor schedule:", error);

    await ctx.reply("❌ Unable to load doctor working schedule.");
  }

});

// ========================================
// SCHEDULE - DAYS DONE
// ========================================

bot.action("SCHEDULE_DAYS_DONE", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (
    !ctx.session ||
    !ctx.session.doctorSchedule
  ) {
    return ctx.reply(
      "❌ Schedule session expired."
    );
  }

  const selectedDays =
    ctx.session.doctorSchedule.selectedDays;

  if (selectedDays.length === 0) {
    return ctx.reply(
      "❌ Please select at least one working day."
    );
  }

  ctx.session.doctorSchedule.step = "START_TIME";

  await ctx.reply(
    "⏰ Enter the starting time.\n\n" +
    "Use 24-hour format.\n\n" +
    "Example:\n" +
    "09:00"
  );

});

// ========================================
// SCHEDULE - SELECT DAY
// ========================================

bot.action(/^SCHEDULE_DAY_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (
    !ctx.session ||
    !ctx.session.doctorSchedule
  ) {
    return ctx.reply(
      "❌ Schedule session expired. Please start again."
    );
  }

  const day = Number(ctx.match[1]);

  const selectedDays =
    ctx.session.doctorSchedule.selectedDays;

  const index = selectedDays.indexOf(day);

  if (index === -1) {
    selectedDays.push(day);
  } else {
    selectedDays.splice(index, 1);
  }

  const dayNames = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday"
  };

  const selectedText =
    selectedDays.length > 0
      ? selectedDays
          .sort((a, b) => a - b)
          .map((d) => dayNames[d])
          .join(", ")
      : "None";

  await ctx.editMessageText(
    `📅 Working Schedule\n\n` +
    `Selected days:\n${selectedText}\n\n` +
    "Select or deselect days:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: selectedDays.includes(1)
                ? "✅ Monday"
                : "Monday",
              callback_data: "SCHEDULE_DAY_1"
            },
            {
              text: selectedDays.includes(2)
                ? "✅ Tuesday"
                : "Tuesday",
              callback_data: "SCHEDULE_DAY_2"
            }
          ],
          [
            {
              text: selectedDays.includes(3)
                ? "✅ Wednesday"
                : "Wednesday",
              callback_data: "SCHEDULE_DAY_3"
            },
            {
              text: selectedDays.includes(4)
                ? "✅ Thursday"
                : "Thursday",
              callback_data: "SCHEDULE_DAY_4"
            }
          ],
          [
            {
              text: selectedDays.includes(5)
                ? "✅ Friday"
                : "Friday",
              callback_data: "SCHEDULE_DAY_5"
            },
            {
              text: selectedDays.includes(6)
                ? "✅ Saturday"
                : "Saturday",
              callback_data: "SCHEDULE_DAY_6"
            }
          ],
          [
            {
              text: selectedDays.includes(7)
                ? "✅ Sunday"
                : "Sunday",
              callback_data: "SCHEDULE_DAY_7"
            }
          ],
          [
            {
              text: "✅ Continue",
              callback_data: "SCHEDULE_DAYS_DONE"
            }
          ]
        ]
      }
    }
  );

});

// ========================================
// ADMIN - SET DOCTOR SCHEDULE
// ========================================

bot.action(/^SET_DOCTOR_SCHEDULE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  const doctorId = Number(ctx.match[1]);

  const doctor = await prisma.doctor.findUnique({
    where: {
      id: doctorId
    }
  });

  if (!doctor) {
    return ctx.reply("❌ Doctor not found.");
  }

  ctx.session = ctx.session || {};

  ctx.session.doctorSchedule = {
    doctorId: doctorId,
    selectedDays: [],
    step: "DAYS"
  };

  await ctx.reply(
    `📅 Working Schedule\n\n` +
    `👨‍⚕️ Doctor: ${doctor.name}\n\n` +
    "Select the working days:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Monday",
              callback_data: "SCHEDULE_DAY_1"
            },
            {
              text: "Tuesday",
              callback_data: "SCHEDULE_DAY_2"
            }
          ],
          [
            {
              text: "Wednesday",
              callback_data: "SCHEDULE_DAY_3"
            },
            {
              text: "Thursday",
              callback_data: "SCHEDULE_DAY_4"
            }
          ],
          [
            {
              text: "Friday",
              callback_data: "SCHEDULE_DAY_5"
            },
            {
              text: "Saturday",
              callback_data: "SCHEDULE_DAY_6"
            }
          ],
          [
            {
              text: "Sunday",
              callback_data: "SCHEDULE_DAY_7"
            }
          ],
          [
            {
              text: "✅ Continue",
              callback_data: "SCHEDULE_DAYS_DONE"
            }
          ],
          [
            {
              text: "❌ Cancel",
              callback_data: "CANCEL_DOCTOR_SCHEDULE"
            }
          ]
        ]
      }
    }
  );

});

// ========================================
// ADMIN - CANCEL DOCTOR SCHEDULE
// ========================================

bot.action("CANCEL_DOCTOR_SCHEDULE", async (ctx) => {
  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (ctx.session) {
    ctx.session.doctorSchedule = null;
  }

  await ctx.reply(
    "❌ Doctor schedule operation cancelled.",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🔙 Back to Doctors",
            callback_data: "ADMIN_DOCTORS"
          }]
        ]
      }
    }
  );
});

// ========================================
// CANCEL ADD DOCTOR
// ========================================

bot.action("CANCEL_ADD_DOCTOR", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (ctx.session) {
    ctx.session.addDoctor = null;
  }

  await ctx.reply(
    "❌ Add Doctor cancelled."
  );

});

  // ========================================
  // ADMIN - SERVICES
  // ========================================
  
  
// ========================================
// ADMIN - MANAGE SERVICES
// ========================================

bot.action("ADMIN_SERVICES", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const services = await prisma.service.findMany({
      orderBy: { id: "asc" }
    });

    if (services.length === 0) {
      return ctx.reply(
        "🏥 No clinic services found.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add New Service", callback_data: "ADD_SERVICE" }],
              [{ text: "🔙 Back to Admin", callback_data: "ADMIN_CLOSE" }]
            ]
          }
        }
      );
    }

    for (const service of services) {

      await ctx.reply(
        `🏥 ${service.name}\n\n` +
        `📝 Description: ${service.description || "Not set"}\n` +
        `💰 Price: ${service.price} ETB\n` +
        `📌 Status: ${service.status ? "🟢 Active" : "🔴 Inactive"}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{
                text: `✏️ Edit ${service.name}`,
                callback_data: `EDIT_SERVICE_${service.id}`
              }]
            ]
          }
        }
      );

    }

    await ctx.reply(
      "🏥 Service Management\n\nSelect an option:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Add New Service", callback_data: "ADD_SERVICE" }],
            [{ text: "🔄 Refresh Services", callback_data: "ADMIN_SERVICES" }],
            [{ text: "🔙 Back to Admin", callback_data: "ADMIN_CLOSE" }]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error loading services:", error);

    await ctx.reply("❌ Unable to load clinic services.");
  }

});


// ========================================
// ADMIN - EDIT SERVICE MENU
// ========================================

bot.action(/^EDIT_SERVICE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const serviceId = Number(ctx.match[1]);

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) {
      return ctx.reply("❌ Service not found.");
    }

    await ctx.reply(
      "✏️ Edit Clinic Service\n\n" +
      `🏥 Name: ${service.name}\n` +
      `📝 Description: ${service.description || "Not set"}\n` +
      `💰 Price: ${service.price} ETB\n` +
      `📌 Status: ${service.status ? "🟢 Active" : "🔴 Inactive"}\n\n` +
      "What would you like to edit?",
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "✏️ Edit Name",
              callback_data: `EDIT_SERVICE_FIELD_${serviceId}_name`
            }],
            [{
              text: "📝 Edit Description",
              callback_data: `EDIT_SERVICE_FIELD_${serviceId}_description`
            }],
            [{
              text: "💰 Edit Price",
              callback_data: `EDIT_SERVICE_FIELD_${serviceId}_price`
            }],
            [{
              text: service.status ? "🔴 Deactivate Service" : "🟢 Activate Service",
              callback_data: `TOGGLE_SERVICE_${serviceId}`
            }],
            [{
              text: "🔙 Back to Services",
              callback_data: "ADMIN_SERVICES"
            }]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error opening service:", error);

    await ctx.reply("❌ Unable to open service details.");
  }

});


// ========================================
// ADMIN - START EDIT SERVICE FIELD
// ========================================

bot.action(/^EDIT_SERVICE_FIELD_(\d+)_(name|description|price)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  const serviceId = Number(ctx.match[1]);
  const field = ctx.match[2];

  const service = await prisma.service.findUnique({
    where: { id: serviceId }
  });

  if (!service) {
    return ctx.reply("❌ Service not found.");
  }

  ctx.session.serviceAdmin = {
    action: "EDIT",
    serviceId,
    field
  };

  const prompts = {
    name: "Please enter the new service name.",
    description: "Please enter the new service description.",
    price: "Please enter the new service price in ETB.\n\nExample: 750"
  };

  await ctx.reply(
    `✏️ Edit Service ${field.charAt(0).toUpperCase() + field.slice(1)}\n\n` +
    `Current Value: ${service[field]}\n\n` +
    prompts[field]
  );

});


// ========================================
// ADMIN - TOGGLE SERVICE STATUS
// ========================================

bot.action(/^TOGGLE_SERVICE_(\d+)$/, async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  try {

    const serviceId = Number(ctx.match[1]);

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) {
      return ctx.reply("❌ Service not found.");
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        status: !service.status
      }
    });

    await ctx.reply(
      (updatedService.status
        ? "✅ Service Activated Successfully!\n\n"
        : "🔴 Service Deactivated Successfully!\n\n") +
      `🏥 Service: ${updatedService.name}\n` +
      `📌 Status: ${updatedService.status ? "🟢 Active" : "🔴 Inactive"}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: "✏️ Edit Service",
              callback_data: `EDIT_SERVICE_${serviceId}`
            }],
            [{
              text: "🔙 Back to Services",
              callback_data: "ADMIN_SERVICES"
            }]
          ]
        }
      }
    );

  } catch (error) {

    console.error("❌ Error changing service status:", error);

    await ctx.reply("❌ Unable to change service status.");
  }

});


// ========================================
// ADMIN - ADD NEW SERVICE
// ========================================

bot.action("ADD_SERVICE", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  ctx.session.serviceAdmin = {
    action: "ADD",
    step: "NAME"
  };

  await ctx.reply(
    "➕ Add New Clinic Service\n\n" +
    "Please enter the service name.\n\n" +
    "Example: Cardiology Consultation",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Cancel", callback_data: "CANCEL_SERVICE_INPUT" }]
        ]
      }
    }
  );

});


// ========================================
// ADMIN - SAVE SERVICE INPUT
// ========================================

bot.on("text", async (ctx, next) => {

  const state = ctx.session?.serviceAdmin;

  if (!state) {
    return next();
  }

  if (!isAdmin(ctx)) {
    ctx.session.serviceAdmin = null;
    return ctx.reply("⛔ Access Denied.");
  }

  const value = ctx.message.text.trim();

  if (!value) {
    return ctx.reply("❌ This field cannot be empty. Please try again.");
  }

  try {

    // ADD SERVICE FLOW

    if (state.action === "ADD") {

      if (state.step === "NAME") {

        state.name = value;
        state.step = "DESCRIPTION";

        return ctx.reply(
          "📝 Enter the service description.\n\n" +
          "Example: Medical consultation and examination."
        );

      }

      if (state.step === "DESCRIPTION") {

        state.description = value;
        state.step = "PRICE";

        return ctx.reply(
          "💰 Enter the service price in ETB.\n\n" +
          "Example: 500"
        );

      }

      if (state.step === "PRICE") {

        const price = Number(value);

        if (!Number.isFinite(price) || price <= 0) {
          return ctx.reply(
            "❌ Invalid price.\n\nPlease enter a number greater than zero."
          );
        }

        const service = await prisma.service.create({
          data: {
            name: state.name,
            description: state.description,
            price: price,
            status: true
          }
        });

        ctx.session.serviceAdmin = null;

        return ctx.reply(
          "✅ New Service Added Successfully!\n\n" +
          `🏥 Name: ${service.name}\n` +
          `📝 Description: ${service.description}\n` +
          `💰 Price: ${service.price} ETB\n` +
          "📌 Status: 🟢 Active",
          {
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "✏️ Edit Service",
                  callback_data: `EDIT_SERVICE_${service.id}`
                }],
                [{
                  text: "🔙 Back to Services",
                  callback_data: "ADMIN_SERVICES"
                }]
              ]
            }
          }
        );

      }

    }

    // EDIT EXISTING SERVICE

    if (state.action === "EDIT") {

      const updateData = {};

      if (state.field === "name") {
        updateData.name = value;
      }

      if (state.field === "description") {
        updateData.description = value;
      }

      if (state.field === "price") {

        const price = Number(value);

        if (!Number.isFinite(price) || price <= 0) {
          return ctx.reply(
            "❌ Invalid price.\n\nPlease enter a number greater than zero."
          );
        }

        updateData.price = price;
      }

      const service = await prisma.service.update({
        where: { id: state.serviceId },
        data: updateData
      });

      ctx.session.serviceAdmin = null;

      return ctx.reply(
        "✅ Service Updated Successfully!\n\n" +
        `🏥 Name: ${service.name}\n` +
        `📝 Description: ${service.description || "Not set"}\n` +
        `💰 Price: ${service.price} ETB\n` +
        `📌 Status: ${service.status ? "🟢 Active" : "🔴 Inactive"}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{
                text: "✏️ Edit Service",
                callback_data: `EDIT_SERVICE_${service.id}`
              }],
              [{
                text: "🔙 Back to Services",
                callback_data: "ADMIN_SERVICES"
              }]
            ]
          }
        }
      );

    }

  } catch (error) {

    console.error("❌ Error saving service:", error);

    await ctx.reply(
      "❌ Unable to save service.\n\nPlease check the server console."
    );
  }

});


// ========================================
// ADMIN - CANCEL SERVICE INPUT
// ========================================

bot.action("CANCEL_SERVICE_INPUT", async (ctx) => {

  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  if (ctx.session) {
    ctx.session.serviceAdmin = null;
  }

  await ctx.reply(
    "❌ Service operation cancelled.",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🔙 Back to Services",
            callback_data: "ADMIN_SERVICES"
          }]
        ]
      }
    }
  );

});

// ========================================
// ADMIN - RETURN TO ADMIN PANEL
// ========================================

bot.action("ADMIN_PANEL", async (ctx) => {
  await ctx.answerCbQuery();

  if (!isAdmin(ctx)) {
    return ctx.reply("⛔ Access Denied.");
  }

  await ctx.reply(
    "👨‍💼 Amana Medium Clinic - Admin Panel\n\n" +
    "Please select an option:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Pending Appointments", callback_data: "ADMIN_PENDING" }],
          [{ text: "📅 Today's Appointments", callback_data: "ADMIN_TODAY" }],
          [{ text: "📚 All Appointments", callback_data: "ADMIN_ALL_APPOINTMENTS" }],
          [{ text: "🔎 Search Appointments", callback_data: "ADMIN_SEARCH_APPOINTMENTS" }],
          [{ text: "📊 Filter Appointments", callback_data: "ADMIN_FILTER_APPOINTMENTS" }],
          [{ text: "👨‍⚕️ Manage Doctors", callback_data: "ADMIN_DOCTORS" }],
          [{ text: "🏥 Manage Services", callback_data: "ADMIN_SERVICES" }],
          [{ text: "❌ Close Admin Panel", callback_data: "ADMIN_CLOSE" }]
        ]
      }
    }
  );
});

  
  // ========================================
  // CLOSE ADMIN
  // ========================================
  
  bot.action("ADMIN_CLOSE", async (ctx) => {
  
    await ctx.answerCbQuery();
  
    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Access Denied.");
    }
  
    await ctx.reply(
      "✅ Admin panel closed.\n\n" +
      "Use /admin whenever you need to access it."
    );
  
  });
// ========================================
// BOOK APPOINTMENT
// ========================================

bot.action("BOOK_APPOINTMENT", async (ctx) => {

    await ctx.answerCbQuery();
  
    const services = await prisma.service.findMany({
      where: {
        status: true
      },
      orderBy: {
        name: "asc"
      }
    });
  
    if (services.length === 0) {
      return ctx.reply(
        "❌ No clinic services are currently available."
      );
    }
  
    const buttons = services.map((service) => [
      {
        text: `🏥 ${service.name}`,
        callback_data: `SERVICE_${service.id}`
      }
    ]);

    buttons.push([
      {
        text: "❌ Cancel",
        callback_data: "CANCEL_BOOKING"
      }
    ]);
  
    await ctx.reply(
      "📅 Book Appointment\n\n" +
      "Please select a service:",
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  });

// ========================================
// ========================================
// SELECT SERVICE
// ========================================

bot.action(/^SERVICE_(\d+)$/, async (ctx) => {

    await ctx.answerCbQuery();
  
    const serviceId = Number(ctx.match[1]);
  
    // Find selected service
    const service = await prisma.service.findUnique({
      where: {
        id: serviceId
      }
    });
  
    if (!service) {
      return ctx.reply("❌ Service not found.");
    }
  
    // Find doctors for this service
    const doctors = await prisma.doctor.findMany({
      where: {
        status: true,
        serviceId: serviceId
      },
      orderBy: {
        name: "asc"
      }
    });
  
    if (doctors.length === 0) {
      return ctx.reply(
        `❌ No doctors are currently available for ${service.name}.`
      );
    }
  
    // Create doctor buttons
    const buttons = doctors.map((doctor) => [
      {
        text: `👨‍⚕️ ${doctor.name} - ${doctor.specialization}`,
        callback_data: `DOCTOR_${serviceId}_${doctor.id}`
      }
    ]);
  
    // Back button
    buttons.push([
      {
        text: "⬅️ Back to Services",
        callback_data: "BOOK_APPOINTMENT"
      }
    ]);
  
    await ctx.reply(
      `🏥 Service: ${service.name}\n\n` +
      `Please select a doctor:`,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  });
  
  
  // ========================================
  // STEP 7 - SELECT APPOINTMENT DATE
  // ========================================
  
  bot.action(/^DOCTOR_(\d+)_(\d+)$/, async (ctx) => {
  
    await ctx.answerCbQuery();
  
    const serviceId = Number(ctx.match[1]);
    const doctorId = Number(ctx.match[2]);
  
    // Get doctor
    const doctor = await prisma.doctor.findUnique({
      where: {
        id: doctorId
      }
    });
  
    if (!doctor) {
      return ctx.reply("❌ Doctor not found.");
    }
  
    // Get service
    const service = await prisma.service.findUnique({
      where: {
        id: serviceId
      }
    });
  
    if (!service) {
      return ctx.reply("❌ Service not found.");
    }
  
    // Get doctor's schedules
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: doctorId
      },
      orderBy: {
        dayOfWeek: "asc"
      }
    });
  
    if (schedules.length === 0) {
      return ctx.reply(
        `❌ ${doctor.name} does not have an available schedule.`
      );
    }
  
    // Start from today
    const today = new Date();
  
    today.setHours(0, 0, 0, 0);
  
    const buttons = [];
  
    // Show next 14 days
    for (let i = 0; i < 14; i++) {
  
      const date = new Date(today);
  
      date.setDate(today.getDate() + i);
  
      // Sunday = 0
      // Monday = 1
      // Tuesday = 2
      // ...
      // Saturday = 6
      const dayOfWeek =
  date.getDay() === 0 ? 7 : date.getDay();
  
      // Check if doctor works this day
      const schedule = schedules.find(
        (item) => item.dayOfWeek === dayOfWeek
      );
  
      if (!schedule) {
        continue;
      }
  
      // Check existing appointments
      const appointmentDate = new Date(date);
  
      const existingAppointments =
        await prisma.appointment.count({
          where: {
            doctorId: doctorId,
            appointmentDate: appointmentDate,
            status: {
              not: "CANCELLED"
            }
          }
        });
  
      // Calculate available slots
      const startHour =
        Number(schedule.startTime.split(":")[0]);
  
      const startMinute =
        Number(schedule.startTime.split(":")[1]);
  
      const endHour =
        Number(schedule.endTime.split(":")[0]);
  
      const endMinute =
        Number(schedule.endTime.split(":")[1]);
  
      const startMinutes =
        startHour * 60 + startMinute;
  
      const endMinutes =
        endHour * 60 + endMinute;
  
      const totalSlots =
        Math.floor(
          (endMinutes - startMinutes) / 30
        );
  
      // Don't show completely booked date
      if (existingAppointments >= totalSlots) {
        continue;
      }
  
      // Format date for Telegram
      const displayDate =
        date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric"
        });
  
      // Internal date format
      const dateString =
        `${date.getFullYear()}-` +
        `${String(date.getMonth() + 1).padStart(2, "0")}-` +
        `${String(date.getDate()).padStart(2, "0")}`;
  
      buttons.push([
        {
          text: `📅 ${displayDate}`,
          callback_data:
            `DATE_${serviceId}_${doctorId}_${dateString}`
        }
      ]);
    }
  
    if (buttons.length === 0) {
      return ctx.reply(
        `❌ No appointment dates are available for ${doctor.name} during the next 14 days.`
      );
    }
  
    // Back button
    buttons.push([
      {
        text: "⬅️ Back to Doctors",
        callback_data: `SERVICE_${serviceId}`
      }
    ]);
  
    await ctx.reply(
      `👨‍⚕️ Doctor: ${doctor.name}\n` +
      `🏥 Service: ${service.name}\n\n` +
      `📅 Please select an available appointment date:`,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  });
  
  
  // ========================================
  // STEP 8 - SELECT APPOINTMENT TIME
  // ========================================
  
  bot.action(
    /^DATE_(\d+)_(\d+)_(\d{4}-\d{2}-\d{2})$/,
    async (ctx) => {
  
      await ctx.answerCbQuery();
  
      const serviceId = Number(ctx.match[1]);
      const doctorId = Number(ctx.match[2]);
      const dateString = ctx.match[3];
  
      // Get doctor
      const doctor = await prisma.doctor.findUnique({
        where: {
          id: doctorId
        }
      });
  
      if (!doctor) {
        return ctx.reply("❌ Doctor not found.");
      }
  
      // Get service
      const service = await prisma.service.findUnique({
        where: {
          id: serviceId
        }
      });
  
      if (!service) {
        return ctx.reply("❌ Service not found.");
      }
  
      // Convert selected date
      const appointmentDate =
        new Date(`${dateString}T00:00:00`);
  
        const dayOfWeek =
        appointmentDate.getDay() === 0
          ? 7
          : appointmentDate.getDay();
  
      // Get doctor's schedule for selected day
      const schedule =
        await prisma.doctorSchedule.findFirst({
          where: {
            doctorId: doctorId,
            dayOfWeek: dayOfWeek
          }
        });
  
      if (!schedule) {
        return ctx.reply(
          `❌ ${doctor.name} is not available on this date.`
        );
      }
  
      // Get existing appointments
      const appointments =
        await prisma.appointment.findMany({
          where: {
            doctorId: doctorId,
            appointmentDate: appointmentDate,
            status: {
              not: "CANCELLED"
            }
          },
          select: {
            appointmentTime: true
          }
        });
  
      const bookedTimes =
        appointments.map(
          (appointment) => appointment.appointmentTime
        );
  
      // Convert schedule to minutes
      const [startHour, startMinute] =
        schedule.startTime.split(":").map(Number);
  
      const [endHour, endMinute] =
        schedule.endTime.split(":").map(Number);
  
      const startMinutes =
        startHour * 60 + startMinute;
  
      const endMinutes =
        endHour * 60 + endMinute;
  
      // Generate 30-minute slots
      const timeButtons = [];
  
      for (
        let minutes = startMinutes;
        minutes < endMinutes;
        minutes += 30
      ) {
  
        const hour =
          Math.floor(minutes / 60);
  
        const minute =
          minutes % 60;
  
        const time =
          `${String(hour).padStart(2, "0")}:` +
          `${String(minute).padStart(2, "0")}`;
  
        // Don't show already booked time
        if (bookedTimes.includes(time)) {
          continue;
        }
  
        timeButtons.push({
          text: `⏰ ${time}`,
          callback_data:
            `TIME_${serviceId}_${doctorId}_${dateString}_${time}`
        });
      }
  
      if (timeButtons.length === 0) {
        return ctx.reply(
          `❌ No appointment times are available for ${doctor.name} on ${dateString}.`
        );
      }
  
      // Two time buttons per row
      const buttons = [];
  
      for (
        let i = 0;
        i < timeButtons.length;
        i += 2
      ) {
        buttons.push(
          timeButtons.slice(i, i + 2)
        );
      }
  
      // Back button
      buttons.push([
        {
          text: "⬅️ Back to Dates",
          callback_data:
            `DOCTOR_${serviceId}_${doctorId}`
        }
      ]);
  
      await ctx.reply(
        `👨‍⚕️ Doctor: ${doctor.name}\n` +
        `🏥 Service: ${service.name}\n` +
        `📅 Date: ${dateString}\n\n` +
        `⏰ Please select an available time:`,
        {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
  
    }
  );

  // ========================================
// STEP 9 - SELECT TIME
// ========================================

bot.action(
    /^TIME_(\d+)_(\d+)_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/,
    async (ctx) => {
  
      console.log(
        "TIME BUTTON CLICKED:",
        ctx.callbackQuery.data
      );
  
      try {
  
        await ctx.answerCbQuery();
  
        const serviceId = Number(ctx.match[1]);
        const doctorId = Number(ctx.match[2]);
        const dateString = ctx.match[3];
        const time = ctx.match[4];
  
        // Get patient
        const telegramId = String(ctx.from.id);
  
        const user = await prisma.user.findUnique({
          where: {
            telegramId: telegramId
          }
        });
  
        if (!user) {
          return ctx.reply(
            "❌ Patient not found. Please send /start first."
          );
        }
  
        // Get service
        const service = await prisma.service.findUnique({
          where: {
            id: serviceId
          }
        });
  
        if (!service) {
          return ctx.reply("❌ Service not found.");
        }
  
        // Get doctor
        const doctor = await prisma.doctor.findUnique({
          where: {
            id: doctorId
          }
        });
  
        if (!doctor) {
          return ctx.reply("❌ Doctor not found.");
        }
  
        // Show appointment summary
        await ctx.reply(
          `📋 Appointment Summary\n\n` +
          `👤 Patient: ${ctx.from.first_name || "Patient"}\n` +
          `🏥 Service: ${service.name}\n` +
          `👨‍⚕️ Doctor: ${doctor.name}\n` +
          `📅 Date: ${dateString}\n` +
          `⏰ Time: ${time}\n` +
          `💰 Price: ${service.price} ETB\n\n` +
          `Please confirm your appointment:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Confirm Appointment",
                    callback_data:
                      `CONFIRM_${serviceId}_${doctorId}_${dateString}_${time}`
                  }
                ],
                [
                  {
                    text: "❌ Cancel",
                    callback_data: "CANCEL_BOOKING"
                  }
                ]
              ]
            }
          }
        );
  
      } catch (error) {
  
        console.error(
          "Error selecting appointment time:",
          error
        );
  
        await ctx.reply(
          "❌ Sorry, we could not process the selected time."
        );
      }
    }
  );
  // ========================================
// ========================================
// ========================================
// STEP 10 - CONFIRM APPOINTMENT
// ========================================

bot.action(
    /^CONFIRM_(\d+)_(\d+)_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/,
    async (ctx) => {
  
      await ctx.answerCbQuery();
  
      const serviceId = Number(ctx.match[1]);
      const doctorId = Number(ctx.match[2]);
      const dateString = ctx.match[3];
      const time = ctx.match[4];
  
      try {
  
        // ----------------------------------------
        // Get patient
        // ----------------------------------------
  
        const telegramId = String(ctx.from.id);
  
        const user = await prisma.user.findUnique({
          where: {
            telegramId: telegramId
          }
        });
  
        if (!user) {
          return ctx.reply(
            "❌ Patient not found.\n\nPlease send /start first."
          );
        }
  
        // ----------------------------------------
        // Get service
        // ----------------------------------------
  
        const service = await prisma.service.findUnique({
          where: {
            id: serviceId
          }
        });
  
        if (!service) {
          return ctx.reply("❌ Service not found.");
        }
  
        // ----------------------------------------
        // Get doctor
        // ----------------------------------------
  
        const doctor = await prisma.doctor.findUnique({
          where: {
            id: doctorId
          }
        });
  
        if (!doctor) {
          return ctx.reply("❌ Doctor not found.");
        }
  
        // ----------------------------------------
        // Convert date
        // ----------------------------------------
  
        const appointmentDate = new Date(
          `${dateString}T00:00:00`
        );
  
        // ----------------------------------------
        // Check whether this slot is already booked
        // ----------------------------------------
  
        const existingAppointment =
          await prisma.appointment.findFirst({
            where: {
              doctorId: doctorId,
              appointmentDate: appointmentDate,
              appointmentTime: time,
              status: {
                not: "CANCELLED"
              }
            }
          });
  
        if (existingAppointment) {
  
          return ctx.reply(
            `❌ Sorry, this appointment slot is already booked.\n\n` +
            `👨‍⚕️ Doctor: ${doctor.name}\n` +
            `📅 Date: ${dateString}\n` +
            `⏰ Time: ${time}\n\n` +
            `Please select another time.`
          );
  
        }
  
        // ----------------------------------------
        // Create appointment
        // ----------------------------------------
  
        const appointment =
          await prisma.appointment.create({
            data: {
              patientId: user.id,
              doctorId: doctorId,
              serviceId: serviceId,
              appointmentDate: appointmentDate,
              appointmentTime: time,
              status: "PENDING"
            }
          });
  
        // ----------------------------------------
        // Success message
        // ----------------------------------------
  
        await ctx.reply(
          `✅ *APPOINTMENT BOOKED SUCCESSFULLY!*\n\n` +
          `Hello ${user.firstName || "Patient"}!\n\n` +
          `Your appointment request has been received.\n\n` +
          `👨‍⚕️ *Doctor:* ${doctor.name}\n` +
          `🏥 *Service:* ${service.name}\n` +
          `📅 *Date:* ${dateString}\n` +
          `🕒 *Time:* ${time}\n` +
          `💰 *Price:* ${service.price} ETB\n\n` +
          `📌 *Status:* PENDING\n\n` +
          `Your appointment is awaiting confirmation from the clinic. We will notify you when its status changes.\n\n` +
          `Thank you for choosing Amana Medium Clinic!`,
          { parse_mode: "Markdown" }
        );
      } catch (error) {
  
        console.error(
          "Error confirming appointment:",
          error
        );
  
        await ctx.reply(
          "❌ Unable to complete the appointment booking.\n\n" +
          "Please try again."
        );
      }
    }
  );
// MY APPOINTMENTS
// ========================================

// ========================================
// MY APPOINTMENTS
// ========================================

bot.action("MY_APPOINTMENTS", async (ctx) => {

    await ctx.answerCbQuery();
  
    const telegramId = String(ctx.from.id);
  
    try {
  
      const user = await prisma.user.findUnique({
        where: {
          telegramId: telegramId
        }
      });
  
      if (!user) {
        return ctx.reply(
          "❌ Please send /start first."
        );
      }
  
      const appointments =
        await prisma.appointment.findMany({
          where: {
            patientId: user.id
          },
          include: {
            doctor: true,
            service: true
          },
          orderBy: {
            appointmentDate: "desc"
          }
        });
  
      if (appointments.length === 0) {
        return ctx.reply(
          "📋 My Appointments\n\n" +
          "You don't have any appointments yet."
        );
      }
  
      for (const appointment of appointments) {
  
        const buttons = [];
  
        // Only allow cancellation of pending appointments
        if (appointment.status === "PENDING") {
          buttons.push([
            {
              text: "❌ Cancel Appointment",
              callback_data:
                `CANCEL_APPOINTMENT_${appointment.id}`
            }
          ]);
        }
  
        await ctx.reply(
          `📋 Appointment #${appointment.id}\n\n` +
  
          `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
  
          `⏰ Time: ${appointment.appointmentTime}\n` +
  
          `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
  
          `🏥 Service: ${appointment.service.name}\n` +
  
          `💰 Price: ${appointment.service.price} ETB\n` +
  
          `📌 Status: ${appointment.status}`,
  
          buttons.length > 0
            ? {
                reply_markup: {
                  inline_keyboard: buttons
                }
              }
            : {}
        );
      }
  
    } catch (error) {
  
      console.error(
        "Error loading appointments:",
        error
      );
  
      await ctx.reply(
        "❌ Unable to load your appointments."
      );
    }
  });

  // ========================================
// CANCEL APPOINTMENT - CONFIRMATION
// ========================================

bot.action(
    /^CANCEL_APPOINTMENT_(\d+)$/,
    async (ctx) => {
  
      await ctx.answerCbQuery();
  
      const appointmentId =
        Number(ctx.match[1]);
  
      try {
  
        const appointment =
          await prisma.appointment.findUnique({
            where: {
              id: appointmentId
            },
            include: {
              doctor: true,
              service: true,
              patient: true
            }
          });
  
        if (!appointment) {
          return ctx.reply(
            "❌ Appointment not found."
          );
        }
  
        // Security check
        const telegramId =
          String(ctx.from.id);
  
        if (
          appointment.patient.telegramId !==
          telegramId
        ) {
          return ctx.reply(
            "❌ You are not authorized to cancel this appointment."
          );
        }
  
        if (appointment.status !== "PENDING") {
          return ctx.reply(
            `❌ This appointment cannot be cancelled.\n\n` +
            `Current status: ${appointment.status}`
          );
        }
  
        await ctx.reply(
          `⚠️ Cancel Appointment\n\n` +
  
          `📅 Date: ${appointment.appointmentDate.toLocaleDateString()}\n` +
  
          `⏰ Time: ${appointment.appointmentTime}\n` +
  
          `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
  
          `🏥 Service: ${appointment.service.name}\n\n` +
  
          `Are you sure you want to cancel this appointment?`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Yes, Cancel",
                    callback_data:
                      `CONFIRM_CANCEL_${appointment.id}`
                  }
                ],
                [
                  {
                    text: "⬅️ Keep Appointment",
                    callback_data:
                      "MY_APPOINTMENTS"
                  }
                ]
              ]
            }
          }
        );
  
      } catch (error) {
  
        console.error(
          "Error preparing cancellation:",
          error
        );
  
        await ctx.reply(
          "❌ Unable to process cancellation."
        );
      }
    }
  );
  // ========================================
// CONFIRM CANCEL APPOINTMENT
// ========================================


 // ================= CONFIRM APPOINTMENT CANCELLATION =================

 bot.action(/^CONFIRM_CANCEL_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const appointmentId = Number(ctx.match[1]);
    const telegramId = String(ctx.from.id);

    // Find appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        service: true
      }
    });

    if (!appointment) {
      return ctx.reply("❌ Appointment not found.");
    }

    // Verify appointment ownership
    if (String(appointment.patient.telegramId) !== telegramId) {
      return ctx.reply(
        "❌ You are not authorized to cancel this appointment."
      );
    }

    if (appointment.status !== "PENDING") {
      return ctx.reply(
        `❌ This appointment cannot be cancelled.\n\n` +
        `Current status: ${appointment.status}`
      );
    }

    // Update only if appointment is still pending
    const updateResult = await prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        status: "PENDING"
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (updateResult.count === 0) {
      return ctx.reply(
        "⚠️ This appointment has already been processed."
      );
    }

    const appointmentDate = new Date(
      appointment.appointmentDate
    ).toISOString().slice(0, 10);

    // Confirm cancellation to patient
    await ctx.reply(
      `✅ APPOINTMENT CANCELLED\n\n` +
      `🆔 Appointment ID: ${appointment.id}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `⏰ Time: ${appointment.appointmentTime}\n\n` +
      `Your appointment has been cancelled successfully.\n\n` +
      `Thank you for choosing Amana Medium Clinic.`
    );

    // Notify administrators
    const adminIds = (
      process.env.ADMIN_TELEGRAM_IDS || ""
    )
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    const adminMessage =
      `🔔 PATIENT CANCELLED AN APPOINTMENT\n\n` +
      `🆔 Appointment ID: ${appointment.id}\n` +
      `👤 Patient: ${appointment.patient.firstName || "Patient"}\n` +
      `📱 Telegram ID: ${appointment.patient.telegramId}\n` +
      `👨‍⚕️ Doctor: ${appointment.doctor.name}\n` +
      `🏥 Service: ${appointment.service.name}\n` +
      `📅 Date: ${appointmentDate}\n` +
      `⏰ Time: ${appointment.appointmentTime}\n\n` +
      `📌 Status: CANCELLED\n` +
      `Cancellation initiated by: Patient`;

    const results = await Promise.allSettled(
      adminIds.map(adminId =>
        bot.telegram.sendMessage(adminId, adminMessage)
      )
    );

    const successfulNotifications = results.filter(
      result => result.status === "fulfilled"
    ).length;

    console.log(
      `Cancellation notification: ${successfulNotifications}/${adminIds.length} administrators notified.`
    );

    if (adminIds.length === 0 || successfulNotifications === 0) {
      console.warn(
        "Appointment cancelled, but no administrator notification was delivered."
      );
    }

  } catch (error) {
    console.error("Error cancelling appointment:", error);

    await ctx.reply(
      "❌ Unable to process the cancellation. Please contact the clinic."
    );
  }
});

// ========================================
// OUR DOCTORS
// ========================================

// OUR DOCTORS
bot.action("OUR_DOCTORS", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const doctors = await prisma.doctor.findMany({
      where: {
        status: true
      },
      orderBy: {
        name: "asc"
      }
    });

    if (doctors.length === 0) {
      return ctx.reply(
        "👨‍⚕️ OUR DOCTORS\n\n" +
        "No doctors are currently available.\n" +
        "Please check again later."
      );
    }

    let message = "👨‍⚕️ *OUR MEDICAL TEAM*\n\n";

    doctors.forEach((doctor, index) => {
    
      // Remove existing Dr. prefix to avoid duplication
      const doctorName = doctor.name
        .replace(/^Dr\.?\s*/i, "")
        .trim();
    
      message +=
        `*${index + 1}. Dr. ${doctorName}*\n` +
        `🩺 Specialization: ${doctor.specialization}\n`;
    
      if (doctor.phone) {
        message += `📞 Phone: ${doctor.phone}\n`;
      }
    
      message += "\n";
    });
    
    message +=
      "🏥 *Amana Medium Clinic*\n" +
      "We are committed to providing quality healthcare.";
    
    await ctx.reply(message, {
      parse_mode: "Markdown"
    });

  } catch (error) {
    console.error("OUR DOCTORS ERROR:", error);

    await ctx.reply(
      "Sorry, we couldn't retrieve our doctors. Please try again later."
    );
  }
});
// ========================================
// OUR SERVICES
// ========================================

bot.action("OUR_SERVICES", async (ctx) => {
  await ctx.answerCbQuery();

  const services = await prisma.service.findMany({
    where: {
      status: true
    }
  });

  if (services.length === 0) {
    return ctx.reply(
      "🏥 Our Services\n\n" +
      "No services are currently available."
    );
  }

  let message = "🏥 Our Services\n\n";

  services.forEach((service) => {
    message +=
      `🔹 ${service.name}\n` +
      `${service.description || ""}\n` +
      `💰 Price: ${service.price} ETB\n\n`;
  });

  await ctx.reply(message);
});


// ========================================
// CLINIC LOCATION
// ========================================

// CLINIC LOCATION
bot.action("CLINIC_LOCATION", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply(
      "📍 *AMANA MEDIUM CLINIC*\n\n" +
      "Our clinic is located at:\n\n" +
      "📍 Furi, NOC area,\n" +
      "Near Fitsum Hotel,\n" +
      "Sheger City, Ethiopia.\n\n" +
      "You can find us using Google Maps below.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📍 Find Us on Google Maps",
                url: "https://www.google.com/maps/search/?api=1&query=Fitsum+Hotel+Furi+Sheger+City"
              }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error("CLINIC LOCATION ERROR:", error);

    await ctx.reply(
      "Sorry, we couldn't display the clinic location."
    );
  }
});


// ========================================
// CONTACT
// ========================================


// CONTACT US

// CONTACT US
bot.action("CONTACT_US", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply(
      "📞 CONTACT AMANA MEDIUM CLINIC\n\n" +
      "☎️ Phone: +251921474154\n\n" +
      "📧 Email: amana.mediumclinic@gmail.com\n\n" +
      "🕒 Working Hours:\n" +
      "Monday – Sunday\n" +
      "24 Hours / 7 Days\n\n" +
      "🏥 Amana Medium Clinic\n" +
      "📍 Furi, NOC area, near Fitsum Hotel,\n" +
      "Addis Ababa, Ethiopia.\n\n" +
      "Feel free to contact us for appointments and inquiries."
    );

  } catch (error) {
    console.error("CONTACT US ERROR:", error);

    await ctx.reply("Unable to display contact information.");
  }
});



// ========================================
// ABOUT
// ========================================


// ABOUT CLINIC
bot.action("ABOUT_CLINIC", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply(
      "🏥 *ABOUT AMANA MEDIUM CLINIC*\n\n" +
      "Welcome to Amana Medium Clinic!\n\n" +
      "We are committed to providing quality healthcare services " +
      "and patient-centered medical care.\n\n" +
      "👨‍⚕️ Our Services:\n" +
      "• General Medicine\n" +
      "• Dental Consultation\n" +
      "• Pediatrics\n\n" +
      "❤️ Our Commitment:\n" +
      "Providing accessible and reliable healthcare services " +
      "with professional care and compassion.\n\n" +
      "📍 Furi, NOC area, near Fitsum Hotel,\n" +
      "Addis Ababa, Ethiopia.\n\n" +
      "📞 +251921474154\n" +
      "📧 amana.mediumclinic@gmail.com\n\n" +
      "🕒 Open 24 Hours, 7 Days a Week.",
      {
        parse_mode: "Markdown"
      }
    );

  } catch (error) {
    console.error("ABOUT CLINIC ERROR:", error);

    await ctx.reply("Unable to display clinic information.");
  }
});



// ========================================
// ERROR HANDLER
// ========================================

bot.catch((error, ctx) => {
  console.error(
    "Unhandled error while processing update:",
    error
  );
});

module.exports = bot;