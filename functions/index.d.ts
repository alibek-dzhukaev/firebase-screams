// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {auth} from "firebase-admin";

declare global {
    namespace Express {
        import DecodedIdToken = auth.DecodedIdToken;

        interface Request {
            user: { handle: string, imageUrl: string } & DecodedIdToken
            rawBody: Buffer
        }
    }
}
