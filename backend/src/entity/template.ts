import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Template {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column()
    content: string
}
