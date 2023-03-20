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
exports.AccountsSystem = void 0;
class AccountsSystem {
    constructor({ db, product_id, fetchExternalObject, }) {
        this.db = db;
        this.fetchExternalObject = fetchExternalObject;
        this.product_id = product_id;
    }
    openWallet(user_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`wallets`)
                .upsert({ user_id, balance: 0 })
                .select("*")
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    deleteWallet({ user_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield this.db
                .from(`wallets`)
                .delete()
                .eq("user_id", user_id);
            if (error) {
                throw error;
            }
        });
    }
    adjustBalance({ user_id, balance, method, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let wallet = yield this.getWallet(user_id);
            if (!wallet) {
                wallet = yield this.openWallet(user_id);
            }
            const newBalance = wallet.balance + (method === `add` ? balance : -balance);
            const { data, error } = yield this.db
                .from(`wallets`)
                .upsert({ user_id, balance: newBalance })
                .select("*")
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    getWallet(user_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`wallets`)
                .select("*")
                .eq("user_id", user_id)
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    getTransactions({ user_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`transactions`)
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", { ascending: false });
            if (error) {
                throw error;
            }
            return data;
        });
    }
    getTransactionById({ transaction_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`transactions`)
                .select("*")
                .eq("id", transaction_id)
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    getTransactionByExternalId({ external_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`transactions`)
                .select("*")
                .eq("external_id", external_id)
                .order("created_at", { ascending: false })
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    createTransaction({ user_id, description, externalId, type, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.db
                .from(`transactions`)
                .upsert({ user_id, description, type, external_id: externalId })
                .select("*")
                .limit(1);
            if (error) {
                throw error;
            }
            return data === null || data === void 0 ? void 0 : data[0];
        });
    }
    setTransactionStatus({ transaction_id, status, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield this.db
                .from(`transactions`)
                .update({ status })
                .eq("id", transaction_id)
                .select("*");
            if (error) {
                throw error;
            }
        });
    }
    deleteTransaction({ transaction_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield this.db
                .from(`transactions`)
                .delete()
                .eq("id", transaction_id);
            if (error) {
                throw error;
            }
        });
    }
    resolveStripeType({ checkout_obj, }) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const external_id = checkout_obj.id;
            const tx = yield this.getTransactionByExternalId({ external_id });
            const balanceAdjustment = (_a = checkout_obj.line_items) === null || _a === void 0 ? void 0 : _a.data.filter((result) => {
                console.log(result);
                return result.price.id === this.product_id;
            }).map(({ quantity }) => {
                return quantity;
            }).reduce((partialSum, a) => partialSum + a, 0);
            yield this.adjustBalance({
                user_id: tx.user_id,
                balance: balanceAdjustment,
                method: `add`,
            });
        });
    }
    resolveTransaction({ transaction_id }) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionById({
                transaction_id,
            });
            const externalObj = yield this.fetchExternalObject({
                external_id: transaction.external_id,
                type: transaction.type,
            });
            switch (transaction.type) {
                case "STRIPE_CHECKOUT_SESSION": {
                    yield this.resolveStripeType({ checkout_obj: externalObj });
                    break;
                }
                default: {
                    throw new Error("Unsupport type found");
                }
            }
        });
    }
}
exports.AccountsSystem = AccountsSystem;
