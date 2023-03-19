import { createClient } from "@supabase/supabase-js";

import { AccountsSystem } from "./";

const supabase = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new AccountsSystem({
  db: supabase,
  product_id: `test`,
  fetchExternalObject: ({ type, external_id }) => {
    if (type === `STRIPE_CHECKOUT_SESSION`) {
      return {
        id: external_id,
        line_items: [
          {
            id: `test`,
            quantity: 100,
          },
        ],
      };
    }

    return null;
  },
});

const USER_ID = `USER_ID`;
const EXTERNAL_ID = `STRIPE_CHECKOUT_SESSION_ID`;

describe("AccountSystem", () => {
  let transaction;

  afterAll(async () => {
    await system.deleteTransaction({ transaction_id: transaction.id });
    await system.deleteWallet({ user_id: USER_ID });
  });

  it("Open wallet", async () => {
    const wallet = await system.openWallet(USER_ID);

    expect(wallet.user_id).toBe(USER_ID);
  });
  it("Returns wallet balance", async () => {
    const wallet = await system.getWallet(USER_ID);

    expect(wallet.balance).toBe(0);
  });

  it("adjustBalance", async () => {
    await system.adjustBalance({
      user_id: USER_ID,
      balance: 10,
      method: `add`,
    });

    let wallet = await system.getWallet(USER_ID);

    expect(wallet.balance).toBe(10);

    await system.adjustBalance({
      user_id: USER_ID,
      balance: 5,
      method: `subtract`,
    });

    wallet = await system.getWallet(USER_ID);

    expect(wallet.balance).toBe(5);
  });

  it("createTransaction", async () => {
    transaction = await system.createTransaction({
      user_id: USER_ID,
      type: `STRIPE_CHECKOUT_SESSION`,
      description: `Purchasing tokens via Stripe Checkout`,
      externalId: `STRIPE_CHECKOUT_SESSION_ID`,
    });

    expect(transaction.id).toBeTruthy();
  });

  it("getTransactionById", async () => {
    const tx = await system.getTransactionById({
      transaction_id: transaction.id,
    });

    expect(tx.user_id).toBe(USER_ID);
  });

  it("getTransactions", async () => {
    const transactions = await system.getTransactions({
      user_id: USER_ID,
    });

    expect(transactions.length).toBeGreaterThan(0);
  });

  it("getTransactionByExternalId", async () => {
    const tx = await system.getTransactionByExternalId({
      external_id: EXTERNAL_ID,
    });

    expect(tx.id).toBe(transaction.id);
  });

  it("setTransactionStatus", async () => {
    await system.setTransactionStatus({
      transaction_id: transaction.id,
      status: `COMPLETE`,
    });

    const tx = await system.getTransactionById({
      transaction_id: transaction.id,
    });

    expect(tx.status).toBe(`COMPLETE`);
  });

  it("resolveTransaction", async () => {
    await system.resolveTransaction({
      transaction_id: transaction.id,
    });

    const tx = await system.getTransactionById({
      transaction_id: transaction.id,
    });

    let wallet = await system.getWallet(USER_ID);

    expect(wallet.balance).toBe(105);

    expect(tx.status).toBe(`COMPLETE`);
  });
});
