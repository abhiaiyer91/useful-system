"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const _1 = require("./");
const supabase = (0, supabase_js_1.createClient)("https://tsiddebqgokuesfocrti.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0");
const system = new _1.AccountsSystem({
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
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield system.deleteTransaction({ transaction_id: transaction.id });
        yield system.deleteWallet({ user_id: USER_ID });
    }));
    it("Open wallet", () => __awaiter(void 0, void 0, void 0, function* () {
        const wallet = yield system.openWallet(USER_ID);
        expect(wallet.user_id).toBe(USER_ID);
    }));
    it("Returns wallet balance", () => __awaiter(void 0, void 0, void 0, function* () {
        const wallet = yield system.getWallet(USER_ID);
        expect(wallet.balance).toBe(0);
    }));
    it("adjustBalance", () => __awaiter(void 0, void 0, void 0, function* () {
        yield system.adjustBalance({
            user_id: USER_ID,
            balance: 10,
            method: `add`,
        });
        let wallet = yield system.getWallet(USER_ID);
        expect(wallet.balance).toBe(10);
        yield system.adjustBalance({
            user_id: USER_ID,
            balance: 5,
            method: `subtract`,
        });
        wallet = yield system.getWallet(USER_ID);
        expect(wallet.balance).toBe(5);
    }));
    it("createTransaction", () => __awaiter(void 0, void 0, void 0, function* () {
        transaction = yield system.createTransaction({
            user_id: USER_ID,
            type: `STRIPE_CHECKOUT_SESSION`,
            description: `Purchasing tokens via Stripe Checkout`,
            externalId: `STRIPE_CHECKOUT_SESSION_ID`,
        });
        expect(transaction.id).toBeTruthy();
    }));
    it("getTransactionById", () => __awaiter(void 0, void 0, void 0, function* () {
        const tx = yield system.getTransactionById({
            transaction_id: transaction.id,
        });
        expect(tx.user_id).toBe(USER_ID);
    }));
    it("getTransactions", () => __awaiter(void 0, void 0, void 0, function* () {
        const transactions = yield system.getTransactions({
            user_id: USER_ID,
        });
        expect(transactions.length).toBeGreaterThan(0);
    }));
    it("getTransactionByExternalId", () => __awaiter(void 0, void 0, void 0, function* () {
        const tx = yield system.getTransactionByExternalId({
            external_id: EXTERNAL_ID,
        });
        expect(tx.id).toBe(transaction.id);
    }));
    it("setTransactionStatus", () => __awaiter(void 0, void 0, void 0, function* () {
        yield system.setTransactionStatus({
            transaction_id: transaction.id,
            status: `COMPLETE`,
        });
        const tx = yield system.getTransactionById({
            transaction_id: transaction.id,
        });
        expect(tx.status).toBe(`COMPLETE`);
    }));
    it("resolveTransaction", () => __awaiter(void 0, void 0, void 0, function* () {
        yield system.resolveTransaction({
            transaction_id: transaction.id,
        });
        const tx = yield system.getTransactionById({
            transaction_id: transaction.id,
        });
        let wallet = yield system.getWallet(USER_ID);
        expect(wallet.balance).toBe(105);
        expect(tx.status).toBe(`COMPLETE`);
    }));
});
