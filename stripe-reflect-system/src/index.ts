import { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export class StripeReflection {
  db: SupabaseClient;
  debug: boolean;
  stripe: Stripe;
  constructor({
    db,
    debug,
    stripe,
  }: {
    db: SupabaseClient;
    debug?: boolean;
    stripe: Stripe;
  }) {
    this.debug = !!debug;
    this.db = db;
    this.stripe = stripe;
  }

  async upsertProductRecord(product: Stripe.Product) {
    const { error } = await this.db.from("products").upsert({
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description,
      image: product.images?.[0] ?? null,
      metadata: product.metadata,
    });

    if (error) {
      console.error(
        `Error occurred while saving the product: ${error.message}`
      );
    } else {
      console.log(`Product saved: ${product.id}`);
    }
  }

  async deleteProductRecord(product: Stripe.Product) {
    const { error: priceDeleteError } = await this.db
      .from("prices")
      .delete()
      .match({ product_id: product.id });

    if (!priceDeleteError) {
      const { error: productDeleteError } = await this.db
        .from("products")
        .delete()
        .match({ id: product.id });

      if (productDeleteError) {
        console.error(
          `Error occurred while deleting the product: ${productDeleteError.message}`
        );
      } else {
        console.log(`Prices and product deleted: ${product.id}`);
      }
    } else {
      console.error(
        `Error occurred while deleting the prices for product: ${priceDeleteError.message}`
      );
    }
  }

  async upsertPriceRecord(price: Stripe.Price) {
    const { error } = await this.db.from("prices").upsert({
      id: price.id,
      product_id: price.product,
      active: price.active,
      currency: price.currency,
      description: price.nickname,
      type: price.type,
      unit_amount: price.unit_amount,
      interval: price.recurring?.interval ?? null,
      interval_count: price.recurring?.interval_count ?? null,
      trial_period_days: price.recurring?.trial_period_days ?? null,
      metadata: price.metadata,
    });

    if (error) {
      console.error(`Error occurred while saving the price: ${error.message}`);
    } else {
      console.log(`Price saved: ${price.id}`);
    }
  }

  async deletePriceRecord(price: Stripe.Price) {
    const { error } = await this.db
      .from("prices")
      .delete()
      .match({ id: price.id });

    if (error) {
      console.error(
        `Error occurred while deleting the price: ${error.message}`
      );
    } else {
      console.log(`Price deleted: ${price.id}`);
    }
  }

  async getOrCreateCustomer(
    uuid: string,
    email: string
  ): Promise<string | null> {
    const { data, error: selectError } = await this.db
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", uuid)
      .single();

    if (selectError) {
      const customerData = {
        email: email,
        metadata: {
          supabaseUUID: uuid,
        },
      };

      const customer = await this.stripe.customers.create(customerData);
      const { error: insertError } = await this.db
        .from("stripe_customers")
        .insert([
          {
            user_id: uuid,
            stripe_customer_id: customer.id,
          },
        ]);

      if (insertError) {
        console.error(insertError);
        return null;
      }

      return customer.id;
    }

    return data?.stripe_customer_id;
  }

  async deleteCustomer(stripeCustomerId: string) {
    const { data, error: selectError } = await this.db
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();

    if (selectError) {
      console.warn(
        `Customer with ID '${stripeCustomerId}' does not exist. Error: ${selectError.message}`
      );
      return;
    }

    const { error: deleteSubscriptionError } = await this.db
      .from("subscriptions")
      .delete()
      .match({ user_id: data.user_id });

    if (deleteSubscriptionError) {
      console.warn(
        `Could not delete subscription for customer with ID '${stripeCustomerId}'. Error: ${deleteSubscriptionError.message}`
      );
      return;
    }

    const { error: deleteCustomerError } = await this.db
      .from("stripe_customers")
      .delete()
      .match({ stripe_customer_id: stripeCustomerId });

    if (deleteCustomerError) {
      console.warn(
        `Could not delete customer with ID '${stripeCustomerId}'. Error: ${deleteCustomerError.message}`
      );
    } else {
      console.log(
        `Customer with ID '${stripeCustomerId}' deleted successfully.`
      );
    }
  }
}
