import SendGridMail, { MailService } from "@sendgrid/mail";
import { SupabaseClient } from "@supabase/supabase-js";
import TwilioSDK from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

interface Message {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export class NotificationSystem {
  sendGrid?: MailService;
  db: SupabaseClient;
  debug: boolean;
  twilio?: TwilioSDK.Twilio;
  constructor({
    db,
    SENDGRID_API_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    debug,
  }: {
    db: SupabaseClient;
    debug?: boolean;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    SENDGRID_API_KEY?: string;
  }) {
    this.debug = !!debug;
    this.db = db;

    if (SENDGRID_API_KEY) {
      SendGridMail.setApiKey(SENDGRID_API_KEY);

      this.sendGrid = SendGridMail;
    }

    if (TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID) {
      this.twilio = new TwilioSDK.Twilio(accountSid, authToken);
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

  async upsertNotificationSettings({
    enabled,
    user_id,
    preference,
  }: {
    user_id: string;
    preference: "email" | "sms";
    enabled: boolean;
  }) {
    const { data, error } = await this.db
      .from(`notification_settings`)
      .upsert({ user_id, [preference]: enabled })
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
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
      await this.sendEmail(message);
    }

    if (notificationSettings?.["sms"]) {
      await this.sendSms(message);
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
      })
    );
  }

  async sendEmail({ to, from, subject, text, html }: Message) {
    if (this.debug) {
      console.log("Sending email", {
        to,
        from,
        subject,
        text,
        html,
      });
      return;
    }
    return this.sendGrid?.send({
      to,
      from,
      subject,
      text,
      html,
    });
  }

  async sendSms({ to, from, text }: Message) {
    if (this.debug) {
      console.log("Sending sms", {
        to,
        from,
        text,
      });
      return;
    }

    return this.twilio?.messages.create({
      to,
      from,
      body: text,
    });
  }
}
