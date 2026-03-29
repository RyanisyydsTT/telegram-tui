import { TelegramClient, Api } from "telegram/index.js";
import { StringSession } from "telegram/sessions/index.js";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";
const sessionFile = "session.txt";

export class TelegramManager {
    private client: TelegramClient;
    private session: StringSession;

    constructor() {
        let sessionData = "";
        if (fs.existsSync(sessionFile)) {
            sessionData = fs.readFileSync(sessionFile, "utf8");
        }
        this.session = new StringSession(sessionData);
        this.client = new TelegramClient(this.session, apiId, apiHash, {
            connectionRetries: 5,
        });
    }

    async connect() {
        await this.client.connect();
    }

    async isAuthorized() {
        return await this.client.isUserAuthorized();
    }

    async logout() {
        try {
            await this.client.invoke(new Api.auth.LogOut({}));
        } catch (e) {
            // Ignore if already logged out
        }
        if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
        }
        // Re-initialize client for next login
        this.session = new StringSession("");
        this.client = new TelegramClient(this.session, apiId, apiHash, {
            connectionRetries: 5,
        });
        await this.client.connect();
    }

    async getQRLink() {
        let loginToken = await this.client.invoke(
            new Api.auth.ExportLoginToken({
                apiId,
                apiHash,
                exceptIds: [],
            })
        ) as any;

        if (loginToken instanceof Api.auth.LoginTokenMigrateTo) {
            await (this.client as any)._switchDC(loginToken.dcId);
            loginToken = await this.client.invoke(
                new Api.auth.ImportLoginToken({
                    token: loginToken.token,
                })
            ) as any;
        }

        if (loginToken instanceof Api.auth.LoginTokenSuccess) {
            return null;
        }

        const tokenBase64 = loginToken.token.toString("base64url");
        return `tg://login?token=${tokenBase64}`;
    }

    async waitForLogin() {
        while (!(await this.isAuthorized())) {
            try {
                let loginToken = await this.client.invoke(
                    new Api.auth.ExportLoginToken({
                        apiId,
                        apiHash,
                        exceptIds: [],
                    })
                ) as any;

                if (loginToken instanceof Api.auth.LoginTokenMigrateTo) {
                    await (this.client as any)._switchDC(loginToken.dcId);
                    loginToken = await this.client.invoke(
                        new Api.auth.ImportLoginToken({
                            token: loginToken.token,
                        })
                    ) as any;
                }

                if (loginToken instanceof Api.auth.LoginTokenSuccess) {
                    fs.writeFileSync(sessionFile, this.client.session.save() as any);
                    return true;
                }
            } catch (e) {
                // Ignore errors
            }
            await new Promise((r) => setTimeout(r, 2000));
        }
        fs.writeFileSync(sessionFile, this.client.session.save() as any);
        return true;
    }

    async getChats() {
        const dialogs = await this.client.getDialogs({});
        return dialogs.map(d => {
            const isForum = (d.entity as any)?.forum || false;
            let canSend = true;
            
            if (d.entity instanceof Api.Channel) {
                if (d.entity.broadcast) canSend = d.entity.creator || (d.entity.adminRights?.postMessages ?? false);
                else if (d.entity.defaultBannedRights) canSend = !d.entity.defaultBannedRights.sendMessages;
            }

            return {
                id: d.id,
                name: d.title || "Unknown",
                unreadCount: d.unreadCount,
                isForum,
                canSend,
            };
        });
    }

    async getForumTopics(chatId: any) {
        const result = await this.client.invoke(
            new Api.channels.GetForumTopics({
                channel: chatId,
                offsetDate: 0,
                offsetId: 0,
                offsetTopic: 0,
                limit: 20,
            })
        ) as any;

        return result.topics.map((t: any) => ({
            id: t.id,
            name: t.title || "General",
        }));
    }

    async getMessages(chatId: any, topicId?: number, limit = 20, offsetId?: number) {
        const messages = await this.client.getMessages(chatId, { 
            limit,
            offsetId,
            ...(topicId ? { replyTo: topicId } : {})
        });
        return messages.map(m => ({
            id: m.id,
            sender: m.senderId?.toString() || "System",
            text: (m as any).message || "",
            date: m.date,
        }));
    }

    async sendMessage(chatId: any, text: string, topicId?: number) {
        await this.client.sendMessage(chatId, { 
            message: text,
            ...(topicId ? { replyTo: topicId } : {})
        });
    }

    getClient() {
        return this.client;
    }
}
