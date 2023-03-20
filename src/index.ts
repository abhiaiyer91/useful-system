import { SupabaseClient } from "@supabase/supabase-js";

type FetchExternalObj = ({
  type,
  external_id,
}: {
  type: string;
  external_id: string;
}) => any;

export class AccountsSystem {
  db: SupabaseClient;
  product_id: string;
  fetchExternalObject: FetchExternalObj;
  constructor({
    db,
    product_id,
    fetchExternalObject,
  }: {
    db: SupabaseClient;
    product_id: string;
    fetchExternalObject: FetchExternalObj;
  }) {
    this.db = db;
    this.fetchExternalObject = fetchExternalObject;
    this.product_id = product_id;
  }

  async openWallet(user_id: string) {
    const { data, error } = await this.db
      .from(`wallets`)
      .upsert({ user_id, balance: 0 })
      .select("*")
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async deleteWallet({ user_id }: { user_id: string }) {
    const { error } = await this.db
      .from(`wallets`)
      .delete()
      .eq("user_id", user_id);

    if (error) {
      throw error;
    }
  }

  async adjustBalance({
    user_id,
    balance,
    method,
  }: {
    method: "add" | "subtract";
    user_id: string;
    balance: number;
  }) {
    let wallet = await this.getWallet(user_id);

    if (!wallet) {
      wallet = await this.openWallet(user_id);
    }

    const newBalance = wallet.balance + (method === `add` ? balance : -balance);

    const { data, error } = await this.db
      .from(`wallets`)
      .upsert({ user_id, balance: newBalance })
      .select("*")

      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async getWallet(user_id: string) {
    const { data, error } = await this.db
      .from(`wallets`)
      .select("*")
      .eq("user_id", user_id)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async getTransactions({ user_id }: { user_id: string }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async getTransactionById({ transaction_id }: { transaction_id: string }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .select("*")
      .eq("id", transaction_id)
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async getTransactionByExternalId({ external_id }: { external_id: string }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .select("*")
      .eq("external_id", external_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async createTransaction({
    user_id,
    description,
    externalId,
    type,
  }: {
    type: string;
    externalId: string;
    user_id: string;
    description: string;
  }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .upsert({ user_id, description, type, external_id: externalId })
      .select("*")

      .limit(1);

    if (error) {
      throw error;
    }

    return data?.[0];
  }

  async setTransactionStatus({
    transaction_id,
    status,
  }: {
    transaction_id: string;
    status: string;
  }) {
    const { error } = await this.db
      .from(`transactions`)
      .update({ status })
      .eq("id", transaction_id)
      .select("*");

    if (error) {
      throw error;
    }
  }

  async deleteTransaction({ transaction_id }: { transaction_id: string }) {
    const { error } = await this.db
      .from(`transactions`)
      .delete()
      .eq("id", transaction_id);

    if (error) {
      throw error;
    }
  }

  async resolveStripeType({
    checkout_obj,
  }: {
    checkout_obj: {
      id: string;
      line_items: {
        data: {
          id: string;
          price: {
            id: string;
          };
          quantity: number;
        }[];
      };
    };
  }) {
    const external_id = checkout_obj.id;

    const tx = await this.getTransactionByExternalId({ external_id });

    const balanceAdjustment = checkout_obj.line_items?.data
      .filter((result) => {
        console.log(result);
        return result.price.id === this.product_id;
      })
      .map(({ quantity }) => {
        return quantity;
      })
      .reduce((partialSum, a) => partialSum + a, 0);

    await this.adjustBalance({
      user_id: tx.user_id,
      balance: balanceAdjustment,
      method: `add`,
    });
  }

  async resolveTransaction({ transaction_id }: { transaction_id: string }) {
    const transaction = await this.getTransactionById({
      transaction_id,
    });

    const externalObj = await this.fetchExternalObject({
      external_id: transaction.external_id,
      type: transaction.type,
    });

    switch (transaction.type) {
      case "STRIPE_CHECKOUT_SESSION": {
        await this.resolveStripeType({ checkout_obj: externalObj });
        break;
      }

      default: {
        throw new Error("Unsupport type found");
      }
    }

    await this.setTransactionStatus({
      transaction_id: transaction.id,
      status: `COMPLETE`,
    });
  }
}
