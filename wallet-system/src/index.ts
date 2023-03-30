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
  fetchExternalObject: FetchExternalObj;
  constructor({
    db,
    fetchExternalObject,
  }: {
    db: SupabaseClient;
    fetchExternalObject: FetchExternalObj;
  }) {
    this.db = db;
    this.fetchExternalObject = fetchExternalObject;
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

    if (newBalance < 0) {
      throw new Error("Cannot adjust balance to below zero");
    }

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

  async getTransactions({
    user_id,
    start = 0,
    pageSize = 25,
  }: {
    user_id: string;
    start?: number;
    pageSize?: number;
  }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .range(start, start + (pageSize - 1));

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
    balance,
  }: {
    balance?: number;
    type: string;
    externalId: string;
    user_id: string;
    description: string;
  }) {
    const { data, error } = await this.db
      .from(`transactions`)
      .upsert({ user_id, description, type, external_id: externalId, balance })
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
            metadata: {
              tokens: string;
            };
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
        return result.price.metadata.tokens;
      })
      .map(({ quantity, price }) => {
        return quantity * parseInt(price.metadata.tokens, 10);
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

    try {
      switch (transaction.type) {
        case "STRIPE_CHECKOUT_SESSION": {
          const externalObj = await this.fetchExternalObject({
            external_id: transaction.external_id,
            type: transaction.type,
          });

          await this.resolveStripeType({ checkout_obj: externalObj });
          break;
        }

        case "SPEND_BALANCE": {
          await this.adjustBalance({
            user_id: transaction.user_id,
            balance: transaction.balance,
            method: `subtract`,
          });
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
    } catch (e) {
      await this.setTransactionStatus({
        transaction_id: transaction.id,
        status: `FAILED`,
      });
    }
  }
}
