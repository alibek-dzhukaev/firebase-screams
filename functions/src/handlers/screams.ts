import {TScream} from "../models/scream";
import {Request, Response} from "express";
import {db} from "../util/admin";
import {TComment} from "../models/comment";
import {Collections} from "../context/firebase";

// fetch scream list
export const getAllScreams = async (req: Request, res: Response): Promise<void> => {
  try {
    const screams = [] as Array<{ screamId: string } & TScream>;
    const snapshot = await db
        .collection(Collections.SCREAMS)
        .orderBy("createdAt", "desc")
        .get();
    snapshot.forEach((doc) => {
      const scream = doc.data() as TScream;
      screams.push({screamId: doc.id, ...scream});
    });
    res.json(screams);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// post a scream
export const postOneScream = async (req: Request, res: Response): Promise<void> => {
  if (!req.body.body.trim()) {
    res.status(400).json({body: "Must not be empty"});
    return;
  }

  const newScream: TScream = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };

  try {
    const reference = await db
        .collection(Collections.SCREAMS)
        .add(newScream);
    res.json({...newScream, screamId: reference.id});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// fetch one scream
export const getScream = async (req: Request, res: Response): Promise<void> => {
  try {
    let screamData = {} as TScream & { comments: TComment[]; screamId: string };

    const screamDoc = await db
        .doc(`/screams/${req.params.screamId}`)
        .get();
    if (!screamDoc.exists) {
      res.status(404).json({error: "Scream not found"});
      return;
    }
    screamData = {...screamData, ...screamDoc.data() as TScream};
    screamData.screamId = screamDoc.id;

    const commentSnapshot = await db
        .collection(Collections.COMMENTS)
        .orderBy("createdAt", "desc")
        .where("screamId", "==", req.params.screamId)
        .get();

    screamData.comments = [];
    commentSnapshot.forEach((doc) => {
      screamData.comments.push(doc.data() as TComment);
    });
    res.json(screamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// comment on a scream
export const commentOnScream = async (req: Request, res: Response): Promise<void> => {
  if (!req.body.body.trim()) {
    res.status(400).json({comment: "Must not be empty"});
    return;
  }

  const newComment: TComment = {
    screamId: req.params.screamId,
    body: req.body.body,
    userHandle: req.user.handle,
    createdAt: new Date().toISOString(),
    userImage: req.user.imageUrl,
  };
  try {
    const screamDoc = await db.doc(`/screams/${req.params.screamId}`).get();
    if (!screamDoc.exists) {
      res.status(404).json({error: "Scream not found"});
      return;
    }
    await screamDoc
        .ref
        .update({commentCount: (screamDoc.data() as TScream).commentCount + 1});

    await db.collection("comments").add(newComment);
    res.json(newComment);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Something went wrong"});
  }
};

// like a scream
export const likeScream = async (req: Request, res: Response): Promise<void> => {
  const likeRef = db
      .collection(Collections.LIKES)
      .where("userHandle", "==", req.user.handle)
      .where("screamId", "==", req.params.screamId)
      .limit(1);

  const screamRef = db.doc(`/screams/${req.params.screamId}`);

  try {
    let screamData = {} as TScream & { screamId: string };

    // scream
    const screamDoc = await screamRef.get();
    if (!screamDoc.exists) {
      res.status(404).json({error: "Scream not found"});
      return;
    }
    screamData = {...screamData, ...screamDoc.data() as TScream};
    screamData.screamId = screamDoc.id;

    // like
    const likeDoc = await likeRef.get();
    if (!likeDoc.empty) {
      res.status(400).json({error: "Scream already liked"});
      return;
    }
    await db
        .collection(Collections.LIKES)
        .add({
          screamId: req.params.screamId,
          userHandle: req.user.handle,
        });
    screamData.likeCount += 1;
    await screamRef.update({likeCount: screamData.likeCount});
    res.json(screamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// unlike a scream
export const unlikeScream = async (req: Request, res: Response): Promise<void> => {
  const likeRef = db
      .collection(Collections.LIKES)
      .where("userHandle", "==", req.user.handle)
      .where("screamId", "==", req.params.screamId)
      .limit(1);

  const screamRef = db.doc(`/screams/${req.params.screamId}`);

  try {
    let screamData = {} as TScream & { screamId: string };

    // scream
    const screamDoc = await screamRef.get();
    if (!screamDoc.exists) {
      res.status(404).json({error: "Scream not found"});
      return;
    }
    screamData = {...screamData, ...screamDoc.data() as TScream};
    screamData.screamId = screamDoc.id;
    // like
    const likeDoc = await likeRef.get();
    if (likeDoc.empty) {
      res.status(400).json({error: "Scream not liked"});
      return;
    }
    await db.doc(`/likes/${likeDoc.docs[0].id}`).delete();
    screamData.likeCount -= 1;
    await screamRef.update({likeCount: screamData.likeCount});
    res.json(screamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};

// delete scream
export const deleteScream = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentRef = db.doc(`/screams/${req.params.screamId}`);
    const doc = await documentRef.get();
    if (!doc.exists) {
      res.status(404).json({error: "Scream not found"});
      return;
    }
    if ((doc.data() as TScream).userHandle !== req.user.handle) {
      res.status(403).json({error: "Unauthorized"});
      return;
    }
    await documentRef.delete();
    res.json({message: "Scream deleted successfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.code});
  }
};
