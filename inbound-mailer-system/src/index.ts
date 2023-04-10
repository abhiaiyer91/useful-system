import { SupabaseClient } from "@supabase/supabase-js";
import pMap from "p-map";
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
  generators: Record<string, any>;
  constructor({
    db,
    debug,
    generators,
  }: {
    db: SupabaseClient;
    debug?: boolean;
    generators: Record<string, any>;
  }) {
    this.debug = !!debug;
    this.db = db;
    this.generators = generators;
  }

  getEmailUserId(email: Pick<Email, "to">) {
    return email.to.split("@")[0];
  }

  async getUsers() {
    const { data, error } = await this.db.from("users_view").select("id");
    return { data, error };
  }

  async verifyUser(id: string) {
    const { data, error } = await this.db
      .from("users_view")
      .select("id")
      .eq("id", id)
      .single();

    return { data, error };
  }

  async getUnprocessedEmails(user_id: string, limit = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async updateEmailsAsProcessed(user_id: string, email_ids: string[]) {
    const { data, error } = await this.db
      .from("emails")
      .update({ status: "processed" })
      .in("id", email_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateEmailsAsUnprocessed(user_id: string, date: string) {
    const { data, error } = await this.db
      .from("emails")
      .update({ status: "unprocessed" })
      .lte("created_at", date)
      .eq("user_id", user_id);
    return { data, error };
  }

  async processMail(generator: string, content_column: string = "text") {
    const generatorFn = this.generators[generator];

    if (!generatorFn) {
      throw new Error(`No generator found for ${generator}`);
    }

    const { data, error } = await this.getUsers();

    if (error) {
      throw new Error("Unable to process mailers");
    }

    if (!data) {
      throw new Error("No users found");
    }

    await pMap(data, async ({ id }) => {
      const { data, error } = await this.getUnprocessedEmails(id);

      if (error) {
        console.error(error);
        return;
      }

      if (data?.length === 0) {
        return console.log("Abort. No emails");
      }

      let emailText = "";
      let emailIds: string[] = [];
      let lastEmailDate = "";
      data?.forEach(async (email, index) => {
        emailIds.push(email.id);
        emailText =
          emailText +
          `\n\n[Email ${index + 1}]\nSubject: ${email.subject}\nFrom: ${
            email.from
          }\nEmail Body: ${email[content_column]}`;
        lastEmailDate = email.created_at;
      });

      return generatorFn({
        userId: id,
        emails: data,
        lastEmailDate,
        emailIds,
        emailText,
      });
    });
  }

  async insertEmail(email: Email) {
    const { data, error } = await this.db.from("emails").insert(email);
    return { data, error };
  }

  async validateAndSave(metadata: Email) {
    const email = await EMAIL_SCHEMA.validate(metadata);

    const userId = this.getEmailUserId(email);

    const { data: verifyData, error: verifyError } = await this.verifyUser(
      userId,
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
