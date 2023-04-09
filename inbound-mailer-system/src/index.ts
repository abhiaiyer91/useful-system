import { SupabaseClient } from "@supabase/supabase-js";
import * as yup from "yup";

// Sendgrid docs link: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
const EMAIL_SCHEMA = yup.object().shape({
  headers: yup.string().required(),
  dkim: yup.string().required(),
  "content-ids": yup.string().optional(),
  to: yup.string().required(),
  text: yup.string().optional(),
  html: yup.string().optional(),
  from: yup.string().required(),
  sender_ip: yup.string().required(),
  spam_report: yup.string().required(),
  envelope: yup.string().required(),
  attachments: yup.string().optional(),
  subject: yup.string().required(),
  spam_score: yup.string().required(),
  "attachment-info": yup.string().optional(),
  charsets: yup.string().required(),
  SPF: yup.string().required(),
});

interface Email {
  to: string;
  user_id: string;
  from: string;
  headers: string;
  dkim: string;
  content_ids?: string;
  text?: string;
  html?: string;
  sender_ip: string;
  spam_report: string;
  envelope: string;
  attachments?: number;
  subject: string;
  spam_score: number;
  charsets: string;
  spf?: string;
}

interface Message {
  subject: string;
  text: string;
  html: string;
}

export class InboundMailer {
  db: SupabaseClient;
  debug: boolean;
  constructor({ db, debug }: { db: SupabaseClient; debug?: boolean }) {
    this.debug = !!debug;
    this.db = db;
  }

  getEmailUserId(email: Pick<Email, "to">) {
    return email.to.split("@")[0];
  }

  async verifyUser(id: string) {
    const { data, error } = await this.db
      .from("users_view")
      .select("id")
      .eq("id", id)
      .single();

    return { data, error };
  }

  async insertEmail(email: Email) {
    const { data, error } = await this.db.from("emails").insert(email);
    return { data, error };
  }

  async validateAndSave(metadata: Email) {
    const email = await EMAIL_SCHEMA.validate(metadata);

    const userId = this.getEmailUserId(email);

    const { data: verifyData, error: verifyError } = await this.verifyUser(
      userId
    );

    if (verifyError || !verifyData?.id) {
      console.error("The User is not valid", verifyError);

      // Silent return
      return;
    }

    const { data: emailData, error: emailError } = await this.insertEmail({
      user_id: verifyData.id,
      to: email.to,
      from: email.from,
      headers: email.headers,
      dkim: email.dkim,
      content_ids: email["content-ids"],
      text: email.text,
      html: email.html,
      sender_ip: email["sender_ip"],
      spam_report: email["spam_report"],
      envelope: email.envelope,
      attachments: email?.attachments ? parseInt(email.attachments) : 0,
      subject: email.subject,
      spam_score: parseFloat(email["spam_score"])
        ? parseFloat(email["spam_score"])
        : 0,
      charsets: email.charsets,
      spf: email.SPF,
    });

    if (emailError) {
      console.error("Unable to insert email into database", emailError);

      // Silent return
      return;
    }

    return emailData;
  }
}
