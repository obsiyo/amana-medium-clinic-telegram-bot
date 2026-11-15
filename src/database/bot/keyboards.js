const { Markup } = require("telegraf");

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📅 Book Appointment", "BOOK_APPOINTMENT"),
      Markup.button.callback("📋 My Appointments", "MY_APPOINTMENTS")
    ],
    [
      Markup.button.callback("👨‍⚕️ Our Doctors", "OUR_DOCTORS"),
      Markup.button.callback("🏥 Our Services", "OUR_SERVICES")
    ],
    [
      Markup.button.callback("📍 Clinic Location", "CLINIC_LOCATION"),
      Markup.button.callback("📞 Contact Us", "CONTACT_US")
    ],
    [
      Markup.button.callback("ℹ️ About Clinic", "ABOUT_CLINIC")
    ]
  ]);
}

module.exports = {
  mainMenu
};