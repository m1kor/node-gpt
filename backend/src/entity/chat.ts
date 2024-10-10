import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from "typeorm"
import { Message } from "@/entity/message"
import { User } from "@/entity/user"
import { Workflow } from "@/entity/workflow"

@Entity()
export class Chat {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @OneToMany(() => Message, message => message.chat)
    messages: Message[]

    @ManyToOne(() => User, user => user.chats)
    user: User

    get workflow(): Workflow {
        return this.messages[this.messages.length - 1].workflow;
    }
}
