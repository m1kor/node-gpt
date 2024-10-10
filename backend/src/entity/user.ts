import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm"
import { AppDataSource } from "@/data-source"
import { Chat } from "@/entity/chat"
import { verify } from "argon2"
import { randomUUID } from "crypto"

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    username: string

    @Column()
    password: string

    @Column({ unique: true, nullable: true })
    session: string

    @OneToMany(() => Chat, chat => chat.user)
    chats: Chat[]

    static online: { [id: number]: NodeJS.Timeout } = {}

    static async authenticate(username: string, password: string): Promise<User | null> {
        const user = await AppDataSource.getRepository(User).findOne({ where: { username: username } });
        try {
            if (user && await verify(user.password, password)) {
                let session: string;
                do {
                    session = randomUUID();
                } while (await AppDataSource.getRepository(User).findOne({ where: { session: session } }));
                user.session = session;
                await AppDataSource.getRepository(User).save(user);
                return user;
            } else {
                return null;
            }
        } catch (e) {
            return null;
        }
    }

    static async fromSession(session: string): Promise<User | null> {
        if (session && session.length > 0) {
            return await AppDataSource.getRepository(User).findOne({ where: { session: session } });
        } else {
            return null;
        }
    }
}
