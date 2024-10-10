import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm"
import { Workflow } from "@/entity/workflow"
import { Chat } from "@/entity/chat"

@Entity()
export class Message {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    content: string

    @Column()
    date_posted: Date

    @Column()
    role: string

    @ManyToOne(() => Workflow)
    workflow: Workflow

    @ManyToOne(() => Chat, chat => chat.messages)
    chat: Chat
}
