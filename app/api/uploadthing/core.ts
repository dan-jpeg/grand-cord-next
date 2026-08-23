import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { auth } from "@/lib/auth"

const f = createUploadthing()

export const ourFileRouter = {
    // Uploads are admin-only. This route has no other gate in front of it —
    // without a middleware it is an open, unauthenticated write into the
    // UploadThing account for anyone who can reach the deployment.
    productImage: f({ image: { maxFileSize: "16MB", maxFileCount: 10 } })
        .middleware(async () => {
            const session = await auth()
            if (!session?.user) throw new UploadThingError("Unauthorized")
            return { adminUserId: session.user.id as string }
        })
        .onUploadComplete(async ({ file, metadata }) => {
            console.log("Upload complete:", file.url, "by", metadata.adminUserId)
            return { url: file.url }
        }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
