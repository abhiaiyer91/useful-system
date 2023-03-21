import { createClient } from "@supabase/supabase-js";

import { NotificationSystem } from "./";

const supabase = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new NotificationSystem({
  db: supabase,
  debug: true,
});

const USER_ID = `USER_ID`;

describe("NotificationSystem", () => {
  afterAll(async () => {
    await system.deleteNotificationSetting({ user_id: USER_ID });
  });

  it("Upsert NotificationSetting", async () => {
    const notifSetting = await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `email`,
      enabled: true,
    });

    expect(notifSetting.user_id).toBe(USER_ID);
  });

  it("Update NotificationSetting", async () => {
    const notifSetting = await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `email`,
      enabled: false,
    });

    expect(notifSetting.email).toBe(false);
  });

  it("sendNotificationToUser", async () => {
    const sendEmailSpy = jest.spyOn(system, "sendEmail");
    const sendSmsSpy = jest.spyOn(system, "sendSms");

    await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `email`,
      enabled: true,
    });

    await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `sms`,
      enabled: true,
    });

    await system.sendNotificationToUser({
      user_id: USER_ID,
      message: {
        text: `Hi`,
        to_email: `foo@foo.com`,
        to_sms: `555-555-5555`,
        from_sms: `555-555-5555`,
        from_email: `hello@gmail.com`,
        subject: `Suh`,
        html: ``,
      },
    });

    expect(sendEmailSpy).toHaveBeenCalled();
    expect(sendSmsSpy).toHaveBeenCalled();
  });

  it("sendNotificationToUsers", async () => {
    const sendEmailSpy = jest.spyOn(system, "sendEmail");
    const sendSmsSpy = jest.spyOn(system, "sendSms");

    await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `email`,
      enabled: true,
    });

    await system.upsertNotificationSettings({
      user_id: USER_ID,
      preference: `sms`,
      enabled: true,
    });

    await system.sendNotificationToUsers({
      user_ids: [USER_ID],
      message: {
        text: `Hi`,
        to_email: `foo@foo.com`,
        to_sms: `555-555-5555`,
        from_sms: `555-555-5555`,
        from_email: `hello@gmail.com`,
        subject: `Suh`,
        html: ``,
      },
    });

    expect(sendEmailSpy).toHaveBeenCalled();
    expect(sendSmsSpy).toHaveBeenCalled();
  });
});
