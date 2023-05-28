import * as functions from "firebase-functions";
import * as express from "express";
import {
  commentOnScream,
  deleteScream,
  getAllScreams,
  getScream,
  likeScream,
  postOneScream,
  unlikeScream,
} from "./handlers/screams";
import {
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  login,
  markNotificationsRead,
  signup,
  uploadImage,
} from "./handlers/users";
import {FBAuth} from "./util/fbAuth";
import {db} from "./util/admin";
import {TNotification} from "./models/notification";
import {TLike} from "./models/like";
import {TScream} from "./models/scream";
import {Collections} from "./context/firebase";
import {TUser} from "./models/user";

const app = express();

// scream routes
app.get("/screams", getAllScreams);
app.post("/screams", FBAuth, postOneScream);
app.get("/screams/:screamId", getScream);
app.delete("/screams/:screamId", FBAuth, deleteScream);
app.get("/screams/:screamId/like", FBAuth, likeScream);
app.get("/screams/:screamId/unlike", FBAuth, unlikeScream);
app.post("/screams/:screamId/comment", FBAuth, commentOnScream);

// sign up routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

export const api = functions.https.onRequest(app);

export const createNotificationOnLike = functions
    .firestore
    .document("/likes/{id}")
    .onCreate(async (snapshot) => {
      try {
        const doc = await db.doc(`/screams/${snapshot.data().screamId}`).get();
        if (!doc.exists && (doc.data() as TScream).userHandle === (snapshot.data() as TLike).userHandle) {
          return false;
        }
        await db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          recipient: (doc.data() as TScream).userHandle,
          sender: (snapshot.data() as TLike).userHandle,
          screamId: doc.id,
          type: "like",
          read: false,
        } as TNotification);
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    });

export const deleteNotificationOnUnlike = functions
    .firestore
    .document("likes/{id}")
    .onDelete(async (snapshot) => {
      try {
        await db.doc(`/notifications/${snapshot.id}`).delete();
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    });

export const createNotificationOnComment = functions
    .firestore
    .document("comments/{id}")
    .onCreate(async (snapshot) => {
      try {
        const doc = await db.doc(`/screams/${snapshot.data().screamId}`).get();
        if (!doc.exists) {
          return false;
        }
        await db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          recipient: (doc.data() as TScream).userHandle,
          sender: (snapshot.data() as TLike).userHandle,
          screamId: doc.id,
          type: "comment",
          read: false,
        } as TNotification);
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    });

export const onUserImageChange = functions
    .firestore
    .document("/users/{userId}")
    .onUpdate(async (change) => {
      const oldData = change.before.data() as TUser;
      const newData = change.after.data() as TUser;

      if (oldData.imageUrl === newData.imageUrl) {
        return false;
      }

      try {
        const batch = db.batch();
        const userSnapshot = await db
            .collection(Collections.SCREAMS)
            .where("userHandle", "==", oldData.handle)
            .get();

        userSnapshot.forEach((doc) => {
          const scream = db.doc(`/screams/${doc.id}`);
          batch.update(scream, {userImage: newData.imageUrl});
        });
        await batch.commit();
        return true;
      } catch (err) {
        return false;
      }
    });

export const onScreamDelete = functions
    .firestore
    .document("screams/{screamId}")
    .onDelete(async (snapshot, context) => {
      const screamId = context.params.screamId;
      try {
        const batch = db.batch();

        // find and delete screams
        const screamSnapshot = await db
            .collection(Collections.COMMENTS)
            .where("screamId", "==", screamId)
            .get();
        screamSnapshot.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });

        // find and delete likes
        const likeSnapshot = await db
            .collection(Collections.LIKES)
            .where("screamId", "==", screamId)
            .get();
        likeSnapshot.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });

        // find and delete notifications
        const notificationSnapshot = await db
            .collection(Collections.NOTIFICATIONS)
            .where("screamId", "==", screamId)
            .get();
        notificationSnapshot.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        await batch.commit();
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    });
