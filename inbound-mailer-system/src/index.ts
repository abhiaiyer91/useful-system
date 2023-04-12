import { SupabaseClient } from "@supabase/supabase-js";
import pMap from "p-map";
import { subDays } from "date-fns";
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

interface AudioFeedUrl {
  url: string;
  user_id: string;
  text: string;
  status: string;
}

interface AudioFeedText {
  user_id: string;
  text: string;
  status: string;
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

  async getEmailById(id: string) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("id", id)
      .neq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async getInboundUrlById(id: string) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("id", id)
      .neq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async getInboundTextById(id: string) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("id", id)
      .neq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
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
      .neq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedEmails(user_id: string, limit = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedUrls(user_id: string, limit: 5) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedText(user_id: string, limit: 5) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedEmailsInLastDay(user_id: string) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .gte("created_at", subDays(new Date(), 1).toISOString())
      .lte("created_at", new Date().toISOString());

    return { data, error };
  }

  async getProcessedUrlsInLastDay(user_id: string) {
    const { data, error } = await this.db
      .from("inbound_urls")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .gte("created_at", subDays(new Date(), 1).toISOString())
      .lte("created_at", new Date().toISOString());

    return { data, error };
  }

  async getProcessedTextInLastDay(user_id: string) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .gte("created_at", subDays(new Date(), 1).toISOString())
      .lte("created_at", new Date().toISOString());

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

  async updateInboundUrlsAsProcessed(user_id: string, url_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ status: "processed" })
      .in("id", url_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateInboundTextAsProcessed(user_id: string, url_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ status: "processed" })
      .in("id", url_ids)
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

  async updateInboundTextAsUnprocessed(user_id: string, text_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ status: "unprocessed" })
      .in("id", text_ids)
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
    const { data, error } = await this.db
      .from("emails")
      .insert(email)
      .select("*");
    return { data, error };
  }

  async insertInboundUrl(inboundUrl: AudioFeedUrl) {
    const { data, error } = await this.db
      .from("inbound_url")
      .insert(inboundUrl)
      .select("*");
    return { data, error };
  }

  async insertInboundText(inboundUrl: AudioFeedText) {
    const { data, error } = await this.db
      .from("inbound_text")
      .insert(inboundUrl)
      .select("*");
    return { data, error };
  }

  async validateEmailId(email_id: string) {
    const { data, error } = await this.db
      .from("emails")
      .select("id")
      .eq("id", email_id);

    if (error) {
      return false;
    }

    return !!data;
  }

  async validateInboundUrlId(url_id: string) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("id")
      .eq("id", url_id);

    if (error) {
      return false;
    }

    return !!data;
  }

  async validateInboundTextId(url_id: string) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("id")
      .eq("id", url_id);

    if (error) {
      return false;
    }

    return !!data;
  }

  async updateEmailWithSummary({
    email_id,
    summary,
  }: {
    email_id: string;
    summary: string;
  }) {
    const { data, error } = await this.db
      .from("emails")
      .update({ summary })
      .eq("id", email_id);
    return { data, error };
  }

  async updateInboundUrlWithSummary({
    url_id,
    summary,
  }: {
    url_id: string;
    summary: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ summary })
      .eq("id", url_id);
    return { data, error };
  }

  async updateInboundTextWithSummary({
    text_id,
    summary,
  }: {
    text_id: string;
    summary: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ summary })
      .eq("id", text_id);
    return { data, error };
  }

  async updateEmailWithAudio({
    email_id,
    audio_file,
  }: {
    email_id: string;
    audio_file: string;
  }) {
    const { data, error } = await this.db
      .from("emails")
      .update({ audio_file })
      .eq("id", email_id);
    return { data, error };
  }

  async updateInboundUrlWithAudio({
    url_id,
    audio_file,
  }: {
    url_id: string;
    audio_file: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ audio_file })
      .eq("id", url_id);
    return { data, error };
  }

  async updateInboundTextWithAudio({
    text_id,
    audio_file,
  }: {
    text_id: string;
    audio_file: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ audio_file })
      .eq("id", text_id);
    return { data, error };
  }

  async validateAndSaveInboundText(metadata: AudioFeedText) {
    const { data: verifyData, error: verifyError } = await this.verifyUser(
      metadata.user_id
    );

    if (verifyError || !verifyData?.id) {
      console.error("The User is not valid", verifyError);

      // Silent return
      return;
    }

    const { data: urlData, error: urlError } = await this.insertInboundText(
      metadata
    );

    if (urlError) {
      console.error("Unable to insert text into database", urlError);

      // Silent return
      return;
    }

    return urlData?.[0];
  }

  async validateAndSaveInboundUrl(metadata: AudioFeedUrl) {
    const { data: verifyData, error: verifyError } = await this.verifyUser(
      metadata.user_id
    );

    if (verifyError || !verifyData?.id) {
      console.error("The User is not valid", verifyError);

      // Silent return
      return;
    }

    const { data: urlData, error: urlError } = await this.insertInboundUrl(
      metadata
    );

    if (urlError) {
      console.error("Unable to insert email into database", urlError);

      // Silent return
      return;
    }

    return urlData?.[0];
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

    return emailData?.[0];
  }
}
