import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/storage";
import "firebase/compat/database";
import {Request, Response} from "express";
import admin, {db} from "../util/admin";
import {config} from "../util/config";
import {reduceUserDetails, validateLoginData, validateSignupData} from "../util/validators";
import * as Busboy from "busboy";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {v4 as uuid} from "uuid";
import {TUser} from "../models/user";
import {TLike} from "../models/like";
import {TNotification} from "../models/notification";
import {Collections} from "../context/firebase";
import {TScream} from "../models/scream";

firebase.initializeApp(config);

// sign user up
export const signup = async (req: Request, res: Response): Promise<void> => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  const {valid, errors} = validateSignupData(newUser);

  if (!valid) {
    res.status(400).json({errors});
    return;
  }

  const noImg = "no-image.jpeg";
  const imgToken = "897a2b23-b42c-4272-b06c-26d96b5e8b28";

  try {
    const snapshot = await db.doc(`/users/${newUser.handle}`).get();
    if (snapshot.exists) {
      res.status(400).json({handle: "This handle is already taken"});
      return;
    }

    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
      const token = await userCredential.user?.getIdToken();
      const user = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media&token=${imgToken}`,
        userId: userCredential.user?.uid,
      };
      await db.doc(`/users/${newUser.handle}`).set(user);
      res.status(201).json({token});
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        res.status(500).json({email: "Email is already in use"});
      } else {
        res.status(500).json({error: err.code});
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// log user in
export const login = async (req: Request, res: Response): Promise<void> => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  const {valid, errors} = validateLoginData(user);

  if (!valid) {
    res.status(400).json({errors});
    return;
  }

  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(user.email, user.password);
    const token = await userCredential.user?.getIdToken();
    res.json({token});
  } catch (err) {
    res.status(403).json({general: "Wrong credentials, please try again"});
  }
};

// add user details
export const addUserDetails = async (req: Request, res: Response): Promise<void> => {
  const userDetails = reduceUserDetails(req.body);
  try {
    await db.doc(`/users/${req.user.handle}`).update(userDetails);
    res.json({message: "Details added successfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// get own user details
export const getAuthenticatedUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = {} as {
            credentials: TUser,
            likes: TLike[],
            notifications: Array<{ notificationId: string } & TNotification>
        };

    const userSnapshot = await db
        .doc(`/users/${req.user.handle}`)
        .get();

    if (userSnapshot.exists) {
      userData.credentials = userSnapshot.data() as TUser;
    }
    const likesSnapshot = await db
        .collection(Collections.LIKES)
        .where("userHandle", "==", req.user.handle)
        .get();

    userData.likes = [];
    likesSnapshot.forEach((doc) => {
      userData.likes.push(doc.data() as TLike);
    });
    const notificationSnapshot = await db
        .collection(Collections.NOTIFICATIONS)
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .get();

    userData.notifications = [];
    notificationSnapshot.forEach((doc) => {
      userData.notifications.push({
        ...doc.data() as TNotification,
        notificationId: doc.id,
      });
    });
    res.json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// upload a profile image for user
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  const busboy = new Busboy({headers: req.headers});

  let imageFileName: string;
  let imageToBeUploaded: { filepath: string; mimetype: string };

  busboy.on("file", (fieldName, file, fileName, encoding, mimetype) => {
    if (!["image/jpeg", "image/png"].includes(mimetype)) {
      res.status(400).json({error: "Wring file type submitted"});
      return;
    }
    const imageExtension = fileName.split(".")[fileName.split(".").length - 1];
    imageFileName = `${uuid()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = {filepath, mimetype};
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on("finish", async () => {
    try {
      const token = uuid();
      await admin.storage().bucket().upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
            firebaseStorageDownloadTokens: token,
          },
        },
      });
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media&token=${token}`;
      await db.doc(`/users/${req.user.handle}`).update({imageUrl});
      res.json({message: "Image uploaded successfully"});
    } catch (err) {
      console.error(err);
      res.status(500).json({error: err.code});
    }
  });


  busboy.end(req.rawBody);
};

export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = {} as {user: TUser; screams: Array<{screamId: string} & TScream>};

    const doc = await db.doc(`/users/${req.params.handle}`).get();
    if (!doc.exists) {
      res.status(404).json({error: "User not found"});
      return;
    }
    userData.user = doc.data() as TUser;
    const screamSnapshot = await db
        .collection(Collections.SCREAMS)
        .where("userHandle", "==", req.params.handle)
        .orderBy("createdAt", "desc")
        .get();

    userData.screams = [];
    screamSnapshot.forEach((doc) => {
      userData.screams.push({
        screamId: doc.id,
        ...doc.data() as TScream,
      });
    });
    res.json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

export const markNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const batch = db.batch();
    req.body.forEach((notificationId: string) => {
      const notification = db.doc(`/notification/${notificationId}`);
      batch.update(notification, {read: true});
    });
    await batch.commit();
    res.json({message: "Notification marked read"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};
