export type TNotification = {
    recipient: string
    sender: string
    read: boolean
    screamId: string
    type: "like" | "comment"
    createdAt: string
}
