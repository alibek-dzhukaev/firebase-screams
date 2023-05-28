import {NextFunction, Request, Response} from "express";
import * as admin from "firebase-admin";
import {db} from "./admin";
import {TUser} from "../models/user";
import {Collections} from "../context/firebase";

export const FBAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let idToken: string;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    idToken = req.headers.authorization.split(" ")[1];
  } else {
    console.error("no token found");
    res.status(403).json({error: "Unauthorized"});
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    const documentData = await db.collection(Collections.USERS)
        .where("userId", "==", decodedIdToken.uid)
        .limit(1)
        .get();
    const {handle, imageUrl} = documentData.docs[0].data() as TUser;
    req.user = {...decodedIdToken, handle, imageUrl};
    return next();
  } catch (err) {
    console.error("Error while verifying token: ", err);
    res.status(403).json(err);
  }
};
