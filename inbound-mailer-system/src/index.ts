import { SupabaseClient } from "@supabase/supabase-js";
import pMap from "p-map";
import { orderBy } from "lodash";
import { formatISO, subDays } from "date-fns";
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
  feed_id: string;
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
  feed_id: string;
  user_id: string;
  text: string;
  status: string;
}

interface AudioFeedText {
  user_id: string;
  feed_id: string;
  text: string;
  status: string;
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
    const emailRegex =
      /(?:[<"])?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[">]?/;
    const match = email.to.match(emailRegex);
    if (match) {
      return match[1].split("@")[0];
    }
    return null;
  }

  async deleteImageFromStorage(bucket: string, path: string) {
    const { data, error } = await this.db.storage.from(bucket).remove([path]);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getFeedsByUserId(userId: string) {
    const { data, error } = await this.db
      .from("feeds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getFeedsById(id: string) {
    const { data, error } = await this.db
      .from("feeds")
      .select("*")
      .eq("id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async getPublicFeedsByPath(path: string) {
    const { data, error } = await this.db
      .from("feeds")
      .select("*")
      .eq("path", path)
      .eq("private", false)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async getFeedImage(user_id: string, feed_id: string) {
    const { data, error } = await this.db.storage
      .from("feed_images")
      .list(user_id + "/" + feed_id, { limit: 1 });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getStorageFilesByPath(
    bucket: string,
    path: string,
    limit: number = 100
  ) {
    const { data, error } = await this.db.storage
      .from(bucket)
      .list(path, { limit });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getPublicUrlFromBucket(bucketId: string, path: string) {
    const { data } = await this.db.storage.from(bucketId).getPublicUrl(path);

    return data;
  }

  async isFeedPathAvailable(path: string) {
    const { data, error } = await this.db
      .from("feeds")
      .select("id")
      .eq("path", path)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return !data.length;
  }

  async updateFeed(id: string, update: any) {
    const { data, error } = await this.db
      .from("feeds")
      .update(update)
      .eq("id", id);

    return { data, error };
  }

  async getEmailById(id: string) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("id", id)
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
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("error found", error);
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

  async getUnprocessedEmails(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .neq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getUnprocessedJobsByFeedId(feed_id: string) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const { data: urlData, error: urlError } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (urlError) {
      throw new Error(urlError.message);
    }

    const { data: textData, error: textError } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (textError) {
      throw new Error(textError.message);
    }

    const items = orderBy(
      [...data, ...urlData, ...textData],
      "created_at",
      "desc"
    );

    return items;
  }

  async getProcessedEpisodesByFeedIds(feed_ids: string[], limit: number = 20) {
    const { data, error } = await this.db
      .from("episodes_view")
      .select("*")
      .in("feed_id", feed_ids)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedEmailsByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedUrlsByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedTextByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedEmailsByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedUrlsByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedTextByFeedId(feed_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("feed_id", feed_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedEmails(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedUrls(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedText(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedEmails(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedUrls(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getArchivedText(user_id: string, limit: number = 5) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data, error };
  }

  async getProcessedJobsCountInLastMonth(
    user_id: string,
    current_period_start: Date,
    current_period_end: Date
  ) {
    let total: any = [];

    const emails = await this.getProcessedEmailsInLastMonth(
      user_id,
      current_period_start,
      current_period_end
    );

    total = total.concat(emails?.data || []);

    const text = await this.getProcessedTextInLastMonth(
      user_id,
      current_period_start,
      current_period_end
    );

    total = total.concat(text?.data || []);

    const url = await this.getProcessedUrlsInLastMonth(
      user_id,
      current_period_start,
      current_period_end
    );

    total = total.concat(url?.data || []);

    return total?.length;
  }

  async getProcessedEmailsInLastMonth(
    user_id: string,
    current_period_start: Date,
    current_period_end: Date
  ) {
    const { data, error } = await this.db
      .from("emails")
      .select("*")
      .eq("user_id", user_id)
      .in("status", ["processed", "archived"])
      .gte("created_at", formatISO(current_period_start))
      .lte("created_at", formatISO(current_period_end));

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
      .from("inbound_url")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "processed")
      .gte("created_at", subDays(new Date(), 1).toISOString())
      .lte("created_at", new Date().toISOString());

    return { data, error };
  }

  async getProcessedUrlsInLastMonth(
    user_id: string,
    current_period_start: Date,
    current_period_end: Date
  ) {
    const { data, error } = await this.db
      .from("inbound_url")
      .select("*")
      .eq("user_id", user_id)
      .in("status", ["processed", "archived"])
      .gte("created_at", formatISO(current_period_start))
      .lte("created_at", formatISO(current_period_end));

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

  async getProcessedTextInLastMonth(
    user_id: string,
    current_period_start: Date,
    current_period_end: Date
  ) {
    const { data, error } = await this.db
      .from("inbound_text")
      .select("*")
      .eq("user_id", user_id)
      .in("status", ["processed", "archived"])
      .gte("created_at", formatISO(current_period_start))
      .lte("created_at", formatISO(current_period_end));

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

  async updateEmailsAsFailed(
    user_id: string,
    email_ids: string[],
    errorMessage: string
  ) {
    const { data, error } = await this.db
      .from("emails")
      .update({ status: "failed", error: errorMessage })
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

  async updateInboundUrlsAsFailed(
    user_id: string,
    url_ids: string[],
    errorMessage: string
  ) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ status: "failed", error: errorMessage })
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

  async updateInboundTextAsFailed(
    user_id: string,
    url_ids: string[],
    errorMessage: string
  ) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ status: "failed", error: errorMessage })
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

  async updateEmailsAsCancelled(user_id: string, email_ids: string[]) {
    const { data, error } = await this.db
      .from("emails")
      .update({ status: "cancelled" })
      .in("id", email_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateInboundTextAsCancelled(user_id: string, text_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ status: "cancelled" })
      .in("id", text_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateInboundUrlsAsCancelled(user_id: string, url_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ status: "cancelled" })
      .in("id", url_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateEmailsAsArchived(user_id: string, email_ids: string[]) {
    const { data, error } = await this.db
      .from("emails")
      .update({ status: "archived" })
      .in("id", email_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateInboundTextAsArchived(user_id: string, text_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ status: "archived" })
      .in("id", text_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async updateInboundUrlsAsArchived(user_id: string, url_ids: string[]) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ status: "archived" })
      .in("id", url_ids)
      .eq("user_id", user_id);
    return { data, error };
  }

  async insertFeedSubscription(user_id: string, feed_id: string) {
    const { data, error } = await this.db
      .from("feed_subscriptions")
      .insert({
        user_id,
        feed_id,
      })
      .select()
      .single();
    return { data, error };
  }

  async deleteFeedSubscription(user_id: string, feed_id: string) {
    const { data, error } = await this.db
      .from("feed_subscriptions")
      .delete()
      .match({ user_id, feed_id });
    return { data, error };
  }

  async getFeedSubscription(user_id: string, feed_id: string) {
    const { data, error } = await this.db
      .from("feed_subscriptions")
      .select("*")
      .match({ user_id, feed_id })
      .maybeSingle();
    return { data, error };
  }

  async getFeedSubscriptionsByUserId(user_id: string) {
    const { data, error } = await this.db
      .from("feed_subscriptions")
      .select("*")
      .match({ user_id });
    return { data, error };
  }

  async uploadImage(
    bucket: string,
    path: string,
    mimeType: string,
    file: any,
    upsert: boolean = true
  ) {
    const { data, error } = await this.db.storage
      .from(bucket)
      .upload(path, file, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: upsert,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data;
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

  async validateFeedId(feed_id: string) {
    const { data, error } = await this.db
      .from("feeds")
      .select("id")
      .eq("id", feed_id);

    if (error) {
      return false;
    }

    return !!data;
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
    category,
    title,
  }: {
    title: string;
    email_id: string;
    summary: string;
    category: string;
  }) {
    const { data, error } = await this.db
      .from("emails")
      .update({ summary, category, title })
      .eq("id", email_id);
    return { data, error };
  }

  async updateInboundUrlWithSummary({
    url_id,
    summary,
    category,
    title,
  }: {
    title: string;
    url_id: string;
    summary: string;
    category: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ title, summary, category })
      .eq("id", url_id);
    return { data, error };
  }

  async updateInboundTextWithSummary({
    text_id,
    summary,
    category,
    title,
  }: {
    text_id: string;
    summary: string;
    category: string;
    title: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ title, summary, category })
      .eq("id", text_id);
    return { data, error };
  }

  async updateEmailWithAudio({
    email_id,
    audio_file,
    duration,
    output_type = `summarize`,
  }: {
    email_id: string;
    audio_file: string;
    duration: number;
    output_type: string;
  }) {
    const { data, error } = await this.db
      .from("emails")
      .update({ audio_file, duration, output_type })
      .eq("id", email_id);
    return { data, error };
  }

  async updateInboundUrlWithAudio({
    url_id,
    audio_file,
    duration,
    output_type = `summarize`,
  }: {
    url_id: string;
    duration: number;
    output_type: string;
    audio_file: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_url")
      .update({ audio_file, duration, output_type })
      .eq("id", url_id);
    return { data, error };
  }

  async updateInboundTextWithAudio({
    text_id,
    audio_file,
    duration,
    output_type = `summarize`,
  }: {
    text_id: string;
    duration: number;
    output_type: string;
    audio_file: string;
  }) {
    const { data, error } = await this.db
      .from("inbound_text")
      .update({ audio_file, duration, output_type })
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

    const feedId = this.getEmailUserId(email);

    if (!feedId) {
      console.error(`The Email ${email?.to} is not valid`);

      // Silent return
      return;
    }

    const feed = await this.getFeedsById(feedId);

    const { data: verifyData, error: verifyError } = await this.verifyUser(
      feed.user_id
    );

    if (verifyError || !verifyData?.id) {
      console.error("The User is not valid", verifyError);

      // Silent return
      return;
    }

    const { data: emailData, error: emailError } = await this.insertEmail({
      user_id: verifyData.id,
      feed_id: feedId,
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

  async getEpisodeViewById(episode_id: string) {
    const { data, error } = await this.db
      .from("episodes_view")
      .select("*")
      .eq("id", episode_id)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async insertEpisodeAnalytics(analytics: any) {
    const { data, error } = await this.db
      .from("episode_analytics")
      .insert(analytics)
      .select()
      .single();
    return { data, error };
  }

  // url_episode_map ops
  async getEpisodeByUrl(path: string) {
    const { data, error } = await this.db
      .from("url_episode_map")
      .select("id, episode_id")
      .eq("url", path)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  async insertUrlEpisodeMap(url: string, episode_id: string) {
    const { data, error } = await this.db
      .from("url_episode_map")
      .insert({
        url,
        episode_id,
      })
      .select()
      .single();
    return { data, error };
  }
}
