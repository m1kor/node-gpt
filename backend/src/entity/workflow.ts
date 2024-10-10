import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Workflow {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column({ nullable: true })
    url: string

    @Column()
    apiKey: string

    @Column()
    model: string

    @Column()
    systemPrompt: string
}
