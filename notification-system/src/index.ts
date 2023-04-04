import SendGridMail, { MailService } from "@sendgrid/mail";
import { SupabaseClient } from "@supabase/supabase-js";
import TwilioSDK from "twilio";

interface Message {
  subject: string;
  text: string;
  html: string;
}

export class NotificationSystem {
  sendGrid?: MailService;
  db: SupabaseClient;
  debug: boolean;
  fromEmail: string;
  fromSms: string;
  twilio?: TwilioSDK.Twilio;
  constructor({
    db,
    SENDGRID_API_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    fromEmail,
    fromSms,
    debug,
  }: {
    db: SupabaseClient;
    fromEmail: string;
    fromSms: string;
    debug?: boolean;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    SENDGRID_API_KEY?: string;
  }) {
    this.debug = !!debug;
    this.db = db;
    this.fromEmail = fromEmail;
    this.fromSms = fromSms;

    if (SENDGRID_API_KEY) {
      SendGridMail.setApiKey(SENDGRID_API_KEY);

      this.sendGrid = SendGridMail;
    }

    if (TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID) {
      this.twilio = new TwilioSDK.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
  }

  async getNotificationSettings(user_id: string) {
    const { data, error } = await this.db
      .from(`notification_settings`)
      .select("*")
      .eq("user_id", user_id)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async removeNotificationSettings({
    user_id,
    preference,
  }: {
    user_id: string;
    preference: `email` | `sms` | `all`;
  }) {
    let builder;

    if (preference !== `all`) {
      builder = this.db
        .from(`notification_settings`)
        .upsert({ user_id, [preference]: null })
        .select("*")
        .limit(1);
    } else {
      builder = this.db
        .from(`notification_settings`)
        .upsert({ user_id, email: null, sms: null })
        .select("*")
        .limit(1);
    }

    const { data, error } = await builder;

    if (error) {
      throw error;
    }

    console.log({ data });

    return data?.[0];
  }

  async upsertNotificationSettings({
    user_id,
    preference,
  }: {
    user_id: string;
    preference: { email?: string; sms?: string };
  }) {
    const { data, error } = await this.db
      .from(`notification_settings`)
      .upsert({ user_id, ...preference })
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async deleteNotificationSetting({ user_id }: { user_id: string }) {
    const { error } = await this.db
      .from(`notification_settings`)
      .delete()
      .eq("user_id", user_id);

    if (error) {
      throw error;
    }
  }

  async sendNotificationToUser({
    user_id,
    message,
  }: {
    user_id: string;
    message: Message;
  }) {
    const notificationSettings = await this.getNotificationSettings(user_id);

    if (notificationSettings?.["email"]) {
      await this.sendEmail({
        ...message,
        to_email: notificationSettings.email,
      });
    }

    if (notificationSettings?.["sms"]) {
      await this.sendSms({
        ...message,
        to_sms: notificationSettings.sms,
      });
    }
  }

  async sendNotificationToUsers({
    user_ids,
    message,
  }: {
    user_ids: string[];
    message: Message;
  }) {
    await Promise.all(
      user_ids.map((id) => {
        return this.sendNotificationToUser({
          user_id: id,
          message,
        });
      }),
    );
  }

  async sendEmail({
    to_email: to,
    subject,
    text,
    html,
  }: Message & { to_email: string }) {
    if (this.debug) {
      console.log("Sending email", {
        to,
        from: this.fromEmail,
        subject,
        text,
        html,
      });
      return;
    }
    return this.sendGrid?.send({
      to,
      from: this.fromEmail,
      subject,
      text,
      html,
    });
  }

  async sendSms({ to_sms: to, text }: Message & { to_sms: string }) {
    if (this.debug) {
      console.log("Sending sms", {
        to,
        from: this.fromSms,
        text,
      });
      return;
    }

    return this.twilio?.messages.create({
      to,
      from: this.fromSms,
      body: text,
    });
  }
}
